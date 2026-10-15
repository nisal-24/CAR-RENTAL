const db = require('../config/db');
const HttpError = require('../utils/httpError');

const SELECT = `SELECT p.*, r.start_date, r.end_date, r.status AS rental_status,
                       u.name AS customer_name, u.email AS customer_email,
                       CONCAT(v.make, ' ', v.model) AS vehicle_name
                FROM payments p
                JOIN rentals r ON r.id = p.rental_id
                JOIN users u ON u.id = p.user_id
                JOIN vehicles v ON v.id = r.vehicle_id`;

async function log(conn, paymentId, event, message, amount, actorId) {
  await conn.query(
    'INSERT INTO payment_logs (payment_id, event, message, amount, actor_id) VALUES (?,?,?,?,?)',
    [paymentId, event, message, amount ?? null, actorId ?? null]
  );
}

async function withTx(fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  log,
  withTx,

  async findAll() {
    const [rows] = await db.query(`${SELECT} ORDER BY p.id DESC`);
    return rows;
  },
  async findByUser(userId) {
    const [rows] = await db.query(`${SELECT} WHERE p.user_id = ? ORDER BY p.id DESC`, [userId]);
    return rows;
  },
  async logs(limit = 200) {
    const [rows] = await db.query(
      `SELECT l.*, p.transaction_ref FROM payment_logs l JOIN payments p ON p.id = l.payment_id
       ORDER BY l.id DESC LIMIT ?`, [limit]);
    return rows;
  },

  /**
   * MOCK payment gateway. Rules:
   *  - Card: needs a 13-19 digit number; numbers ending in 0000 are "declined"
   *  - Bank Transfer: always accepted
   *  - Cash: only an admin can record it (customer pays at the counter)
   * The full card number is never stored - only the last 4 digits.
   */
  async pay(paymentId, actor, { method, card_number }) {
    let declined = null;
    const result = await withTx(async (conn) => {
      const [rows] = await conn.query('SELECT * FROM payments WHERE id = ? FOR UPDATE', [paymentId]);
      const p = rows[0];
      if (!p) throw new HttpError(404, 'Payment not found');
      if (actor.role !== 'admin' && p.user_id !== actor.id) throw new HttpError(403, 'Not your payment');
      if (p.status !== 'Pending') throw new HttpError(409, `Payment is already ${p.status}`);
      if (method === 'Cash' && actor.role !== 'admin') throw new HttpError(403, 'Cash payments are recorded by staff at the counter');
      if (method === 'Card' && !card_number) throw new HttpError(422, 'Card number is required');

      const [rr] = await conn.query('SELECT status FROM rentals WHERE id = ?', [p.rental_id]);
      if (rr[0].status === 'Cancelled') throw new HttpError(409, 'This rental was cancelled');

      if (method === 'Card' && card_number.endsWith('0000')) {
        await log(conn, p.id, 'DECLINED', 'Card declined by mock gateway', p.amount, actor.id);
        declined = true;
        return null;
      }

      const last4 = method === 'Card' ? card_number.slice(-4) : null;
      await conn.query(
        "UPDATE payments SET status='Paid', method=?, card_last4=?, paid_at=NOW() WHERE id=?",
        [method, last4, p.id]
      );
      await conn.query("UPDATE rentals SET status='Confirmed' WHERE id=? AND status='Pending'", [p.rental_id]);
      await log(conn, p.id, 'PAID', `${method} payment approved (mock gateway)`, p.amount, actor.id);
      return { id: p.id, status: 'Paid', transaction_ref: p.transaction_ref };
    });
    if (declined) throw new HttpError(402, 'Card declined. Try a different card number (numbers ending 0000 are declined in this demo).');
    return result;
  },

  async refund(paymentId, actor) {
    return withTx(async (conn) => {
      const [rows] = await conn.query('SELECT * FROM payments WHERE id = ? FOR UPDATE', [paymentId]);
      const p = rows[0];
      if (!p) throw new HttpError(404, 'Payment not found');
      if (p.status !== 'Paid') throw new HttpError(409, 'Only paid payments can be refunded');
      await conn.query("UPDATE payments SET status='Refunded' WHERE id=?", [p.id]);
      await conn.query("UPDATE rentals SET status='Cancelled' WHERE id=? AND status IN ('Pending','Confirmed','Active')", [p.rental_id]);
      await log(conn, p.id, 'REFUNDED', 'Refund issued by admin', p.amount, actor.id);
      return { id: p.id, status: 'Refunded' };
    });
  },
};
