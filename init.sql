CREATE DATABASE IF NOT EXISTS mydb;
USE mydb;

-- 1. สร้างตาราง users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('pet_owner', 'vet', 'staff', 'admin') DEFAULT 'pet_owner',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. สร้างตาราง pets (UC-02)
CREATE TABLE IF NOT EXISTS pets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    type ENUM('dog', 'cat', 'bird', 'rabbit', 'other') NOT NULL DEFAULT 'dog',
    breed VARCHAR(100),
    age VARCHAR(50),
    gender ENUM('male', 'female', 'unknown') DEFAULT 'unknown',
    weight DECIMAL(5,2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Mock Data: Users (id=1 Admin, id=2 Pet Owner)
INSERT IGNORE INTO users (id, full_name, email, password, phone, role) VALUES 
(1, 'Admin Clinic', 'admin@petclinic.com', '123456', '0812345678', 'admin'),
(2, 'สมชาย ใจดี', 'somchai@gmail.com', '123456', '0812345678', 'pet_owner');

-- Mock Data: Pets (ผูกกับ user_id = 2 ของสมชาย ใจดี)
INSERT IGNORE INTO pets (id, user_id, name, type, breed, age, gender, weight, notes) VALUES
(1, 2, 'โคล่า', 'dog', 'โกลเด้น รีทรีฟเวอร์', '3 ปี', 'male', 28.50, 'แพ้อาหารทะเล'),
(2, 2, 'ส้มส้ม', 'cat', 'เปอร์เซีย', '1 ปี 6 เดือน', 'female', 4.20, 'ทำหมันแล้ว');

ALTER TABLE users ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER role;

-- 3. Clinic Info Table (UC-11)
CREATE TABLE IF NOT EXISTS clinic_info (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(100),
    tax_id VARCHAR(50),
    opening_hours VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed ข้อมูลเริ่มต้นของคลินิก
INSERT INTO clinic_info (id, name, address, phone, email, tax_id, opening_hours)
VALUES (
    1, 
    'Pet Care Clinic', 
    '123/45 ถนนพหลโยธิน แขวงอนุสาวรีย์ เขตบางเขน กรุงเทพฯ 10220', 
    '02-123-4567', 
    'contact@petcareclinic.com', 
    '0105560000000', 
    'จันทร์ - อาทิตย์: 09:00 - 20:00 น.'
)
ON DUPLICATE KEY UPDATE id=1;

-- BEGIN BILLING SCHEMA
CREATE TABLE IF NOT EXISTS billing_invoices (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  pet_id INT NOT NULL,
  created_by INT NOT NULL,
  request_key VARCHAR(80) NOT NULL UNIQUE,
  request_hash CHAR(64) NOT NULL,
  snapshot JSON NOT NULL,
  items JSON NOT NULL,
  subtotal_cents INT UNSIGNED NOT NULL,
  discount_cents INT UNSIGNED NOT NULL DEFAULT 0,
  total_cents INT UNSIGNED NOT NULL,
  paid_cents INT UNSIGNED NOT NULL DEFAULT 0,
  note VARCHAR(1000) NOT NULL DEFAULT '',
  created_at VARCHAR(24) NOT NULL,
  INDEX billing_owner_created (owner_id, id),
  CONSTRAINT billing_amounts CHECK (total_cents > 0 AND paid_cents <= total_cents AND subtotal_cents = total_cents + discount_cents)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS billing_payments (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  recorded_by INT NOT NULL,
  request_key VARCHAR(80) NOT NULL UNIQUE,
  amount_cents INT UNSIGNED NOT NULL,
  method ENUM('cash', 'transfer', 'card') NOT NULL,
  reference VARCHAR(200) NOT NULL DEFAULT '',
  is_simulated TINYINT(1) NOT NULL DEFAULT 1,
  balance_after_cents INT UNSIGNED NOT NULL,
  created_at VARCHAR(24) NOT NULL,
  INDEX billing_payment_invoice (invoice_id, id),
  CONSTRAINT billing_payment_invoice_fk FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id) ON DELETE RESTRICT,
  CONSTRAINT billing_payment_positive CHECK (amount_cents > 0),
  CONSTRAINT billing_payment_demo_only CHECK (is_simulated = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- END BILLING SCHEMA
