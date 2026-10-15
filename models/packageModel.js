const createModel = require('./baseModel');
module.exports = createModel('packages', ['name', 'description', 'extra_daily_fee', 'discount_percent', 'min_days', 'active'], { orderBy: 'packages.id ASC' });
