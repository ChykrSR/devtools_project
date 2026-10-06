CREATE DATABASE IF NOT EXISTS mydb;
USE mydb;

-- สร้างตาราง users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('pet_owner', 'vet', 'staff', 'admin') DEFAULT 'pet_owner',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mock Data สำหรับทดสอบ Login (รหัสผ่านคือ: 123456)
INSERT IGNORE INTO users (id, full_name, email, password, phone, role) 
VALUES (
    1, 
    'Admin Clinic', 
    'admin@petclinic.com', 
    '123456', 
    '0812345678', 
    'admin'
);