require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', require('./routes'));
app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint not found' }));
app.use(require('./routes/pages'));
app.use((req, res) => res.status(404).send('Page not found'));
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

db.query('SELECT 1')
  .then(() => app.listen(PORT, () => console.log(`Car Rental System running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Could not connect to MySQL:', err.message);
    console.error('Check your .env settings and that you ran:  npm run db:setup');
    process.exit(1);
  });
