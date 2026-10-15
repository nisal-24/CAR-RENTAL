const createModel = require('./baseModel');
const { BLOCKING_STATUS } = require('../config/constants');

const base = createModel(
  'vehicles',
  ['make', 'model', 'year', 'license_plate', 'type', 'seats', 'daily_rate', 'status', 'venue_id'],
  {
    select: 'SELECT vehicles.*, ve.name AS venue_name FROM vehicles LEFT JOIN venues ve ON ve.id = vehicles.venue_id',
    orderBy: 'vehicles.id DESC',
  }
);

const blockingList = BLOCKING_STATUS.map((s) => `'${s}'`).join(',');

/**
 * Search + availability.
 * When start & end are given only vehicles that are 'Available' AND have no overlapping
 * Pending/Confirmed/Active rental are returned. A rental occupies [start, end).
 */
async function search({ venue_id, type, q, min_price, max_price, start, end, publicOnly }) {
  const where = [];
  const params = [];
  if (venue_id) { where.push('vehicles.venue_id = ?'); params.push(venue_id); }
  if (type) { where.push('vehicles.type = ?'); params.push(type); }
  if (q) {
    where.push('(vehicles.make LIKE ? OR vehicles.model LIKE ? OR vehicles.license_plate LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (min_price) { where.push('vehicles.daily_rate >= ?'); params.push(min_price); }
  if (max_price) { where.push('vehicles.daily_rate <= ?'); params.push(max_price); }
  if (publicOnly || (start && end)) where.push("vehicles.status = 'Available'");
  if (start && end) {
    where.push(`NOT EXISTS (
      SELECT 1 FROM rentals r
      WHERE r.vehicle_id = vehicles.id AND r.status IN (${blockingList})
        AND r.start_date < ? AND r.end_date > ?)`);
    params.push(end, start);
  }
  return base.findAll(where.length ? `WHERE ${where.join(' AND ')}` : '', params);
}

/** Used inside a transaction: lock the vehicle row and check overlaps. */
async function isFree(conn, vehicleId, start, end) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM rentals
     WHERE vehicle_id = ? AND status IN (${blockingList}) AND start_date < ? AND end_date > ?`,
    [vehicleId, end, start]
  );
  return rows[0].c === 0;
}

module.exports = { ...base, search, isFree };
