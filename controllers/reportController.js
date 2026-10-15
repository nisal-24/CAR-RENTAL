const Report = require('../models/reportModel');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Prevent spreadsheet formula injection and escape quotes
const cell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

module.exports = {
  overview: wrap(async (req, res) => res.json(await Report.overview(req.query.from, req.query.to))),

  exportCsv: wrap(async (req, res) => {
    const rows = await Report.exportRows(req.query.from, req.query.to);
    const headers = rows.length ? Object.keys(rows[0]) : ['rental_id'];
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))].join('\r\n');
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rental-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
    res.send('\uFEFF' + csv); // BOM so Excel opens UTF-8 correctly
  }),
};
