const db = require('../config/db');
const HttpError = require('../utils/httpError');
const Vehicle = require('./vehicleModel');
const Payment = require('./paymentModel');
const { calculatePrice } = require('../utils/pricing');
const { todayStr, daysBetween } = require('../utils/dates');
const { MAX_RENTAL_DAYS } = require('../config/constants');

const SELECT = `SELECT r.*, CONCAT(v.make, ' ', v.model) AS vehicle_name, v.license_plate, v.type AS vehicle_type,
                       u.name AS customer_name, u.email AS customer_email,
                       pv.name AS pickup_venue, dv.name AS dropoff_venue, pk.name AS package_name,
                       p.id AS payment_id, p.status AS payment_status, p.method AS payment_method
                FROM rentals r
                JOIN vehicles v ON v.id = r.vehicle_id
                JOIN users u ON u.id = r.user_id
                JOIN venues pv ON pv.id = r.pickup_venue_id
                JOIN venues dv ON dv.id = r.dropoff_venue_id
                LEFT JOIN packages pk ON pk.id = r.package_id
                LEFT JOIN payments p ON p.rental_id = r.id`;

/** Validate dates, availability and compute the price. `lock` = true inside a transaction. */
async function buildQuote(conn, userId, d, lock) {
  if (d.start_date < todayStr()) throw new HttpError(422, 'Pick-up date cannot be in the past');
  const days = daysBetween(d.start_date, d.end_date);
  if (days < 1) throw new HttpError(422, 'Return date must be after the pick-up date');
  if (days > MAX_RENTAL_DAYS) throw new HttpError(422, `Maximum rental length is ${MAX_RENTAL_DAYS} days`);

  const [vrows] = await conn.query(`SELECT * FROM vehicles WHERE id = ? ${lock ? 'FOR UPDATE' : ''}`, [d.vehicle_id]);
  const vehicle = vrows[0];
  if (!vehicle) throw new HttpError(404, 'Vehicle not found');
  if (vehicle.status !== 'Available') throw new HttpError(409, 'This vehicle is not available for rent');
  if (!(await Vehicle.isFree(conn, vehicle.id, d.start_date, d.end_date))) {
    throw new HttpError(409, 'This vehicle is already booked for the selected dates');
  }

  let pkg = null;
  if (d.package_id) {
    const [prows] = await conn.query('SELECT * FROM packages WHERE id = ? AND active = 1', [d.package_id]);
    pkg = prows[0];
    if (!pkg) throw new HttpError(404, 'Package not found or inactive');
    if (days < pkg.min_days) throw new HttpError(422, `${pkg.name} requires at least ${pkg.min_days} day(s)`);
  }

  let memberDiscount = 0;
  if (userId) {
    const [mrows] = await conn.query(
      'SELECT m.discount_percent FROM users u LEFT JOIN memberships m ON m.id = u.membership_id WHERE u.id = ?', [userId]);
    memberDiscount = mrows[0]?.discount_percent || 0;
  }

  const price = calculatePrice({
    dailyRate: vehicle.daily_rate,
    extraDailyFee: pkg ? pkg.extra_daily_fee : 0,
    days,
    packageDiscount: pkg ? pkg.discount_percent : 0,
    memberDiscount,
  });
  return {
    vehicle, days, package: pkg, member_discount: memberDiscount,
    daily_rate: vehicle.daily_rate, extra_daily_fee: pkg ? pkg.extra_daily_fee : 0,
    package_discount: pkg ? pkg.discount_percent : 0, ...price,
  };
}

module.exports = {
  async quote(userId, data) {
    return buildQuote(db, userId, data, false);
  },

  async findAll() {
    const [rows] = await db.query(`${SELECT} ORDER BY r.id DESC`);
    return rows;
  },
  async findByUser(userId) {
    const [rows] = await db.query(`${SELECT} WHERE r.user_id = ? ORDER BY r.id DESC`, [userId]);
    return rows;
  },

  /** Create rental + pending payment atomically; the vehicle row is locked to avoid double booking. */
  async create(userId, data) {
    return Payment.withTx(async (conn) => {
      const q = await buildQuote(conn, userId, data, true);
      const pickup = data.pickup_venue_id || q.vehicle.venue_id;
      if (!pickup) throw new HttpError(422, 'Choose a pick-up venue');

      const [res] = await conn.query(
        `INSERT INTO rentals (user_id, vehicle_id, pickup_venue_id, dropoff_venue_id, package_id,
                              start_date, end_date, days, subtotal, discount_amount, total_amount, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?, 'Pending')`,
        [userId, q.vehicle.id, pickup, data.dropoff_venue_id, data.package_id || null,
         data.start_date, data.end_date, q.days, q.subtotal, q.discount_amount, q.total]
      );
      const rentalId = res.insertId;
      const ref = `TXN-${Date.now().toString(36).toUpperCase()}-${rentalId}`;
      const [pay] = await conn.query(
        "INSERT INTO payments (rental_id, user_id, amount, status, transaction_ref) VALUES (?,?,?, 'Pending', ?)",
        [rentalId, userId, q.total, ref]
      );
      await Payment.log(conn, pay.insertId, 'CREATED', 'Payment record created with booking', q.total, userId);
      return { rental_id: rentalId, payment_id: pay.insertId, total: q.total, days: q.days };
    });
  },

  async setStatus(id, status) {
    const [res] = await db.query('UPDATE rentals SET status = ? WHERE id = ?', [status, id]);
    return res.affectedRows;
  },

  /** Cancel (owner or admin). Paid -> auto refund, unpaid -> payment cancelled. */
  async cancel(id, actor) {
    return Payment.withTx(async (conn) => {
      const [rows] = await conn.query('SELECT * FROM rentals WHERE id = ? FOR UPDATE', [id]);
      const r = rows[0];
      if (!r) throw new HttpError(404, 'Rental not found');
      if (actor.role !== 'admin' && r.user_id !== actor.id) throw new HttpError(403, 'Not your rental');
      if (!['Pending', 'Confirmed'].includes(r.status)) throw new HttpError(409, `A ${r.status.toLowerCase()} rental cannot be cancelled`);

      await conn.query("UPDATE rentals SET status='Cancelled' WHERE id = ?", [id]);
      const [prow] = await conn.query('SELECT * FROM payments WHERE rental_id = ? FOR UPDATE', [id]);
      const p = prow[0];
      if (p) {
        if (p.status === 'Paid') {
          await conn.query("UPDATE payments SET status='Refunded' WHERE id = ?", [p.id]);
          await Payment.log(conn, p.id, 'REFUNDED', 'Booking cancelled - full refund issued', p.amount, actor.id);
        } else if (p.status === 'Pending') {
          await conn.query("UPDATE payments SET status='Cancelled' WHERE id = ?", [p.id]);
          await Payment.log(conn, p.id, 'CANCELLED', 'Booking cancelled before payment', p.amount, actor.id);
        }
      }
      return { id, status: 'Cancelled' };
    });
  },
};
