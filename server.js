const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// เชื่อมต่อ MySQL Database
const db = mysql.createPool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'secret',
  database: process.env.DB_NAME || 'mydb',
  waitForConnections: true,
  connectionLimit: 10
});

// API ดึงข้อมูล
app.get('/api/users', (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// API สำหรับให้ Jenkins ตรวจสอบสถานะการทำงาน (Health Check)
app.get('/health', (req, res) => {
  db.query('SELECT 1', (err) => {
    if (err) return res.status(500).send('Database connection failed');
    res.status(200).send('OK');
  });
});

app.listen(3000, () => console.log('Server running on port 3000'));