const Payment = require('../models/paymentModel');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

module.exports = {
  list: wrap(async (req, res) => res.json(await Payment.findAll())),
  mine: wrap(async (req, res) => res.json(await Payment.findByUser(req.user.id))),
  logs: wrap(async (req, res) => res.json(await Payment.logs())),
  pay: wrap(async (req, res) => res.json(await Payment.pay(req.params.id, req.user, req.body))),
  refund: wrap(async (req, res) => res.json(await Payment.refund(req.params.id, req.user))),
};
