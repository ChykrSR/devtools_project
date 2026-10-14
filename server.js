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

//health check endpoint ให้ jenkins
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

// ==========================================
// UC-11: User & Clinic Management APIs
// ==========================================

// 1. ดึงรายการผู้ใช้งานทั้งหมด (รองรับ Search & Filter Role)
app.get('/api/users', async (req, res) => {
    try {
        const { search, role } = req.query;
        let sql = 'SELECT id, full_name, email, phone, role, is_active, created_at FROM users WHERE 1=1';
        const params = [];

        if (role && role !== 'all') {
            sql += ' AND role = ?';
            params.push(role);
        }

        if (search) {
            sql += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            const searchKeyword = `%${search}%`;
            params.push(searchKeyword, searchKeyword, searchKeyword);
        }

        sql += ' ORDER BY id DESC';
        const [users] = await db.query(sql, params);

        res.json({ success: true, message: 'Fetch users successfully', data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, data: null });
    }
});

// 2. เพิ่มผู้ใช้ใหม่โดย Admin
app.post('/api/users', async (req, res) => {
   try {
        const { full_name, email, password, phone, role } = req.body;
        
        if (!full_name || !email || !password) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน' });
        }

        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้วในระบบ' });
        }

        const [result] = await db.query(
            'INSERT INTO users (full_name, email, password, phone, role, is_active) VALUES (?, ?, ?, ?, ?, 1)',
            [full_name, email, password, phone || '', role || 'pet_owner']
        );

        res.json({ success: true, message: 'เพิ่มผู้ใช้งานเรียบร้อยแล้ว', data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, data: null });
    }
});

// 3. แก้ไขข้อมูลผู้ใช้
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, email, phone, role, is_active } = req.body;

        await db.query(
            'UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?, is_active = ? WHERE id = ?',
            [full_name, email, phone, role, is_active, id]
        );

        res.json({ success: true, message: 'อัปเดตข้อมูลผู้ใช้เรียบร้อยแล้ว', data: null });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, data: null });
    }
});

// 4. ดึงข้อมูลคลินิก
app.get('/api/clinic', async (req, res) => {
   try {
        const [rows] = await db.query('SELECT * FROM clinic_info WHERE id = 1');
        const clinic = rows[0] || {};
        res.json({ success: true, message: 'Fetch clinic info successfully', data: clinic });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, data: null });
    }
});

// 5. อัปเดตข้อมูลคลินิก
app.get('/api/clinic', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM clinic_info WHERE id = 1');
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลคลินิก' });
    }
    // ส่งออกคีย์ชื่อ clinic
    res.json({ success: true, clinic: rows[0] });
  } catch (error) {
    console.error('Fetch Clinic Error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคลินิก' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ==========================================
// UC-04: API สำหรับการจองคิวนัดหมาย (Booking)
// ==========================================

// ดึงรายการสัตว์เลี้ยงของ User
app.get('/api/pets/user/:userId', (req, res) => {
    const { userId } = req.params;
    const sql = 'SELECT * FROM pets WHERE owner_id = ? OR user_id = ?';
    db.query(sql, [userId, userId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true, pets: results });
    });
});

// สร้างรายการจองคิวใหม่
app.post('/api/appointments', (req, res) => {
    const { user_id, pet_id, appointment_date, appointment_time, reason } = req.body;
    const sql = 'INSERT INTO appointments (user_id, pet_id, appointment_date, appointment_time, reason) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [user_id, pet_id, appointment_date, appointment_time, reason], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'จองคิวไม่สำเร็จ: ' + err.message });
        res.json({ success: true, message: 'จองคิวสำเร็จเรียบร้อยแล้ว!' });
    });
});

// ดึงรายการจองคิวเฉพาะของ User
app.get('/api/appointments/user/:userId', (req, res) => {
    const { userId } = req.params;
    const sql = `
        SELECT a.*, p.name AS pet_name, p.type AS pet_type 
        FROM appointments a
        JOIN pets p ON a.pet_id = p.id
        WHERE a.user_id = ?
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `;
    db.query(sql, [userId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true, appointments: results });
    });
});

// ==========================================
// UC-07: API สำหรับจัดการคิว (Staff/Vet)
// ==========================================

// ดึงรายการคิวทั้งหมดตาม วันที่ และ สถานะ
app.get('/api/appointments', (req, res) => {
    const { date, status } = req.query;
    let sql = `
        SELECT a.*, p.name AS pet_name, p.type AS pet_type, u.full_name AS owner_name, u.phone AS owner_phone
        FROM appointments a
        JOIN pets p ON a.pet_id = p.id
        JOIN users u ON a.user_id = u.id
        WHERE 1=1
    `;
    const params = [];

    if (date) {
        sql += ' AND a.appointment_date = ?';
        params.push(date);
    }
    if (status && status !== 'all') {
        sql += ' AND a.status = ?';
        params.push(status);
    }

    sql += ' ORDER BY a.appointment_time ASC';

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true, appointments: results });
    });
});

// ดึงรายละเอียดคิวนัดหมายรายอัน
app.get('/api/appointments/:id', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT a.*, p.name AS pet_name, p.type AS pet_type, u.full_name AS owner_name
        FROM appointments a
        JOIN pets p ON a.pet_id = p.id
        JOIN users u ON a.user_id = u.id
        WHERE a.id = ?
    `;
    db.query(sql, [id], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลนัดหมาย' });
        res.json({ success: true, appointment: results[0] });
    });
});

// อัปเดตสถานะคิว
app.put('/api/appointments/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const sql = 'UPDATE appointments SET status = ? WHERE id = ?';
    db.query(sql, [status, id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'อัปเดตสถานะไม่สำเร็จ' });
        res.json({ success: true, message: 'อัปเดตสถานะคิวสำเร็จ' });
    });
});

// ==========================================
// UC-09: API สำหรับการวินิจฉัยและสั่งยา (Vet)
// ==========================================

// บันทึกการรักษา / สั่งยา
app.post('/api/prescriptions', (req, res) => {
    const { appointment_id, vet_id, diagnosis, medication_details, service_details } = req.body;

    const sqlPrescription = 'INSERT INTO prescriptions (appointment_id, vet_id, diagnosis, medication_details, service_details) VALUES (?, ?, ?, ?, ?)';
    
    db.query(sqlPrescription, [appointment_id, vet_id, diagnosis, medication_details, service_details], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'บันทึกการรักษาไม่สำเร็จ: ' + err.message });

        // เมื่อบันทึกการรักษาเสร็จ ให้เปลี่ยนสถานะคิวเป็น 'completed' ทันที
        const sqlUpdateAppointment = "UPDATE appointments SET status = 'completed' WHERE id = ?";
        db.query(sqlUpdateAppointment, [appointment_id], (err2) => {
            if (err2) console.error('Error updating status:', err2);
            res.json({ success: true, message: 'บันทึกการรักษาและปิดคิวเรียบร้อยแล้ว!' });
        });
    });
});