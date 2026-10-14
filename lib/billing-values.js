'use strict';
const MAX_CENTS = 100000000; // 1,000,000 THB per document
function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function cents(value) {
  if (!['string', 'number'].includes(typeof value) || !/^(0|[1-9]\d{0,6})(\.\d{1,2})?$/.test(String(value)))
    fail('จำนวนเงินต้องเป็นเลขไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง');
  const [whole, fraction = ''] = String(value).split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (result > MAX_CENTS) fail('จำนวนเงินเกินขีดจำกัด 1,000,000 บาท');
  return result;
}
function id(value) {
  if (!/^[1-9]\d{0,9}$/.test(String(value)) || Number(value) > 2147483647) fail('รหัสไม่ถูกต้อง');
  return Number(value);
}
function key(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(value)) fail('รหัสคำขอไม่ถูกต้อง');
  return value;
}
function paymentInstructions(body) {
  const method = body.payment_method || 'cash';
  if (!['cash', 'transfer', 'card'].includes(method)) fail('วิธีชำระเงินไม่ถูกต้อง');
  return { method };
}
function invoiceInput(body) {
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) fail('กรุณาระบุรายการ 1–50 รายการ');
  const items = body.items.map(item => {
    if (!item || typeof item.description !== 'string' || !item.description.trim() || item.description.trim().length > 200) fail('ชื่อรายการต้องยาว 1–200 ตัวอักษร');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) fail('จำนวนต้องเป็นจำนวนเต็ม 1–999');
    const unit_cents = cents(item.unit_price);
    return { description: item.description.trim(), quantity: item.quantity, unit_cents, line_cents: unit_cents * item.quantity };
  });
  const subtotal_cents = items.reduce((sum, item) => sum + item.line_cents, 0);
  if (subtotal_cents > MAX_CENTS) fail('ยอดรวมเกินขีดจำกัด');
  const discount_cents = cents(body.discount === undefined ? '0' : body.discount);
  if (discount_cents >= subtotal_cents) fail('ยอดสุทธิต้องมากกว่า 0 และส่วนลดต้องไม่เกินยอดรวม');
  if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 1000)) fail('หมายเหตุยาวไม่เกิน 1,000 ตัวอักษร');
  return { pet_id: id(body.pet_id), items, subtotal_cents, discount_cents, total_cents: subtotal_cents - discount_cents, note: (body.note || '').trim(), payment_instructions: paymentInstructions(body) };
}
function paymentInput(body) {
  const amount_cents = cents(body.amount);
  if (!amount_cents) fail('ยอดชำระต้องมากกว่า 0');
  if (!['cash', 'transfer', 'card'].includes(body.method)) fail('วิธีชำระเงินไม่ถูกต้อง');
  if (body.reference !== undefined && (typeof body.reference !== 'string' || body.reference.length > 200)) fail('หมายเหตุอ้างอิงยาวไม่เกิน 200 ตัวอักษร');
  return { amount_cents, method: body.method, reference: (body.reference || '').trim() };
}
function status(invoice) { return invoice.paid_cents >= invoice.total_cents ? 'paid' : invoice.paid_cents > 0 ? 'partial' : 'unpaid'; }
module.exports = { cents, id, key, invoiceInput, paymentInput, status, fail, paymentInstructions };
