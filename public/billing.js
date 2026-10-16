(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = cents => (cents / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const date = value => new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
  const methods = { cash: 'เงินสด', transfer: 'โอนเงิน', card: 'บัตร' };
  let user = null, next = null, current = null, listVersion = 0;
  const manager = () => user && ['admin', 'staff'].includes(user.role);
  const message = text => { $('message').textContent = text; $('message').hidden = !text; };
  function signedOut() {
    user = null; current = null; localStorage.removeItem('user');
    $('workspace').hidden = true; $('identity').textContent = '';
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    $('document').replaceChildren(); $('invoice-list').replaceChildren();
    window.location.replace('index.html?next=billing.html');
  }
  async function api(path, options = {}) {
    const response = await fetch('/api/billing' + path, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers } });
    let result;
    try { result = await response.json(); } catch { throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง กรุณาตรวจสอบการติดตั้งส่วนบิล'); }
    if (!response.ok || !result.success) {
      if (response.status === 401) signedOut();
      throw new Error(result.message || 'ไม่สามารถดำเนินการได้');
    }
    return result;
  }
  function requestKey(kind, payload) {
    const fingerprint = JSON.stringify(payload), stored = sessionStorage.getItem('billing-pending-' + kind);
    const prior = stored ? JSON.parse(stored) : null;
    if (prior?.fingerprint === fingerprint) return prior.key;
    const key = Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('billing-pending-' + kind, JSON.stringify({ fingerprint, key }));
    return key;
  }
  async function busy(button, fn) { button.disabled = true; try { await fn(); } finally { button.disabled = false; } }
  async function enter() {
    const result = await api('/me'); user = result.user;
    $('workspace').hidden = false;
    $('new-invoice').hidden = !manager(); $('identity').textContent = `${user.full_name} • ${user.role}`;
    await loadList();
  }
  async function loadList(append = false) {
    const version = ++listVersion;
    const params = new URLSearchParams({ q: $('search').value.trim() });
    if (append && next) params.set('before', next);
    $('more').hidden = true;
    if (!append) { $('invoice-list').replaceChildren(); $('empty').textContent = 'กำลังโหลด...'; $('empty').hidden = false; }
    try {
      const result = await api('/invoices?' + params);
      if (version !== listVersion) return;
      if (!append) $('invoice-list').replaceChildren();
      for (const item of result.data) {
        const row = document.createElement('tr');
        row.innerHTML = `<td><strong>${esc(item.number)}</strong><small>${esc(date(item.created_at))}</small></td><td>${esc(item.snapshot.owner.full_name)}<small>${esc(item.snapshot.pet.name)}</small></td><td class="money">${money(item.total_cents)}</td><td class="money">${money(item.balance_cents)}</td><td><div class="row-actions"><button class="quiet view-invoice" type="button">ดูเอกสาร</button>${manager() ? '<button class="delete-invoice quiet" type="button" aria-label="ลบใบแจ้งหนี้" title="ลบใบแจ้งหนี้"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' : ''}</div></td>`;
        row.querySelector('.view-invoice').addEventListener('click', () => openInvoice(item.id).catch(error => message(error.message)));
        const deleteButton = row.querySelector('.delete-invoice');
        if (deleteButton) {
          deleteButton.setAttribute('aria-label', 'ลบใบแจ้งหนี้ ' + item.number);
          deleteButton.addEventListener('click', () => removeInvoice(item, deleteButton));
        }
        $('invoice-list').append(row);
      }
      next = result.next; $('more').hidden = !next; $('empty').hidden = $('invoice-list').children.length > 0;
      $('empty').textContent = 'ยังไม่มีใบแจ้งหนี้ที่ตรงกับเงื่อนไข';
    } catch (error) { $('empty').textContent = 'โหลดรายการไม่สำเร็จ กรุณากดค้นหาเพื่อลองใหม่'; throw error; }
  }
  async function removeInvoice(item, button) {
    if (!window.confirm(`ยืนยันลบใบแจ้งหนี้ ${item.number}?\nใบแจ้งหนี้และใบเสร็จที่เกี่ยวข้องจะไม่แสดงในรายการของทุกฝ่าย ข้อมูลเดิมจะเก็บไว้ในฐานข้อมูล`)) return;
    await busy(button, async () => {
      try {
        const result = await api('/invoices/' + item.id, { method: 'DELETE' });
        if (current?.id === item.id) {
          $('detail-dialog').close(); current = null; $('document').replaceChildren(); $('payment-history').replaceChildren();
        }
        message(result.message); await loadList();
      } catch (error) { message(error.message); }
    });
  }
  async function customers() {
    $('pet').replaceChildren(new Option('กำลังโหลด...', ''));
    const result = await api('/customers?q=' + encodeURIComponent($('customer-search').value));
    $('pet').replaceChildren(new Option(result.data.length ? 'เลือกสัตว์เลี้ยง' : 'ไม่พบข้อมูล ลองค้นหาใหม่หรือเพิ่มสัตว์เลี้ยงก่อน', ''));
    for (const item of result.data) $('pet').add(new Option(`${item.full_name} • ${item.pet_name} (#${item.pet_id})`, item.pet_id));
  }
  function addItem(description = '', quantity = 1, price = '') {
    if ($('items').children.length >= 50) return;
    const row = document.createElement('tr');
    row.innerHTML = '<td><input aria-label="รายการค่ารักษา" class="description" maxlength="200" required placeholder="เช่น ค่าตรวจรักษา"></td><td><input aria-label="จำนวน" class="quantity" type="number" min="1" max="999" step="1" required></td><td><input aria-label="ราคาต่อหน่วย" class="price" type="number" min="0" max="1000000" step="0.01" required></td><td><button type="button" class="quiet" aria-label="ลบรายการ">ลบ</button></td>';
    row.querySelector('.description').value = description; row.querySelector('.quantity').value = quantity; row.querySelector('.price').value = price;
    row.querySelector('button').addEventListener('click', () => { if ($('items').children.length > 1) { row.remove(); preview(); } });
    row.addEventListener('input', preview); $('items').append(row); preview();
  }
  function getItems() { return Array.from($('items').children, row => ({ description: row.querySelector('.description').value, quantity: Number(row.querySelector('.quantity').value), unit_price: row.querySelector('.price').value })); }
  function preview() {
    const total = getItems().reduce((sum, item) => sum + Math.round(Number(item.unit_price) * 100) * item.quantity, 0) - Math.round(Number($('discount').value) * 100);
    $('preview-total').textContent = Number.isFinite(total) ? money(total) + ' บาท' : 'กรุณาตรวจสอบรายการ';
  }
  function thaiAmount(value) {
    const digits = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
    function words(n) {
      if (!n) return 'ศูนย์';
      if (n >= 1000000) return words(Math.floor(n / 1000000)) + 'ล้าน' + (n % 1000000 ? words(n % 1000000) : '');
      const str = String(n), places = ['','สิบ','ร้อย','พัน','หมื่น','แสน'];
      return Array.from(str, (digit, i) => { const d = Number(digit), place = str.length - i - 1; if (!d) return ''; if (place === 1) return (d === 1 ? '' : d === 2 ? 'ยี่' : digits[d]) + 'สิบ'; if (!place && d === 1 && str.length > 1) return 'เอ็ด'; return digits[d] + places[place]; }).join('');
    }
    return words(Math.floor(value / 100)) + 'บาท' + (value % 100 ? words(value % 100) + 'สตางค์' : 'ถ้วน');
  }
  function renderInvoice(inv) {
    const s = inv.snapshot, p = s.payment_instructions || { method: 'cash' };
    $('document').innerHTML = `<div class="doc-heading"><div><h2>${esc(s.clinic.name)}</h2><p>${esc(s.clinic.address)}</p><p>โทร. ${esc(s.clinic.phone || '-')}</p><p>เลขประจำตัวผู้เสียภาษี ${esc(s.clinic.tax_id || '-')}</p></div><div><h2>ใบแจ้งหนี้ค่ารักษา</h2><strong>${esc(inv.number)}</strong><p>วันที่ ${esc(date(inv.created_at))}</p></div></div>
      <div class="invoice-title">ใบแจ้งชำระค่ารักษาสัตว์เลี้ยง / Invoice</div>
      <div class="amount-summary"><div><span>จำนวนเงินเป็นตัวอักษร</span><strong>${esc(thaiAmount(inv.total_cents))}</strong></div><div><span>ยอดสุทธิ (บาท)</span><strong>${money(inv.total_cents)}</strong></div></div>
      <div class="table-scroll"><table><thead><tr><th>รายการค่ารักษา</th><th class="money">จำนวน</th><th class="money">ราคา/หน่วย</th><th class="money">รวม (บาท)</th></tr></thead><tbody>${inv.items.map(item => `<tr><td>${esc(item.description)}</td><td class="money">${item.quantity}</td><td class="money">${money(item.unit_cents)}</td><td class="money">${money(item.line_cents)}</td></tr>`).join('')}</tbody></table></div>
      <div class="invoice-summary"><span>รวมค่ารักษา ${money(inv.subtotal_cents)} บาท</span><span>ส่วนลด ${money(inv.discount_cents)} บาท</span><span>ชำระแล้ว ${money(inv.paid_cents)} บาท</span><strong>คงเหลือ ${money(inv.balance_cents)} บาท</strong></div>
      <section class="pay-slip"><div class="pay-slip-transfer"><h3>วิธีชำระเงิน</h3><p>${esc(methods[p.method] || 'เงินสด')}</p></div>
      <div class="pay-slip-payer"><h3>ข้อมูลผู้ชำระเงิน</h3><dl><dt>ชื่อเจ้าของสัตว์เลี้ยง</dt><dd>${esc(s.owner.full_name)}</dd><dt>สัตว์เลี้ยง</dt><dd>${esc(s.pet.name)}</dd><dt>โทรศัพท์</dt><dd>${esc(s.owner.phone || '-')}</dd><dt>เลขใบแจ้งหนี้ (Ref.1)</dt><dd>${esc(inv.number)}</dd><dt>รหัสลูกค้า (Ref.2)</dt><dd>${esc(s.owner.id)}</dd><dt>ยอดคงเหลือที่ต้องชำระ</dt><dd><strong>${money(inv.balance_cents)} บาท</strong></dd></dl></div></section>
      <p class="preserve-lines">หมายเหตุ: ${esc(inv.note || '-')}</p>${s.delivery?.sent_at ? `<p class="muted delivery-info">ส่งให้ ${esc(s.owner.full_name)} ในระบบเมื่อ ${esc(date(s.delivery.sent_at))}</p>` : ''}`;
  }
  function renderDocument(inv, payment = null) {
    if (!payment) { renderInvoice(inv); $('detail-dialog').scrollTop = 0; return; }
    const s = inv.snapshot;
    $('document').innerHTML = `<div class="doc-heading"><div><h2>${esc(s.clinic.name)}</h2><p>${esc(s.clinic.address)}</p><p>โทร. ${esc(s.clinic.phone || '-')}</p><p>เลขประจำตัวผู้เสียภาษี ${esc(s.clinic.tax_id || '-')}</p></div><div><h2>${payment ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'}</h2><strong>${esc(payment ? payment.number : inv.number)}</strong><p>${esc(date(payment ? payment.created_at : inv.created_at))}</p></div></div>
      <div class="doc-meta"><strong>ลูกค้า:</strong> ${esc(s.owner.full_name)} &nbsp; โทร. ${esc(s.owner.phone || '-')}<br><strong>สัตว์เลี้ยง:</strong> ${esc(s.pet.name)}<br><strong>อ้างอิงใบแจ้งหนี้:</strong> ${esc(inv.number)}</div>
      <div class="table-scroll"><table><thead><tr><th>รายการค่ารักษา</th><th class="money">จำนวน</th><th class="money">ราคา/หน่วย</th><th class="money">รวม (บาท)</th></tr></thead><tbody>${inv.items.map(item => `<tr><td>${esc(item.description)}</td><td class="money">${item.quantity}</td><td class="money">${money(item.unit_cents)}</td><td class="money">${money(item.line_cents)}</td></tr>`).join('')}</tbody></table></div>
      <div class="totals"><p><span>รวมค่ารักษา</span><span>${money(inv.subtotal_cents)} บาท</span></p><p><span>ส่วนลด</span><span>${money(inv.discount_cents)} บาท</span></p><p class="grand"><span>ยอดสุทธิของบิล</span><span>${money(inv.total_cents)} บาท</span></p>${payment ? `<p class="grand"><span>รับชำระครั้งนี้</span><span>${money(payment.amount_cents)} บาท</span></p><p><span>คงเหลือหลังรายการนี้</span><span>${money(payment.balance_after_cents)} บาท</span></p><p><span>วิธีชำระเงิน</span><span>${esc(methods[payment.method])}</span></p>` : `<p><span>ชำระแล้ว</span><span>${money(inv.paid_cents)} บาท</span></p><p><span>คงเหลือปัจจุบัน</span><strong>${money(inv.balance_cents)} บาท</strong></p>`}</div>
      ${payment ? `<p>หมายเหตุอ้างอิง: ${esc(payment.reference || '-')}</p>` : ''}<p>หมายเหตุบิล: ${esc(inv.note || '-')}</p><p class="muted">จำนวนเงินสกุลบาท • เอกสารเก็บข้อมูลคลินิกและลูกค้าตามวันที่ออกบิล</p>`;
    $('detail-dialog').scrollTop = 0;
  }
  async function openInvoice(id) {
    const result = await api('/invoices/' + id); current = result.data;
    renderDocument(current); $('payment-error').textContent = ''; $('payment-history').replaceChildren();
    const heading = document.createElement('h3'); heading.textContent = 'ใบเสร็จ / ประวัติการชำระเงิน'; $('payment-history').append(heading);
    if (!current.payments.length) { const p = document.createElement('p'); p.textContent = 'ยังไม่มีรายการชำระเงิน'; $('payment-history').append(p); }
    for (const payment of current.payments) {
      const button = document.createElement('button'); button.className = 'quiet receipt-button';
      button.textContent = `${payment.number} • ${money(payment.amount_cents)} บาท • ${date(payment.created_at)}`;
      button.addEventListener('click', () => openReceipt(payment.id).catch(error => message(error.message)));
      $('payment-history').append(button);
    }
    $('payment-form').hidden = !manager() || current.balance_cents <= 0;
    $('payment-form').reset(); $('method').value = current.snapshot.payment_instructions?.method || 'cash'; $('amount').value = (current.balance_cents / 100).toFixed(2); $('amount').max = (current.balance_cents / 100).toFixed(2);
    if (!$('detail-dialog').open) $('detail-dialog').showModal();
  }
  async function openReceipt(id) {
    const result = await api('/receipts/' + id); renderDocument(result.data.invoice, result.data.receipt);
    $('payment-form').hidden = true; $('payment-history').replaceChildren();
    const button = document.createElement('button'); button.className = 'quiet'; button.textContent = 'กลับไปที่ใบแจ้งหนี้';
    button.addEventListener('click', () => openInvoice(result.data.invoice.id).catch(error => message(error.message)));
    $('payment-history').append(button);
    if (!$('detail-dialog').open) $('detail-dialog').showModal();
  }
  $('filter-form').addEventListener('submit', event => { event.preventDefault(); busy(event.submitter, () => loadList().catch(error => message(error.message))); });
  $('more').addEventListener('click', () => busy($('more'), () => loadList(true).catch(error => message(error.message))));
  $('new-invoice').addEventListener('click', async () => {
    $('create-form').reset(); $('items').replaceChildren(); addItem(); $('create-error').textContent = ''; $('create-dialog').showModal();
    try { await customers(); } catch (error) { $('create-error').textContent = error.message; }
  });
  $('find-customers').addEventListener('click', () => busy($('find-customers'), () => customers().catch(error => { $('create-error').textContent = error.message; })));
  $('add-item').addEventListener('click', () => addItem());
  $('discount').addEventListener('input', preview);
  $('create-form').addEventListener('submit', event => {
    event.preventDefault(); busy(event.submitter, async () => {
      $('create-error').textContent = '';
      const payload = { pet_id: $('pet').value, items: getItems(), discount: $('discount').value, note: $('note').value, payment_method: $('invoice-method').value };
      try {
        const result = await api('/invoices', { method: 'POST', headers: { 'Idempotency-Key': requestKey('invoice', payload) }, body: JSON.stringify(payload) });
        sessionStorage.removeItem('billing-pending-invoice'); $('create-dialog').close(); message('ส่งใบแจ้งหนี้ ' + result.data.number + ' ให้ ' + result.data.snapshot.owner.full_name + ' ในระบบแล้ว');
        await loadList(); await openInvoice(result.data.id);
      } catch (error) { $('create-error').textContent = error.message + ' หากการเชื่อมต่อขัดข้อง กดส่งข้อมูลเดิมซ้ำได้'; if (!$('create-dialog').open) message(error.message); }
    });
  });
  $('payment-form').addEventListener('submit', event => {
    event.preventDefault(); busy(event.submitter, async () => {
      $('payment-error').textContent = '';
      const invoiceId = current.id;
      const payload = { amount: $('amount').value, method: $('method').value, reference: $('reference').value, simulated: true };
      try {
        const result = await api(`/invoices/${invoiceId}/payments`, { method: 'POST', headers: { 'Idempotency-Key': requestKey('payment', { invoiceId, ...payload }) }, body: JSON.stringify(payload) });
        sessionStorage.removeItem('billing-pending-payment'); $('payment-form').hidden = true; message('บันทึกยอดชำระแล้ว ใบเสร็จ ' + result.data.number);
        await openReceipt(result.data.id); await loadList();
      } catch (error) { $('payment-error').textContent = error.message + ' หากการเชื่อมต่อขัดข้อง กดส่งข้อมูลเดิมซ้ำได้'; if (!$('detail-dialog').open || $('payment-form').hidden) message(error.message); }
    });
  });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  $('print').addEventListener('click', () => window.print());
  sessionStorage.removeItem('billing-token'); // Discard tokens from older releases.
  enter().catch(error => message(error.message));
})();
