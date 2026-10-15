const HttpError = require('../utils/httpError');

/** Generic REST controller for a model made with createModel (keeps controllers short & consistent). */
module.exports = function crudController(Model, label) {
  const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
  const pickBody = (req) => Object.fromEntries(Model.fields.filter((f) => req.body[f] !== undefined).map((f) => [f, req.body[f]]));

  return {
    list: wrap(async (req, res) => res.json(await Model.findAll())),

    get: wrap(async (req, res) => {
      const row = await Model.findById(req.params.id);
      if (!row) throw new HttpError(404, `${label} not found`);
      res.json(row);
    }),

    create: wrap(async (req, res) => {
      const id = await Model.create(pickBody(req));
      res.status(201).json(await Model.findById(id));
    }),

    update: wrap(async (req, res) => {
      const affected = await Model.update(req.params.id, pickBody(req));
      if (!affected && !(await Model.findById(req.params.id))) throw new HttpError(404, `${label} not found`);
      res.json(await Model.findById(req.params.id));
    }),

    remove: wrap(async (req, res) => {
      const affected = await Model.remove(req.params.id);
      if (!affected) throw new HttpError(404, `${label} not found`);
      res.json({ message: `${label} deleted` });
    }),
  };
};
