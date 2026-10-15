# Northway Rentals - Car Rental Management System

A full-stack web application for managing a car-rental business: fleet, branches, staff, packages and loyalty tiers (Practical 01), plus authentication, live availability search, payments and reporting (Practical 02).

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3 (Grid / Flexbox, responsive), JavaScript, jQuery 3.7, AJAX |
| Backend | Node.js (18+), Express 4, REST API, MVC (models / controllers / routes / views) |
| Database | MySQL 8 (`database/schema.sql` = tables + seed data) |
| Security | bcrypt password hashing (bcryptjs), JWT in an httpOnly cookie, role-based route protection, express-validator input validation, parameterised SQL, login rate limiting |

---

## 1. Quick start

**Prerequisites:** Node.js 18+, MySQL 8.0.16+ (CHECK constraints are only enforced from 8.0.16).

```bash
# 1. install dependencies
npm install

# 2. configure the database connection
#    (a .env file is already provided; edit DB_USER / DB_PASSWORD to match your MySQL)
cp .env.example .env        # only if .env does not exist

# 3. create the database, tables and seed data  (re-running RESETS all data)
npm run db:setup
#    or with the mysql CLI:  mysql -u root -p < database/schema.sql

# 4. start the server
npm start                   # or: npm run dev  (auto-restart on change)
```

Open **http://localhost:3000**

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@carrental.com` | `password` |
| Customer (Gold, 10% off) | `kavya@example.com` | `password` |
| Customer (Silver, 5% off) | `nimal@example.com` | `password` |

Optional: `npm run seed:users` re-hashes these accounts to `Admin@123` / `User@123` (use it if you want stronger demo passwords, or if a login fails because of hash-format differences). **Change or delete the demo accounts before any real deployment.**

---

## 2. Feature map

### Practical 01 - Core system (admin CRUD)
| Module | Notes |
|---|---|
| **Vehicles** | make, model, year, license plate (unique), type, seats, daily rate, status (Available / Maintenance / Retired), home branch |
| **Venues** | pick-up / drop-off branches: name, address, city, phone, opening hours |
| **Staff** | the brief's "Trainers" module, adapted to a rental business: branch employees with position, branch, active flag |
| **Packages** | rental bundles & deals: extra daily fee, discount %, minimum days, active flag |
| **Memberships** | loyalty tiers: discount %, annual fee, benefits |

All five are managed from **/admin** (add, edit, delete, live table filter) and exposed as REST resources.

### Practical 02 - Enhancements
| Feature | How it works |
|---|---|
| **Authentication** | Register / login / logout. Passwords hashed with bcrypt (cost 10). JWT stored in an httpOnly, SameSite=Lax cookie (also accepts `Authorization: Bearer`). Roles: `customer`, `admin`. `/admin` and every write endpoint are admin-only; `/my-rentals` requires login. |
| **Availability & search** | `GET /api/vehicles?venue_id=&type=&start=&end=&q=&max_price=`. With dates, only `Available` vehicles with **no overlapping Pending/Confirmed/Active rental** are returned. A rental occupies `[start, end)` so a car returned on the 10th can be picked up on the 10th. Availability is re-checked inside a DB transaction with a row lock when booking (no double-booking). |
| **Pricing** | `subtotal = (daily rate + package extra fee) x days`, then package discount %, then membership discount %. Live quote shown in the booking dialog (`POST /api/rentals/quote`). |
| **Payment workflow** | Booking creates a `Pending` payment. Mock gateway: Card (13-19 digits; numbers ending `0000` are declined), Bank Transfer, Cash (admin only, recorded at the counter). Success -> payment `Paid`, rental `Confirmed`. Admin can refund (-> `Refunded`, rental cancelled). Customer cancellation auto-refunds paid bookings. Every event (CREATED / PAID / DECLINED / REFUNDED / CANCELLED) is written to `payment_logs`. Only the last 4 card digits are stored. |
| **Rental report** | Admin -> Reports: revenue collected / pending / refunded, rental counts by status, revenue by month, top vehicles, performance by branch, date-range filter, **CSV export** (`/api/reports/export.csv`) and Print/PDF. |

Payment statuses: `Pending`, `Paid`, `Refunded`, plus `Cancelled` (an unpaid booking that was cancelled).

---

## 3. Project structure

```
car-rental-system/
├── server.js                 # Express app entry point
├── package.json
├── .env / .env.example       # configuration
├── config/
│   ├── db.js                 # MySQL connection pool (mysql2/promise)
│   └── constants.js          # enums shared by validators & models
├── database/
│   └── schema.sql            # tables + seed data
├── models/                   # SQL / business rules  (M)
│   ├── baseModel.js          #   generic CRUD factory
│   ├── vehicleModel.js  venueModel.js  staffModel.js  packageModel.js  membershipModel.js
│   ├── userModel.js  rentalModel.js  paymentModel.js  reportModel.js
├── controllers/              # request handling      (C)
│   ├── crudController.js     #   generic REST controller
│   ├── authController.js  vehicleController.js  venueController.js  staffController.js
│   ├── packageController.js  membershipController.js  rentalController.js
│   └── paymentController.js  reportController.js
├── routes/
│   ├── index.js              # all /api routes + access rules
│   └── pages.js              # HTML pages (with login / admin guards)
├── middleware/
│   ├── auth.js               # JWT, cookie, authenticate, requireAdmin, pageGuard
│   ├── validators.js         # express-validator rule sets
│   ├── rateLimit.js          # login brute-force limiter
│   └── errorHandler.js       # central error -> JSON mapping
├── utils/                    # pricing, date helpers, HttpError
├── views/                    # HTML pages (V)
│   ├── index.html  login.html  register.html  my-rentals.html  admin.html
├── public/                   # static assets
│   ├── css/style.css
│   └── js/app.js  home.js  rentals.js  admin.js
└── scripts/
    ├── setup-db.js           # runs schema.sql via Node
    └── reset-demo-passwords.js
```

---

## 4. REST API summary

`Auth` = any logged-in user, `Admin` = admin role. All bodies are JSON. Validation errors return `422 { message, errors:[{field,msg}] }`.

| Method & path | Access | Purpose |
|---|---|---|
| `POST /api/auth/register` `/login` `/logout` · `GET /api/auth/me` | Public | Session handling |
| `PUT /api/auth/membership` | Auth | Choose loyalty tier |
| `GET /api/users` · `PUT /api/users/:id/role` | Admin | User management |
| `GET /api/vehicles` (search/availability) · `GET /api/vehicles/types` · `GET /api/vehicles/:id` | Public | Customers see only `Available` cars; admins see the whole fleet |
| `POST/PUT/DELETE /api/vehicles[/:id]` | Admin | Vehicle CRUD |
| `GET /api/venues` · `/packages` · `/memberships` (+ `/:id`) | Public | Read (customers see only active packages) |
| `POST/PUT/DELETE` on `/api/venues`, `/packages`, `/memberships` | Admin | CRUD |
| `GET/POST/PUT/DELETE /api/staff[/:id]` | Admin | Staff CRUD (personal data, never public) |
| `POST /api/rentals/quote` | Public | Price + availability check |
| `POST /api/rentals` | Auth | Create booking + pending payment |
| `GET /api/rentals/mine` · `POST /api/rentals/:id/cancel` | Auth | Own bookings / cancel |
| `GET /api/rentals` · `PATCH /api/rentals/:id/status` | Admin | All bookings / change status |
| `POST /api/payments/:id/pay` | Auth | Mock payment |
| `GET /api/payments/mine` | Auth | Own payments |
| `GET /api/payments` · `/payments/logs` · `POST /api/payments/:id/refund` | Admin | Payments, audit log, refunds |
| `GET /api/reports/overview` · `/reports/export.csv` (`?from=&to=`) | Admin | Reports |

---

## 5. Suggested walkthrough (for demos / marking)

1. Home page: search **Any branch / Any type** with dates a few days ahead -> list of free cars.
2. Log in as `kavya@example.com`, book a car with the *Weekend Getaway* package -> see the live quote (package 5% + Gold 10%).
3. Pay with card `4242 4242 4242 4242` (success) or `4000 0000 0000 0000` (declined and logged).
4. Search the same dates again: the booked car has disappeared (availability).
5. Log in as admin -> **/admin**: Reports, Rentals (change status), Payments (refund / record cash), Payment log, and CRUD for every module.

---

## 6. Security notes

- Passwords: bcrypt hash, never returned by the API.
- Auth token: httpOnly + SameSite=Lax cookie (set `NODE_ENV=production` to also enforce `Secure` - requires HTTPS). In production a strong `JWT_SECRET` is mandatory; the server refuses to start without it.
- All SQL uses placeholders (no string-built values). All user-supplied text is HTML-escaped before display (XSS).
- Admin-only routes are enforced on the server (the UI hiding buttons is only cosmetic).
- Login/register are rate-limited (10 requests / 15 min / IP, in-memory - use Redis or a reverse proxy limiter if you run several instances).
- CSV export neutralises spreadsheet formula injection.
- Payment gateway is a **mock** for coursework: do not enter real card data. For a real system integrate a PCI-compliant provider (Stripe, PayHere, ...).

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `Could not connect to MySQL` | Check DB credentials in `.env`, make sure MySQL is running and you ran `npm run db:setup`. |
| `ER_NOT_SUPPORTED_AUTH_MODE` / auth plugin error | Use MySQL 8 with a user using `mysql_native_password` or `caching_sha2_password` (mysql2 supports both); recreate the user if needed. |
| Login fails for demo users | Run `npm run seed:users`, then log in with `Admin@123` / `User@123`. |
| `schema.sql` uses database `car_rental_db` | If you change `DB_NAME`, edit the first lines of `schema.sql` to match. |
| Fonts / jQuery do not load | The pages use Google Fonts and the cdnjs jQuery CDN; fonts fall back to system fonts offline, but jQuery needs internet (or download it into `public/js` and edit the `<script>` tags). |
