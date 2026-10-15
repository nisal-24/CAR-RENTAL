// Re-hashes the demo accounts with bcryptjs:  admin -> Admin@123,  customers -> User@123
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

(async () => {
  const admin = await bcrypt.hash('Admin@123', 10);
  const user = await bcrypt.hash('User@123', 10);
  await db.query("UPDATE users SET password_hash = ? WHERE email = 'admin@carrental.com'", [admin]);
  await db.query("UPDATE users SET password_hash = ? WHERE email IN ('nimal@example.com','kavya@example.com')", [user]);
  console.log('Demo passwords updated:  admin@carrental.com / Admin@123   |   nimal@example.com, kavya@example.com / User@123');
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
