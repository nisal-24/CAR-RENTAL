const Package = require('../models/packageModel');
const crud = require('./crudController')(Package, 'Package');

module.exports = {
  ...crud,
  // customers only see active packages
  async list(req, res, next) {
    try {
      const rows = await Package.findAll(req.user?.role === 'admin' ? '' : 'WHERE packages.active = 1');
      res.json(rows);
    } catch (e) { next(e); }
  },
};
