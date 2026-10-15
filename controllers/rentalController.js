const Rental = require('../models/rentalModel');
const HttpError = require('../utils/httpError');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const pickRental = (b) => ({
  vehicle_id: b.vehicle_id, package_id: b.package_id, pickup_venue_id: b.pickup_venue_id,
  dropoff_venue_id: b.dropoff_venue_id, start_date: b.start_date, end_date: b.end_date,
});

module.exports = {
  quote: wrap(async (req, res) => {
    const q = await Rental.quote(req.user?.id, pickRental(req.body));
    const { vehicle, package: pkg, ...rest } = q;
    res.json({ ...rest, vehicle_name: `${vehicle.make} ${vehicle.model}`, package_name: pkg?.name || null });
  }),

  create: wrap(async (req, res) => {
    res.status(201).json(await Rental.create(req.user.id, pickRental(req.body)));
  }),

  mine: wrap(async (req, res) => res.json(await Rental.findByUser(req.user.id))),
  list: wrap(async (req, res) => res.json(await Rental.findAll())),

  setStatus: wrap(async (req, res) => {
    if (!(await Rental.setStatus(req.params.id, req.body.status))) throw new HttpError(404, 'Rental not found');
    res.json({ id: req.params.id, status: req.body.status });
  }),

  cancel: wrap(async (req, res) => res.json(await Rental.cancel(req.params.id, req.user))),
};
