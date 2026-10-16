'use strict';
const express = require('express');
const crypto = require('node:crypto');
const loginSession = require('../lib/login-session');
const v = require('../lib/billing-values');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const parseJSON = value => typeof value === 'string' ? JSON.parse(value) : value;
const manage = user => ['admin', 'staff'].includes(user.role);
function invoice(row) {
  return { ...row, request_key: undefined, request_hash: undefined, snapshot: parseJSON(row.snapshot), items: parseJSON(row.items), number: `INV-${String(row.id).padStart(6, '0')}`, status: v.status(row), balance_cents: row.total_cents - row.paid_cents, is_simulated: true };
}
function receipt(row) { return { ...row, request_key: undefined, number: `RCT-${String(row.id).padStart(6, '0')}` }; }
module.exports = function billingRouter(db) {
  const router = express.Router();
  const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
  const requireManager = (req, res, next) => manage(req.billingUser) ? next() : res.status(403).json({ success: false, message: 'เฉพาะเจ้าหน้าที่และแอดมินเท่านั้น' });
  const accessible = (user, row) => { if (!row || parseJSON(row.snapshot)?.deleted || (!manage(user) && row.owner_id !== user.id)) v.fail('ไม่พบเอกสาร', 404); };
  async function transaction(fn) {
    const connection = await db.getConnection();
    try { await connection.beginTransaction(); const result = await fn(connection); await connection.commit(); return result; }
    catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  // Identity comes from the main login's HttpOnly cookie, not localStorage.
  router.use((req, res, next) => {
    Promise.resolve().then(async () => {
      const session = loginSession.read(req);
      if (!session) v.fail('กรุณาเข้าสู่ระบบจากหน้าแรก', 401);
      const [rows] = await db.execute('SELECT id, full_name, role, is_active FROM users WHERE id = ?', [session.id]);
      if (!rows[0] || !rows[0].is_active) {
        loginSession.end(req, res); v.fail('กรุณาเข้าสู่ระบบจากหน้าแรก', 401);
      }
      if (!['admin', 'staff', 'pet_owner'].includes(rows[0].role)) v.fail('บัญชีนี้ไม่มีสิทธิ์ใช้งานส่วนบิล', 403);
      req.billingUser = rows[0]; next();
    }).catch(next);
  });
  router.get('/me', (req, res) => res.json({ success: true, user: req.billingUser, simulated: true }));
  router.get('/customers', requireManager, wrap(async (req, res) => {
    const q = String(req.query.q || '').slice(0, 100);
    const [rows] = await db.execute(`SELECT p.id AS pet_id, p.name AS pet_name, u.id AS owner_id, u.full_name, u.phone
      FROM pets p JOIN users u ON u.id = p.user_id WHERE u.is_active = 1
      AND (p.name LIKE ? OR u.full_name LIKE ?) ORDER BY p.id DESC LIMIT 100`, [`%${q}%`, `%${q}%`]);
    res.json({ success: true, data: rows });
  }));
  router.get('/invoices', wrap(async (req, res) => {
    const params = [], where = ["JSON_EXTRACT(snapshot, '$.deleted') IS NULL"];
    if (!manage(req.billingUser)) { where.push('owner_id = ?'); params.push(req.billingUser.id); }
    if (req.query.before) { where.push('id < ?'); params.push(v.id(req.query.before)); }
    if (req.query.status && req.query.status !== 'all') {
      const conditions = { unpaid: 'paid_cents = 0', partial: 'paid_cents > 0 AND paid_cents < total_cents', paid: 'paid_cents = total_cents' };
      if (!Object.prototype.hasOwnProperty.call(conditions, req.query.status)) v.fail('สถานะไม่ถูกต้อง');
      where.push(`(${conditions[req.query.status]})`);
    }
    if (req.query.q) {
      where.push("(CONCAT('INV-', LPAD(id, 6, '0')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.owner.full_name')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.pet.name')) LIKE ?)");
      const q = `%${String(req.query.q).slice(0, 100)}%`; params.push(q, q, q);
    }
    const [rows] = await db.execute(`SELECT * FROM billing_invoices WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 51`, params);
    res.json({ success: true, data: rows.slice(0, 50).map(invoice), next: rows.length > 50 ? rows[49].id : null });
  }));
  router.get('/invoices/:id', wrap(async (req, res) => {
    const [rows] = await db.execute('SELECT * FROM billing_invoices WHERE id = ?', [v.id(req.params.id)]);
    accessible(req.billingUser, rows[0]);
    const [payments] = await db.execute('SELECT * FROM billing_payments WHERE invoice_id = ? ORDER BY id', [rows[0].id]);
    res.json({ success: true, data: { ...invoice(rows[0]), payments: payments.map(receipt) } });
  }));
  router.delete('/invoices/:id', requireManager, wrap(async (req, res) => {
    const invoiceId = v.id(req.params.id);
    await transaction(async connection => {
      // Same row lock as payment recording prevents a payment after deletion.
      const [rows] = await connection.execute('SELECT * FROM billing_invoices WHERE id = ? FOR UPDATE', [invoiceId]);
      if (!rows[0]) v.fail('ไม่พบเอกสาร', 404);
      const snapshot = parseJSON(rows[0].snapshot);
      if (snapshot.deleted) return; // Repeating DELETE is harmless.
      snapshot.deleted = { at: new Date().toISOString(), by: req.billingUser.id };
      await connection.execute('UPDATE billing_invoices SET snapshot = ? WHERE id = ?', [JSON.stringify(snapshot), invoiceId]);
    });
    res.json({ success: true, message: 'ลบใบแจ้งหนี้ออกจากรายการแล้ว' });
  }));
  router.get('/receipts/:id', wrap(async (req, res) => {
    const [payments] = await db.execute('SELECT * FROM billing_payments WHERE id = ?', [v.id(req.params.id)]);
    if (!payments[0]) v.fail('ไม่พบใบเสร็จ', 404);
    const [rows] = await db.execute('SELECT * FROM billing_invoices WHERE id = ?', [payments[0].invoice_id]);
    accessible(req.billingUser, rows[0]);
    res.json({ success: true, data: { receipt: receipt(payments[0]), invoice: invoice(rows[0]) } });
  }));
  router.post('/invoices', requireManager, wrap(async (req, res) => {
    const input = v.invoiceInput(req.body || {}), requestKey = v.key(req.get('Idempotency-Key'));
    const requestHash = hash(JSON.stringify(input));
    const existing = async () => {
      const [rows] = await db.execute('SELECT * FROM billing_invoices WHERE request_key = ?', [requestKey]);
      if (!rows[0]) return null;
      if (rows[0].created_by !== req.billingUser.id || rows[0].request_hash !== requestHash) v.fail('รหัสคำขอถูกใช้กับข้อมูลอื่นแล้ว', 409);
      accessible(req.billingUser, rows[0]);
      return invoice(rows[0]);
    };
    let data = await existing();
    if (data) return res.json({ success: true, data });
    try {
      data = await transaction(async connection => {
        const [pets] = await connection.execute('SELECT p.*, u.full_name, u.email, u.phone, u.is_active FROM pets p JOIN users u ON u.id = p.user_id WHERE p.id = ? FOR SHARE', [input.pet_id]);
        const pet = pets[0];
        if (!pet || !pet.is_active) v.fail('ไม่พบสัตว์เลี้ยงหรือเจ้าของถูกระงับ');
        const [clinics] = await connection.execute('SELECT name, address, phone, email, tax_id FROM clinic_info WHERE id = 1 FOR SHARE');
        if (!clinics[0]) v.fail('กรุณาตั้งค่าข้อมูลคลินิกก่อนออกบิล');
        const snapshot = { clinic: clinics[0], owner: { id: pet.user_id, full_name: pet.full_name, email: pet.email, phone: pet.phone }, pet: { id: pet.id, name: pet.name, type: pet.type }, issued_by: req.billingUser.full_name, payment_instructions: input.payment_instructions, delivery: { channel: 'in_app', sent_at: new Date().toISOString(), recipient_id: pet.user_id } };
        const [result] = await connection.execute(`INSERT INTO billing_invoices
          (owner_id, pet_id, created_by, request_key, request_hash, snapshot, items, subtotal_cents, discount_cents, total_cents, note, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [pet.user_id, pet.id, req.billingUser.id, requestKey, requestHash, JSON.stringify(snapshot), JSON.stringify(input.items), input.subtotal_cents, input.discount_cents, input.total_cents, input.note, new Date().toISOString()]);
        const [rows] = await connection.execute('SELECT * FROM billing_invoices WHERE id = ?', [result.insertId]);
        return invoice(rows[0]);
      });
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      data = await existing(); if (!data) throw error;
    }
    res.status(201).json({ success: true, data });
  }));
  router.post('/invoices/:id/payments', requireManager, wrap(async (req, res) => {
    if (req.body?.simulated !== true) v.fail('ระบบนี้รองรับการชำระเงินจำลองเท่านั้น');
    const invoiceId = v.id(req.params.id), input = v.paymentInput(req.body), requestKey = v.key(req.get('Idempotency-Key'));
    const verifyReplay = row => {
      if (row.invoice_id !== invoiceId || row.recorded_by !== req.billingUser.id || row.amount_cents !== input.amount_cents || row.method !== input.method || row.reference !== input.reference) v.fail('รหัสคำขอถูกใช้กับข้อมูลอื่นแล้ว', 409);
      return receipt(row);
    };
    let data;
    try {
      data = await transaction(async connection => {
        // Serialize payments for this invoice, including duplicate button presses and concurrent requests.
        const [rows] = await connection.execute('SELECT * FROM billing_invoices WHERE id = ? FOR UPDATE', [invoiceId]);
        accessible(req.billingUser, rows[0]);
        const [prior] = await connection.execute('SELECT * FROM billing_payments WHERE request_key = ? FOR UPDATE', [requestKey]);
        if (prior[0]) return verifyReplay(prior[0]);
        const balance = rows[0].total_cents - rows[0].paid_cents;
        if (input.amount_cents > balance) v.fail('ยอดชำระเกินยอดคงเหลือ กรุณาโหลดบิลอีกครั้ง', 409);
        const [result] = await connection.execute(`INSERT INTO billing_payments
          (invoice_id, recorded_by, request_key, amount_cents, method, reference, is_simulated, balance_after_cents, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`, [invoiceId, req.billingUser.id, requestKey, input.amount_cents, input.method, input.reference, balance - input.amount_cents, new Date().toISOString()]);
        await connection.execute('UPDATE billing_invoices SET paid_cents = paid_cents + ? WHERE id = ?', [input.amount_cents, invoiceId]);
        const [payments] = await connection.execute('SELECT * FROM billing_payments WHERE id = ?', [result.insertId]);
        return receipt(payments[0]);
      });
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      const [prior] = await db.execute('SELECT * FROM billing_payments WHERE request_key = ?', [requestKey]);
      if (!prior[0]) throw error;
      data = verifyReplay(prior[0]);
    }
    res.status(201).json({ success: true, data });
  }));
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const missing = error.code === 'ER_NO_SUCH_TABLE';
    if (!error.status) console.error('Billing error:', error.code || error.name);
    res.status(error.status || (missing ? 503 : 500)).json({ success: false, message: error.status ? error.message : missing ? 'ส่วนบิลยังไม่พร้อม กรุณาตรวจฐานข้อมูลและเริ่มเซิร์ฟเวอร์ใหม่' : 'ไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง' });
  });
  return router;
};
