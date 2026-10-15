const createModel = require('./baseModel');
module.exports = createModel('memberships', ['name', 'discount_percent', 'annual_fee', 'benefits'], { orderBy: 'memberships.discount_percent ASC' });
