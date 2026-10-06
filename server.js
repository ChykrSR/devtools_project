const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// เชื่อมต่อ MySQL Database
const db = mysql.createPool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword',
  database: process.env.DB_NAME || 'mydb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 1. API สมัครสมาชิก (Register)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { full_name, email, password, phone, role } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
    }

    // เช็คว่า Email ซ้ำไหม
    const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, message: 'อีเมลนี้ถูกใช้งานในระบบแล้ว' });
    }

    // บันทึกลง MySQL ตรงๆ
    const userRole = role || 'pet_owner';
    const [result] = await db.execute(
      'INSERT INTO users (full_name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
      [full_name, email, password, phone || '', userRole]
    );

    res.status(201).json({
      success: true,
      message: 'ลงทะเบียนสำเร็จเรียบร้อย',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

// 2. API เข้าสู่ระบบ (Login)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }

    // เช็คอีเมลและรหัสผ่านตรงๆ จากคอลัมน์
    const [users] = await db.execute(
      'SELECT id, full_name, email, phone, role FROM users WHERE email = ? AND password = ?',
      [email, password]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = users[0];

    res.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      user: user
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});