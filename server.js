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

// ==========================================
// PET PROFILE APIs (UC-02)
// ==========================================

// 1. ดึงรายการสัตว์เลี้ยงทั้งหมดของผู้ใช้ (Read All)
app.get('/api/pets/user/:userId', async (req, res) => {
 try {
    const { userId } = req.params;
    
    // ป้องกันกรณี userId ไม่ส่งมา หรือส่ง 'undefined'
    if (!userId || userId === 'undefined') {
      return res.status(400).json({ success: false, message: 'Invalid User ID' });
    }

    const [pets] = await db.execute(
      'SELECT * FROM pets WHERE user_id = ? ORDER BY id DESC',
      [userId]
    );
    res.json({ success: true, pets: pets });
  } catch (error) {
    console.error('Fetch Pets Error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดจากฐานข้อมูล' });
  }
});

// 2. ดึงข้อมูลสัตว์เลี้ยงเฉพาะตัว (Read Single)
app.get('/api/pets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [pets] = await db.execute('SELECT * FROM pets WHERE id = ?', [id]);
    if (pets.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสัตว์เลี้ยง' });
    }
    res.json({ success: true, pet: pets[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

// 3. เพิ่มสัตว์เลี้ยงใหม่ (Create)
app.post('/api/pets', async (req, res) => {
  try {
    const { user_id, name, type, breed, age, gender, weight, notes } = req.body;

    if (!user_id || !name || !type) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน' });
    }

    const [result] = await db.execute(
      `INSERT INTO pets (user_id, name, type, breed, age, gender, weight, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, name, type, breed || '', age || '', gender || 'unknown', weight || 0.00, notes || '']
    );

    res.status(201).json({
      success: true,
      message: 'บันทึกข้อมูลสัตว์เลี้ยงสำเร็จ',
      petId: result.insertId
    });
  } catch (error) {
    console.error('Add Pet Error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูล' });
  }
});

// 4. แก้ไขข้อมูลสัตว์เลี้ยง (Update)
app.put('/api/pets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, breed, age, gender, weight, notes } = req.body;

    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน' });
    }

    const [result] = await db.execute(
      `UPDATE pets 
       SET name = ?, type = ?, breed = ?, age = ?, gender = ?, weight = ?, notes = ?
       WHERE id = ?`,
      [name, type, breed || '', age || '', gender || 'unknown', weight || 0.00, notes || '', id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสัตว์เลี้ยงที่ต้องการแก้ไข' });
    }

    res.json({ success: true, message: 'อัปเดตข้อมูลสัตว์เลี้ยงเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Update Pet Error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' });
  }
});

// 5. ลบสัตว์เลี้ยง (Delete)
app.delete('/api/pets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.execute('DELETE FROM pets WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสัตว์เลี้ยง' });
    }

    res.json({ success: true, message: 'ลบข้อมูลสัตว์เลี้ยงเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Delete Pet Error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});