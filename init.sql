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