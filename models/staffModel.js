const createModel = require('./baseModel');
module.exports = createModel('staff', ['name', 'email', 'phone', 'position', 'venue_id', 'active'], {
  select: 'SELECT staff.*, v.name AS venue_name FROM staff LEFT JOIN venues v ON v.id = staff.venue_id',
  orderBy: 'staff.name ASC',
});
