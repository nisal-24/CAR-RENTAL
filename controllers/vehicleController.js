const Vehicle = require('../models/vehicleModel');
const crudController = require('./crudController');
const { VEHICLE_TYPES } = require('../config/constants');

const crud = crudController(Vehicle, 'Vehicle');

module.exports = {
  ...crud,

  // Public search. Customers only ever see 'Available' vehicles; admins see the whole fleet.
  async list(req, res, next) {
    try {
      const { venue_id, type, q, min_price, max_price, start, end } = req.query;
      if ((start && !end) || (!start && end)) return res.status(422).json({ message: 'Provide both start and end dates' });
      if (start && end && end <= start) return res.status(422).json({ message: 'Return date must be after pick-up date' });
      const rows = await Vehicle.search({
        venue_id, type, q, min_price, max_price, start, end,
        publicOnly: req.user?.role !== 'admin',
      });
      res.json(rows);
    } catch (e) { next(e); }
  },

  types: (req, res) => res.json(VEHICLE_TYPES),
};
