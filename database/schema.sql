-- =====================================================================
--  Car Rental Management System  -  MySQL schema + seed data
--  WARNING: this script DROPS and recreates all tables (demo data reset)
--  Run:  mysql -u root -p < database/schema.sql
--  Demo logins (password for both accounts is: password)
--     admin@carrental.com   (admin)
--     nimal@example.com     (customer, Silver)
--     kavya@example.com     (customer, Gold)
--  Tip: `npm run seed:users` re-hashes them to Admin@123 / User@123.
-- =====================================================================
CREATE DATABASE IF NOT EXISTS car_rental_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE car_rental_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS payment_logs;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS rentals;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS packages;
DROP TABLE IF EXISTS memberships;
DROP TABLE IF EXISTS venues;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------- Venues (pickup / drop-off branches) ----------
CREATE TABLE venues (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  address     VARCHAR(255) NOT NULL,
  city        VARCHAR(80)  NOT NULL,
  phone       VARCHAR(25)  NULL,
  opening_hours VARCHAR(80) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Memberships (loyalty tiers) ----------
CREATE TABLE memberships (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(60) NOT NULL UNIQUE,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  annual_fee       DECIMAL(10,2) NOT NULL DEFAULT 0,
  benefits         VARCHAR(255) NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Packages (rental bundles / add-ons / deals) ----------
CREATE TABLE packages (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(80) NOT NULL UNIQUE,
  description      VARCHAR(255) NULL,
  extra_daily_fee  DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2)  NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  min_days         INT UNSIGNED  NOT NULL DEFAULT 1,
  active           TINYINT(1)    NOT NULL DEFAULT 1,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Staff (branch employees; "trainers" module of the brief) ----------
CREATE TABLE staff (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(120) NOT NULL UNIQUE,
  phone      VARCHAR(25)  NULL,
  position   VARCHAR(60)  NOT NULL,
  venue_id   INT UNSIGNED NULL,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_venue FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Vehicles ----------
CREATE TABLE vehicles (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  make          VARCHAR(60) NOT NULL,
  model         VARCHAR(60) NOT NULL,
  year          SMALLINT UNSIGNED NOT NULL,
  license_plate VARCHAR(20) NOT NULL UNIQUE,
  type          ENUM('Sedan','Hatchback','SUV','Van','Pickup','Luxury') NOT NULL,
  seats         TINYINT UNSIGNED NOT NULL DEFAULT 5,
  daily_rate    DECIMAL(10,2) NOT NULL CHECK (daily_rate > 0),
  status        ENUM('Available','Maintenance','Retired') NOT NULL DEFAULT 'Available',
  venue_id      INT UNSIGNED NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vehicle_search (venue_id, type, status),
  CONSTRAINT fk_vehicle_venue FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Users ----------
CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  phone         VARCHAR(25)  NULL,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  membership_id INT UNSIGNED NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_membership FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Rentals ----------
-- A rental occupies the vehicle for [start_date, end_date): the return day is free for a new pickup.
CREATE TABLE rentals (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          INT UNSIGNED NOT NULL,
  vehicle_id       INT UNSIGNED NOT NULL,
  pickup_venue_id  INT UNSIGNED NOT NULL,
  dropoff_venue_id INT UNSIGNED NOT NULL,
  package_id       INT UNSIGNED NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  days             INT UNSIGNED NOT NULL,
  subtotal         DECIMAL(12,2) NOT NULL,
  discount_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount     DECIMAL(12,2) NOT NULL,
  status           ENUM('Pending','Confirmed','Active','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rental_vehicle_dates (vehicle_id, start_date, end_date),
  INDEX idx_rental_user (user_id),
  CONSTRAINT chk_dates CHECK (end_date > start_date),
  CONSTRAINT fk_rental_user    FOREIGN KEY (user_id)          REFERENCES users(id),
  CONSTRAINT fk_rental_vehicle FOREIGN KEY (vehicle_id)       REFERENCES vehicles(id),
  CONSTRAINT fk_rental_pickup  FOREIGN KEY (pickup_venue_id)  REFERENCES venues(id),
  CONSTRAINT fk_rental_dropoff FOREIGN KEY (dropoff_venue_id) REFERENCES venues(id),
  CONSTRAINT fk_rental_package FOREIGN KEY (package_id)       REFERENCES packages(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Payments ----------
CREATE TABLE payments (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rental_id       INT UNSIGNED NOT NULL,
  user_id         INT UNSIGNED NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  method          ENUM('Card','Bank Transfer','Cash') NULL,
  status          ENUM('Pending','Paid','Refunded','Cancelled') NOT NULL DEFAULT 'Pending',
  transaction_ref VARCHAR(40) NULL UNIQUE,
  card_last4      CHAR(4) NULL,
  paid_at         DATETIME NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payment_status (status),
  CONSTRAINT fk_payment_rental FOREIGN KEY (rental_id) REFERENCES rentals(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_user   FOREIGN KEY (user_id)   REFERENCES users(id)
) ENGINE=InnoDB;

-- ---------- Payment transaction log (audit trail) ----------
CREATE TABLE payment_logs (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id INT UNSIGNED NOT NULL,
  event      VARCHAR(30)  NOT NULL,
  message    VARCHAR(255) NULL,
  amount     DECIMAL(12,2) NULL,
  actor_id   INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_log_payment (payment_id),
  CONSTRAINT fk_log_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
--  SEED DATA
-- =====================================================================
INSERT INTO venues (id, name, address, city, phone, opening_hours) VALUES
 (1, 'Jaffna Town Branch',      '112 Hospital Road',          'Jaffna',   '021-222-1100', '07:00 - 20:00'),
 (2, 'Colombo Airport Desk',    'Bandaranaike Intl Airport',  'Katunayake','011-225-0200', '24 hours'),
 (3, 'Kandy City Branch',       '45 Peradeniya Road',         'Kandy',    '081-222-3300', '07:30 - 19:30'),
 (4, 'Galle Fort Branch',       '8 Church Street, Galle Fort','Galle',    '091-224-4400', '08:00 - 19:00');

INSERT INTO memberships (id, name, discount_percent, annual_fee, benefits) VALUES
 (1, 'Standard', 0.00,  0.00,     'Free account, booking history'),
 (2, 'Silver',   5.00,  5000.00,  '5% off every rental, priority support'),
 (3, 'Gold',    10.00, 12000.00,  '10% off, free additional driver, free upgrade when available'),
 (4, 'Platinum',15.00, 25000.00,  '15% off, free airport delivery, 24/7 roadside concierge');

INSERT INTO packages (id, name, description, extra_daily_fee, discount_percent, min_days, active) VALUES
 (1, 'Standard Rental',      'Vehicle only, standard basic insurance',                    0.00,    0.00, 1, 1),
 (2, 'Full Cover Insurance', 'Zero-excess comprehensive insurance and tyre cover',      1500.00,  0.00, 1, 1),
 (3, 'Weekly Saver',         '10% off when you keep the car 7 days or more',               0.00, 10.00, 7, 1),
 (4, 'Chauffeur Add-on',     'Professional driver for the whole rental',                4000.00,  0.00, 1, 1),
 (5, 'Weekend Getaway',      '5% off for trips of 2+ days, unlimited mileage',             0.00,  5.00, 2, 1);

INSERT INTO staff (id, name, email, phone, position, venue_id, active) VALUES
 (1, 'Suresh Kumar',     'suresh@carrental.com',  '077-100-1001', 'Branch Manager',        1, 1),
 (2, 'Anjali Perera',    'anjali@carrental.com',  '077-100-1002', 'Customer Service Agent',2, 1),
 (3, 'Dilshan Fernando', 'dilshan@carrental.com', '077-100-1003', 'Fleet Mechanic',        2, 1),
 (4, 'Thevaki Selvam',   'thevaki@carrental.com', '077-100-1004', 'Reservations Officer',  1, 1),
 (5, 'Ruwan Silva',      'ruwan@carrental.com',   '077-100-1005', 'Branch Manager',        3, 1),
 (6, 'Nadeesha Jayawardena','nadeesha@carrental.com','077-100-1006','Customer Service Agent',4, 1);

INSERT INTO vehicles (id, make, model, year, license_plate, type, seats, daily_rate, status, venue_id) VALUES
 (1,  'Toyota',        'Axio',            2018, 'CAB-1234', 'Sedan',     5,  8500.00, 'Available',   1),
 (2,  'Toyota',        'Prius',           2017, 'CBD-4521', 'Hatchback', 5,  9500.00, 'Available',   1),
 (3,  'Suzuki',        'Alto',            2019, 'NP-5522',  'Hatchback', 4,  5500.00, 'Available',   1),
 (4,  'Honda',         'Vezel',           2018, 'CBF-7788', 'SUV',       5, 12000.00, 'Available',   2),
 (5,  'Toyota',        'Land Cruiser Prado',2016,'WP-KA-3090','SUV',     7, 22000.00, 'Available',   2),
 (6,  'Toyota',        'HiAce',           2017, 'CAD-9012', 'Van',       12,16000.00, 'Available',   2),
 (7,  'Mercedes-Benz', 'E200',            2019, 'CBM-2020', 'Luxury',    5, 35000.00, 'Available',   2),
 (8,  'Nissan',        'Sunny',           2015, 'KY-3344',  'Sedan',     5,  7000.00, 'Available',   3),
 (9,  'Toyota',        'Hilux',           2018, 'CP-HX-6611','Pickup',   5, 18000.00, 'Available',   3),
 (10, 'Mitsubishi',    'Montero',         2017, 'CP-KB-8800','SUV',      7, 19000.00, 'Maintenance', 3),
 (11, 'BMW',           '520d',            2018, 'SP-BM-5200','Luxury',   5, 38000.00, 'Available',   4),
 (12, 'Suzuki',        'Wagon R',         2020, 'SP-WR-1020','Hatchback',4,  6000.00, 'Available',   4);

-- password hash below = bcrypt("password")
INSERT INTO users (id, name, email, phone, password_hash, role, membership_id) VALUES
 (1, 'System Admin',  'admin@carrental.com', '077-000-0000', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin',    1),
 (2, 'Nimal Rajan',   'nimal@example.com',   '077-222-3344', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer', 2),
 (3, 'Kavya Sivakumar','kavya@example.com',  '076-555-8899', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer', 3);

INSERT INTO rentals (id, user_id, vehicle_id, pickup_venue_id, dropoff_venue_id, package_id, start_date, end_date, days, subtotal, discount_amount, total_amount, status) VALUES
 (1,  2, 1,  1, 1, 1, '2026-07-05', '2026-07-08', 3,  25500.00,  1275.00,  24225.00, 'Completed'),
 (2,  3, 4,  2, 2, 2, '2026-07-20', '2026-07-25', 5,  67500.00,  6750.00,  60750.00, 'Completed'),
 (3,  2, 7,  2, 1, 5, '2026-08-14', '2026-08-17', 3, 105000.00, 10237.50,  94762.50, 'Completed'),
 (4,  3, 6,  2, 2, 3, '2026-08-01', '2026-08-08', 7, 112000.00, 21280.00,  90720.00, 'Completed'),
 (5,  2, 3,  1, 1, 1, '2026-09-10', '2026-09-12', 2,  11000.00,   550.00,  10450.00, 'Completed'),
 (6,  3, 2,  1, 1, 2, '2026-10-10', '2026-10-15', 5,  55000.00,  5500.00,  49500.00, 'Active'),
 (7,  2, 5,  2, 2, 4, '2026-10-20', '2026-10-23', 3,  78000.00,  3900.00,  74100.00, 'Confirmed'),
 (8,  3, 9,  3, 3, 1, '2026-10-25', '2026-10-27', 2,  36000.00,  3600.00,  32400.00, 'Pending'),
 (9,  2, 11, 4, 4, 2, '2026-09-20', '2026-09-22', 2,  79000.00,  3950.00,  75050.00, 'Cancelled'),
 (10, 3, 1,  1, 3, 5, '2026-09-26', '2026-09-28', 2,  17000.00,  2465.00,  14535.00, 'Completed');

INSERT INTO payments (id, rental_id, user_id, amount, method, status, transaction_ref, card_last4, paid_at) VALUES
 (1,  1,  2,  24225.00, 'Card',          'Paid',     'TXN-SEED-0001', '4242', '2026-07-01 10:15:00'),
 (2,  2,  3,  60750.00, 'Card',          'Paid',     'TXN-SEED-0002', '1111', '2026-07-15 14:02:00'),
 (3,  3,  2,  94762.50, 'Bank Transfer', 'Paid',     'TXN-SEED-0003', NULL,   '2026-08-10 09:30:00'),
 (4,  4,  3,  90720.00, 'Card',          'Paid',     'TXN-SEED-0004', '1111', '2026-07-28 16:45:00'),
 (5,  5,  2,  10450.00, 'Cash',          'Paid',     'TXN-SEED-0005', NULL,   '2026-09-10 08:10:00'),
 (6,  6,  3,  49500.00, 'Card',          'Paid',     'TXN-SEED-0006', '1111', '2026-10-08 11:20:00'),
 (7,  7,  2,  74100.00, 'Card',          'Paid',     'TXN-SEED-0007', '4242', '2026-10-11 18:05:00'),
 (8,  8,  3,  32400.00, NULL,            'Pending',  'TXN-SEED-0008', NULL,   NULL),
 (9,  9,  2,  75050.00, 'Card',          'Refunded', 'TXN-SEED-0009', '4242', '2026-09-15 12:00:00'),
 (10, 10, 3,  14535.00, 'Card',          'Paid',     'TXN-SEED-0010', '1111', '2026-09-24 13:40:00');

INSERT INTO payment_logs (payment_id, event, message, amount, actor_id, created_at) VALUES
 (1, 'CREATED', 'Payment record created with booking',        24225.00, 2, '2026-07-01 10:10:00'),
 (1, 'PAID',    'Card payment approved (mock gateway)',       24225.00, 2, '2026-07-01 10:15:00'),
 (6, 'CREATED', 'Payment record created with booking',        49500.00, 3, '2026-10-08 11:15:00'),
 (6, 'PAID',    'Card payment approved (mock gateway)',       49500.00, 3, '2026-10-08 11:20:00'),
 (8, 'CREATED', 'Payment record created with booking',        32400.00, 3, '2026-10-12 09:00:00'),
 (9, 'CREATED', 'Payment record created with booking',        75050.00, 2, '2026-09-15 11:55:00'),
 (9, 'PAID',    'Card payment approved (mock gateway)',       75050.00, 2, '2026-09-15 12:00:00'),
 (9, 'REFUNDED','Booking cancelled - full refund issued',     75050.00, 1, '2026-09-16 10:00:00');
