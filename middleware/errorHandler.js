function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (res.headersSent) return next(err);

  if (err.status) return res.status(err.status).json({ message: err.message });

  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return res.status(409).json({ message: 'A record with the same unique value (name, email or plate) already exists' });
    case 'ER_ROW_IS_REFERENCED_2':
      return res.status(409).json({ message: 'Cannot delete: this record is used by other records (e.g. rentals)' });
    case 'ER_NO_REFERENCED_ROW_2':
      return res.status(422).json({ message: 'A selected venue, vehicle or related record does not exist' });
    case 'ER_BAD_FIELD_ERROR':
    case 'ER_PARSE_ERROR':
      console.error(err);
      return res.status(500).json({ message: 'Server query error' });
    default:
      break;
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body' });

  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
}
module.exports = errorHandler;
