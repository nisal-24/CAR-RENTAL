const db = require('../config/db');

/**
 * Small factory that gives every table the same CRUD methods.
 * opts.select  - SELECT ... FROM ... (may contain joins)
 * opts.idCol   - qualified id column used in WHERE (default `table.id`)
 * opts.orderBy - ORDER BY expression
 */
function createModel(table, fields, opts = {}) {
  const select = opts.select || `SELECT * FROM ${table}`;
  const idCol = opts.idCol || `${table}.id`;
  const orderBy = opts.orderBy || `${idCol} DESC`;

  const pick = (data) => fields.filter((f) => data[f] !== undefined);

  return {
    table,
    fields,
    async findAll(where = '', params = []) {
      const [rows] = await db.query(`${select} ${where} ORDER BY ${orderBy}`, params);
      return rows;
    },
    async findById(id) {
      const [rows] = await db.query(`${select} WHERE ${idCol} = ?`, [id]);
      return rows[0] || null;
    },
    async create(data) {
      const cols = pick(data);
      const [res] = await db.query(
        `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        cols.map((c) => (data[c] === '' ? null : data[c]))
      );
      return res.insertId;
    },
    async update(id, data) {
      const cols = pick(data);
      if (!cols.length) return 0;
      const [res] = await db.query(
        `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(',')} WHERE id = ?`,
        [...cols.map((c) => (data[c] === '' ? null : data[c])), id]
      );
      return res.affectedRows;
    },
    async remove(id) {
      const [res] = await db.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
      return res.affectedRows;
    },
  };
}

module.exports = createModel;
