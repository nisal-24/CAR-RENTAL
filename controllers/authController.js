const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const HttpError = require('../utils/httpError');
const { signToken, setAuthCookie } = require('../middleware/auth');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
  membership_id: u.membership_id, membership_name: u.membership_name, membership_discount: u.membership_discount,
});

// A real hash used to equalise timing when the email does not exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

module.exports = {
  register: wrap(async (req, res) => {
    const { name, email, phone, password } = req.body;
    if (await User.findByEmail(email)) throw new HttpError(409, 'An account with this email already exists');
    const id = await User.create({ name, email, phone, passwordHash: await bcrypt.hash(password, 10) });
    const user = await User.findById(id);
    setAuthCookie(res, signToken(user));
    res.status(201).json({ user: publicUser(user) });
  }),

  login: wrap(async (req, res) => {
    const { email, password } = req.body;
    const row = await User.findByEmail(email);
    const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
    if (!row || !ok) throw new HttpError(401, 'Incorrect email or password');
    const user = await User.findById(row.id);
    setAuthCookie(res, signToken(user));
    res.json({ user: publicUser(user) });
  }),

  logout: (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
  },

  // never 401 - the front-end uses this to decide which nav to show
  me: wrap(async (req, res) => {
    if (!req.user) return res.json({ user: null });
    const user = await User.findById(req.user.id);
    if (!user) { res.clearCookie('token'); return res.json({ user: null }); }
    res.json({ user: publicUser(user) });
  }),

  chooseMembership: wrap(async (req, res) => {
    await User.setMembership(req.user.id, req.body.membership_id);
    res.json({ user: publicUser(await User.findById(req.user.id)) });
  }),

  // ---- admin: user management ----
  listUsers: wrap(async (req, res) => res.json(await User.findAll())),

  setRole: wrap(async (req, res) => {
    if (req.params.id === req.user.id) throw new HttpError(409, 'You cannot change your own role');
    if (!(await User.setRole(req.params.id, req.body.role)) && !(await User.findById(req.params.id))) throw new HttpError(404, 'User not found');
    res.json(await User.findById(req.params.id));
  }),
};
