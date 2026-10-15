const db = require('../config/db');

const SELECT = `SELECT u.id, u.name, u.email, u.phone, u.role, u.membership_id, u.created_at,
                       m.name AS membership_name, m.discount_percent AS membership_discount
                FROM users u LEFT JOIN memberships m ON m.id = u.membership_id`;

module.exports = {
  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },
  async findById(id) {
    const [rows] = await db.query(`${SELECT} WHERE u.id = ?`, [id]);
    return rows[0] || null;
  },
  async findAll() {
    const [rows] = await db.query(`${SELECT} ORDER BY u.id ASC`);
    return rows;
  },
  async create({ name, email, phone, passwordHash }) {
    const [res] = await db.query(
      "INSERT INTO users (name, email, phone, password_hash, role, membership_id) VALUES (?,?,?,?, 'customer', 1)",
      [name, email, phone || null, passwordHash]
    );
    return res.insertId;
  },
  async setMembership(id, membershipId) {
    const [res] = await db.query('UPDATE users SET membership_id = ? WHERE id = ?', [membershipId, id]);
    return res.affectedRows;
  },
  async setRole(id, role) {
    const [res] = await db.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    return res.affectedRows;
  },
};
