const db = require('../config/db');

function range(from, to) {
  const where = [];
  const params = [];
  if (from) { where.push('r.start_date >= ?'); params.push(from); }
  if (to) { where.push('r.start_date <= ?'); params.push(to); }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

module.exports = {
  async overview(from, to) {
    const { clause, params } = range(from, to);

    const [[summary]] = await db.query(
      `SELECT COUNT(DISTINCT r.id) AS total_rentals,
              SUM(r.status IN ('Pending','Confirmed','Active')) AS open_rentals,
              SUM(r.status = 'Completed') AS completed_rentals,
              SUM(r.status = 'Cancelled') AS cancelled_rentals,
              COALESCE(SUM(CASE WHEN p.status='Paid'     THEN p.amount END),0) AS revenue,
              COALESCE(SUM(CASE WHEN p.status='Pending' AND r.status <> 'Cancelled' THEN p.amount END),0) AS pending_amount,
              COALESCE(SUM(CASE WHEN p.status='Refunded' THEN p.amount END),0) AS refunded_amount
       FROM rentals r LEFT JOIN payments p ON p.rental_id = r.id ${clause}`, params);

    const [byMonth] = await db.query(
      `SELECT DATE_FORMAT(r.start_date,'%Y-%m') AS month, COUNT(DISTINCT r.id) AS rentals,
              COALESCE(SUM(CASE WHEN p.status='Paid' THEN p.amount END),0) AS revenue
       FROM rentals r LEFT JOIN payments p ON p.rental_id = r.id ${clause}
       GROUP BY month ORDER BY month`, params);

    const [topVehicles] = await db.query(
      `SELECT CONCAT(v.make,' ',v.model) AS vehicle, v.license_plate, COUNT(DISTINCT r.id) AS rentals,
              COALESCE(SUM(r.days),0) AS rented_days,
              COALESCE(SUM(CASE WHEN p.status='Paid' THEN p.amount END),0) AS revenue
       FROM rentals r JOIN vehicles v ON v.id = r.vehicle_id LEFT JOIN payments p ON p.rental_id = r.id
       ${clause ? clause + " AND r.status <> 'Cancelled'" : "WHERE r.status <> 'Cancelled'"}
       GROUP BY v.id ORDER BY revenue DESC, rentals DESC LIMIT 5`, params);

    const [byVenue] = await db.query(
      `SELECT ve.name AS venue, COUNT(DISTINCT r.id) AS rentals,
              COALESCE(SUM(CASE WHEN p.status='Paid' THEN p.amount END),0) AS revenue
       FROM rentals r JOIN venues ve ON ve.id = r.pickup_venue_id LEFT JOIN payments p ON p.rental_id = r.id
       ${clause} GROUP BY ve.id ORDER BY revenue DESC`, params);

    return { summary, byMonth, topVehicles, byVenue };
  },

  async exportRows(from, to) {
    const { clause, params } = range(from, to);
    const [rows] = await db.query(
      `SELECT r.id AS rental_id, u.name AS customer, u.email, CONCAT(v.make,' ',v.model) AS vehicle, v.license_plate,
              pv.name AS pickup_venue, dv.name AS dropoff_venue, COALESCE(pk.name,'-') AS package,
              r.start_date, r.end_date, r.days, r.subtotal, r.discount_amount, r.total_amount,
              r.status AS rental_status, COALESCE(p.status,'-') AS payment_status, COALESCE(p.method,'-') AS payment_method,
              COALESCE(p.transaction_ref,'-') AS transaction_ref
       FROM rentals r
       JOIN users u ON u.id = r.user_id JOIN vehicles v ON v.id = r.vehicle_id
       JOIN venues pv ON pv.id = r.pickup_venue_id JOIN venues dv ON dv.id = r.dropoff_venue_id
       LEFT JOIN packages pk ON pk.id = r.package_id LEFT JOIN payments p ON p.rental_id = r.id
       ${clause} ORDER BY r.start_date DESC`, params);
    return rows;
  },
};
