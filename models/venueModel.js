const createModel = require('./baseModel');
module.exports = createModel('venues', ['name', 'address', 'city', 'phone', 'opening_hours'], { orderBy: 'venues.name ASC' });
