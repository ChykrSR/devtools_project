let currentUser = null;
let healthRecords = [];
let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  } catch (error) {
    currentUser = null;
  }

  if (!currentUser || !currentUser.id) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('nav-user-name').textContent = currentUser.full_name || 'สมาชิก';
  await loadPets();
});

async function loadPets() {
  const select = document.getElementById('pet-select');
  try {
    const response = await fetch(`/api/pets/user/${encodeURIComponent(currentUser.id)}`);
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'โหลดรายการสัตว์เลี้ยงไม่สำเร็จ');

    if (!data.pets.length) {
      select.innerHTML = '<option value="">ยังไม่มีสัตว์เลี้ยง</option>';
      renderMessage('ยังไม่มีข้อมูลสัตว์เลี้ยง', 'เพิ่มสัตว์เลี้ยงในหน้าจัดการสัตว์เลี้ยงก่อนดูประวัติ');
      return;
    }

    select.innerHTML = data.pets.map(pet =>
      `<option value="${Number(pet.id)}">${escapeHtml(pet.name)}${pet.breed ? ` (${escapeHtml(pet.breed)})` : ''}</option>`
    ).join('');
    select.addEventListener('change', loadHealthRecords);
    await loadHealthRecords();
  } catch (error) {
    select.innerHTML = '<option value="">โหลดรายการไม่สำเร็จ</option>';
    showAlert(error.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    renderMessage('โหลดข้อมูลไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง');
  }
}

async function loadHealthRecords() {
  const petId = document.getElementById('pet-select').value;
  if (!petId) return;

  const container = document.getElementById('records-container');
  container.innerHTML = '<div class="border-y border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-400">กำลังโหลดประวัติ...</div>';

  try {
    const params = new URLSearchParams({ user_id: currentUser.id });
    const response = await fetch(`/api/pets/${encodeURIComponent(petId)}/health-records?${params}`);
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'โหลดประวัติไม่สำเร็จ');

    healthRecords = data.records || [];
    document.getElementById('pet-summary').classList.remove('hidden');
    document.getElementById('pet-name').textContent = data.pet.name;
    document.getElementById('pet-details').textContent = [data.pet.type, data.pet.breed].filter(Boolean).join(' · ') || 'ไม่ระบุรายละเอียด';
    document.getElementById('health-count').textContent = healthRecords.length;
    document.getElementById('vaccine-count').textContent = healthRecords.filter(isVaccination).length;
    renderRecords();
    hideAlert();
  } catch (error) {
    showAlert(error.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    renderMessage('โหลดประวัติไม่สำเร็จ', 'กรุณาเลือกสัตว์เลี้ยงอีกครั้งหรือลองใหม่');
  }
}

function isVaccination(record) {
  return record.record_type === 'vaccination' || /วัคซีน|vaccine/i.test(record.service_details || '');
}

function setRecordFilter(filter) {
  activeFilter = filter;
  const allButton = document.getElementById('filter-all');
  const vaccineButton = document.getElementById('filter-vaccines');
  allButton.setAttribute('aria-pressed', String(filter === 'all'));
  vaccineButton.setAttribute('aria-pressed', String(filter === 'vaccines'));
  allButton.className = filter === 'all'
    ? 'rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white'
    : 'rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100';
  vaccineButton.className = filter === 'vaccines'
    ? 'rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white'
    : 'rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100';
  renderRecords();
}

function renderRecords() {
  const visibleRecords = healthRecords.filter(record => activeFilter === 'all' || isVaccination(record));
  if (!visibleRecords.length) {
    const title = activeFilter === 'vaccines' ? 'ยังไม่มีประวัติวัคซีน' : 'ยังไม่มีประวัติสุขภาพ';
    renderMessage(title, 'ประวัติจะปรากฏที่นี่เมื่อคลินิกบันทึกการรักษา');
    return;
  }

  document.getElementById('records-container').innerHTML = visibleRecords.map(record => {
    const vaccine = isVaccination(record);
    return `
      <article class="border-y border-slate-200 bg-white px-5 py-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-semibold text-slate-800">${escapeHtml(record.diagnosis || 'บันทึกการรักษา')}</h3>
              ${vaccine ? '<span class="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">วัคซีน</span>' : ''}
            </div>
            <p class="mt-1 text-xs text-slate-500">${formatDate(record.appointment_date || record.created_at)}${record.appointment_time ? ` · ${escapeHtml(String(record.appointment_time).slice(0, 5))} น.` : ''}</p>
          </div>
          <p class="text-xs text-slate-500">สัตวแพทย์: ${escapeHtml(record.vet_name || 'ไม่ระบุ')}</p>
        </div>
        ${record.service_details ? `<div class="mt-4"><p class="text-xs font-semibold text-slate-500">บริการ / วัคซีน</p><p class="mt-1 whitespace-pre-line text-sm text-slate-700">${escapeHtml(record.service_details)}</p></div>` : ''}
        ${record.vaccine_name ? `<div class="mt-3 text-sm text-slate-700"><p>เลข Lot: ${escapeHtml(record.lot_number || 'ไม่ระบุ')}</p><p>วันที่ฉีด: ${formatDate(record.administered_at)}</p>${record.next_due_date ? `<p>กำหนดฉีดครั้งถัดไป: ${formatDate(record.next_due_date)}</p>` : ''}${record.vaccine_notes ? `<p class="mt-1 whitespace-pre-line">หมายเหตุ: ${escapeHtml(record.vaccine_notes)}</p>` : ''}</div>` : ''}
        ${record.medication_details ? `<div class="mt-3"><p class="text-xs font-semibold text-slate-500">ยาและคำแนะนำ</p><p class="mt-1 whitespace-pre-line text-sm text-slate-700">${escapeHtml(record.medication_details)}</p></div>` : ''}
        ${record.reason ? `<p class="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">อาการก่อนเข้ารับบริการ: ${escapeHtml(record.reason)}</p>` : ''}
      </article>
    `;
  }).join('');
}

function formatDate(value) {
  if (!value) return 'ไม่ระบุวันที่';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'ไม่ระบุวันที่' : date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderMessage(title, detail) {
  document.getElementById('records-container').innerHTML = `
    <div class="border-y border-dashed border-slate-300 bg-white px-5 py-10 text-center">
      <p class="font-semibold text-slate-700">${escapeHtml(title)}</p>
      <p class="mt-1 text-sm text-slate-500">${escapeHtml(detail)}</p>
    </div>
  `;
}

function showAlert(message) {
  const alert = document.getElementById('record-alert');
  alert.textContent = message;
  alert.className = 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700';
}

function hideAlert() {
  document.getElementById('record-alert').classList.add('hidden');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function handleLogout() {
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}