const router = require('express').Router();
const { rules } = require('../middleware/validators');
const { optionalAuth, authenticate, requireAdmin } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

const auth = require('../controllers/authController');
const vehicles = require('../controllers/vehicleController');
const venues = require('../controllers/venueController');
const staff = require('../controllers/staffController');
const packages = require('../controllers/packageController');
const memberships = require('../controllers/membershipController');
const rentals = require('../controllers/rentalController');
const payments = require('../controllers/paymentController');
const reports = require('../controllers/reportController');

router.use(optionalAuth); // every route can read req.user

const admin = [authenticate, requireAdmin];
const loginLimiter = rateLimit({ max: 10 });

// ---------- Auth ----------
router.post('/auth/register', loginLimiter, rules.register, auth.register);
router.post('/auth/login', loginLimiter, rules.login, auth.login);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', auth.me);
router.put('/auth/membership', authenticate, rules.membershipChoice, auth.chooseMembership);
router.get('/users', admin, auth.listUsers);
router.put('/users/:id/role', admin, rules.userRole, auth.setRole);

// ---------- Vehicles (public read, admin write) ----------
router.get('/vehicles/types', vehicles.types);
router.get('/vehicles', rules.vehicleSearch, vehicles.list);
router.get('/vehicles/:id', rules.id, vehicles.get);
router.post('/vehicles', admin, rules.vehicle, vehicles.create);
router.put('/vehicles/:id', admin, rules.id, rules.vehicle, vehicles.update);
router.delete('/vehicles/:id', admin, rules.id, vehicles.remove);

// ---------- Venues ----------
router.get('/venues', venues.list);
router.get('/venues/:id', rules.id, venues.get);
router.post('/venues', admin, rules.venue, venues.create);
router.put('/venues/:id', admin, rules.id, rules.venue, venues.update);
router.delete('/venues/:id', admin, rules.id, venues.remove);

// ---------- Staff (admin only - contains personal data) ----------
router.get('/staff', admin, staff.list);
router.get('/staff/:id', admin, rules.id, staff.get);
router.post('/staff', admin, rules.staff, staff.create);
router.put('/staff/:id', admin, rules.id, rules.staff, staff.update);
router.delete('/staff/:id', admin, rules.id, staff.remove);

// ---------- Packages ----------
router.get('/packages', packages.list);
router.get('/packages/:id', rules.id, packages.get);
router.post('/packages', admin, rules.pkg, packages.create);
router.put('/packages/:id', admin, rules.id, rules.pkg, packages.update);
router.delete('/packages/:id', admin, rules.id, packages.remove);

// ---------- Memberships ----------
router.get('/memberships', memberships.list);
router.get('/memberships/:id', rules.id, memberships.get);
router.post('/memberships', admin, rules.membership, memberships.create);
router.put('/memberships/:id', admin, rules.id, rules.membership, memberships.update);
router.delete('/memberships/:id', admin, rules.id, memberships.remove);

// ---------- Rentals ----------
router.post('/rentals/quote', rules.rentalQuote, rentals.quote);
router.get('/rentals/mine', authenticate, rentals.mine);
router.post('/rentals', authenticate, rules.rentalCreate, rentals.create);
router.post('/rentals/:id/cancel', authenticate, rules.id, rentals.cancel);
router.get('/rentals', admin, rentals.list);
router.patch('/rentals/:id/status', admin, rules.rentalStatus, rentals.setStatus);

// ---------- Payments ----------
router.get('/payments/mine', authenticate, payments.mine);
router.get('/payments/logs', admin, payments.logs);
router.get('/payments', admin, payments.list);
router.post('/payments/:id/pay', authenticate, rules.pay, payments.pay);
router.post('/payments/:id/refund', admin, rules.id, payments.refund);

// ---------- Reports ----------
router.get('/reports/overview', admin, rules.reportRange, reports.overview);
router.get('/reports/export.csv', admin, rules.reportRange, reports.exportCsv);

module.exports = router;
