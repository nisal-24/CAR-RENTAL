const { body, param, query, validationResult } = require('express-validator');
const C = require('../config/constants');

const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  return res.status(422).json({
    message: 'Validation failed',
    errors: result.array().map((e) => ({ field: e.path, msg: e.msg })),
  });
};

const id = param('id').isInt({ min: 1 }).withMessage('Invalid id').toInt();
const text = (f, label, max = 100) =>
  body(f).trim().notEmpty().withMessage(`${label} is required`).isLength({ max }).withMessage(`${label} is too long`);
const optText = (f, max = 255) => body(f).optional({ values: 'falsy' }).trim().isLength({ max });
const optId = (f) => body(f).optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage(`${f} must be a valid id`).toInt();
const percent = (f, label) =>
  body(f).optional({ values: 'falsy' }).isFloat({ min: 0, max: 100 }).withMessage(`${label} must be 0-100`).toFloat();
const money = (f, label) =>
  body(f).optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage(`${label} must be 0 or more`).toFloat();
const isoDate = (f) => body(f).isISO8601({ strict: true, strictSeparator: true }).withMessage(`${f} must be YYYY-MM-DD`).isLength({ min: 10, max: 10 });
const toBool = (f) => body(f).optional().customSanitizer((v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0));

const currentYear = new Date().getFullYear();

const rules = {
  id: [id, validate],

  register: [
    text('name', 'Name'),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password')
      .isLength({ min: 8, max: 72 }).withMessage('Password must be 8-72 characters')
      .matches(/[A-Za-z]/).withMessage('Password needs a letter')
      .matches(/\d/).withMessage('Password needs a number'),
    body('phone').optional({ values: 'falsy' }).trim().matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Invalid phone number'),
    validate,
  ],
  login: [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
  ],
  membershipChoice: [body('membership_id').isInt({ min: 1 }).withMessage('Choose a membership').toInt(), validate],
  userRole: [id, body('role').isIn(['customer', 'admin']).withMessage('Invalid role'), validate],

  vehicle: [
    text('make', 'Make', 60),
    text('model', 'Model', 60),
    body('year').isInt({ min: 1990, max: currentYear + 1 }).withMessage(`Year must be 1990-${currentYear + 1}`).toInt(),
    body('license_plate').trim().matches(/^[A-Za-z0-9 -]{3,20}$/).withMessage('Invalid license plate').customSanitizer((v) => v.toUpperCase()),
    body('type').isIn(C.VEHICLE_TYPES).withMessage('Invalid vehicle type'),
    body('seats').isInt({ min: 1, max: 20 }).withMessage('Seats must be 1-20').toInt(),
    body('daily_rate').isFloat({ gt: 0 }).withMessage('Daily rate must be greater than 0').toFloat(),
    body('status').optional().isIn(C.VEHICLE_STATUS).withMessage('Invalid status'),
    optId('venue_id'),
    validate,
  ],
  vehicleSearch: [
    query('venue_id').optional({ values: 'falsy' }).isInt({ min: 1 }),
    query('type').optional({ values: 'falsy' }).isIn(C.VEHICLE_TYPES),
    query('start').optional({ values: 'falsy' }).isISO8601({ strict: true }),
    query('end').optional({ values: 'falsy' }).isISO8601({ strict: true }),
    query('min_price').optional({ values: 'falsy' }).isFloat({ min: 0 }),
    query('max_price').optional({ values: 'falsy' }).isFloat({ min: 0 }),
    query('q').optional().trim().isLength({ max: 60 }),
    validate,
  ],

  venue: [
    text('name', 'Name'),
    text('address', 'Address', 255),
    text('city', 'City', 80),
    body('phone').optional({ values: 'falsy' }).trim().matches(/^[0-9+\-\s()]{7,25}$/).withMessage('Invalid phone number'),
    optText('opening_hours', 80),
    validate,
  ],

  staff: [
    text('name', 'Name'),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('phone').optional({ values: 'falsy' }).trim().matches(/^[0-9+\-\s()]{7,25}$/).withMessage('Invalid phone number'),
    text('position', 'Position', 60),
    optId('venue_id'),
    toBool('active'),
    validate,
  ],

  pkg: [
    text('name', 'Name', 80),
    optText('description'),
    money('extra_daily_fee', 'Extra daily fee'),
    percent('discount_percent', 'Discount'),
    body('min_days').optional({ values: 'falsy' }).isInt({ min: 1, max: 365 }).withMessage('Minimum days must be 1-365').toInt(),
    toBool('active'),
    validate,
  ],

  membership: [
    text('name', 'Name', 60),
    percent('discount_percent', 'Discount'),
    money('annual_fee', 'Annual fee'),
    optText('benefits'),
    validate,
  ],

  rentalQuote: [
    body('vehicle_id').isInt({ min: 1 }).withMessage('Choose a vehicle').toInt(),
    optId('package_id'),
    isoDate('start_date'),
    isoDate('end_date'),
    validate,
  ],
  rentalCreate: [
    body('vehicle_id').isInt({ min: 1 }).withMessage('Choose a vehicle').toInt(),
    optId('package_id'),
    optId('pickup_venue_id'),
    body('dropoff_venue_id').isInt({ min: 1 }).withMessage('Choose a drop-off venue').toInt(),
    isoDate('start_date'),
    isoDate('end_date'),
    validate,
  ],
  rentalStatus: [id, body('status').isIn(C.RENTAL_STATUS).withMessage('Invalid status'), validate],

  pay: [
    id,
    body('method').isIn(C.PAYMENT_METHODS).withMessage('Choose a payment method'),
    body('card_number').optional({ values: 'falsy' }).customSanitizer((v) => String(v).replace(/[\s-]/g, '')).matches(/^\d{13,19}$/).withMessage('Card number must be 13-19 digits'),
    validate,
  ],

  reportRange: [
    query('from').optional({ values: 'falsy' }).isISO8601({ strict: true }),
    query('to').optional({ values: 'falsy' }).isISO8601({ strict: true }),
    validate,
  ],
};

module.exports = { validate, rules };
