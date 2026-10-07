document.addEventListener('DOMContentLoaded', () => {
  loadClinicInfo();
  loadUsers();
});

// Switch Tabs UI
function switchTab(tabName) {
  const clinicTab = document.getElementById('tab-clinic');
  const usersTab = document.getElementById('tab-users');
  const clinicBtn = document.getElementById('tab-btn-clinic');
  const usersBtn = document.getElementById('tab-btn-users');

  if (tabName === 'clinic') {
    clinicTab.classList.remove('hidden');
    usersTab.classList.add('hidden');
    clinicBtn.className = 'px-5 py-2.5 font-semibold text-sm border-b-2 border-teal-600 text-teal-700 transition';
    usersBtn.className = 'px-5 py-2.5 font-semibold text-sm text-slate-500 hover:text-slate-700 transition';
  } else {
    clinicTab.classList.add('hidden');
    usersTab.classList.remove('hidden');
    usersBtn.className = 'px-5 py-2.5 font-semibold text-sm border-b-2 border-teal-600 text-teal-700 transition';
    clinicBtn.className = 'px-5 py-2.5 font-semibold text-sm text-slate-500 hover:text-slate-700 transition';
  }
}

// ----------------------------------------------------
// CLINIC INFO LOGIC
// ----------------------------------------------------
async function loadClinicInfo() {
  try {
    const res = await fetch('/api/clinic');
    const data = await res.json();

    if (res.ok && data.success) {
      const c = data.data || data.clinic || {};
      document.getElementById('clinic-name').value = c.name || '';
      document.getElementById('clinic-address').value = c.address || '';
      document.getElementById('clinic-phone').value = c.phone || '';
      document.getElementById('clinic-email').value = c.email || '';
      document.getElementById('clinic-tax-id').value = c.tax_id || '';
      document.getElementById('clinic-opening-hours').value = c.opening_hours || '';
    }
  } catch (err) {
    console.error('Fetch clinic error:', err);
  }
}

async function handleUpdateClinic(e) {
  e.preventDefault();
  const clinicData = {
    name: document.getElementById('clinic-name').value,
    address: document.getElementById('clinic-address').value,
    phone: document.getElementById('clinic-phone').value,
    email: document.getElementById('clinic-email').value,
    tax_id: document.getElementById('clinic-tax-id').value,
    opening_hours: document.getElementById('clinic-opening-hours').value,
  };

  try {
    const res = await fetch('/api/clinic', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clinicData)
    });
    const data = await res.json();
    alert(data.success ? '✅ ' + (data.message || 'บันทึกข้อมูลคลินิกเรียบร้อย') : '❌ ' + data.message);
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
}

// ----------------------------------------------------
// USER MANAGEMENT LOGIC
// ----------------------------------------------------
let allUsers = [];
let searchTimer = null;

// Debounce เพื่อชะลอการยิง API ตอนพิมพ์ค้นหา
function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadUsers();
  }, 300);
}

// 1. ดึงรายการผู้ใช้งาน (พร้อม Search & Filter)
async function loadUsers() {
  const tbody = document.getElementById('user-table-body');
  const search = document.getElementById('user-search').value.trim();
  const role = document.getElementById('user-role-filter').value;

  // สร้าง Query String
  const queryParams = new URLSearchParams();
  if (search) queryParams.append('search', search);
  if (role && role !== 'all') queryParams.append('role', role);

  try {
    const res = await fetch(`/api/users?${queryParams.toString()}`);
    const data = await res.json();

    if (res.ok && data.success) {
      allUsers = data.data || [];
      
      if (allUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">ไม่พบข้อมูลผู้ใช้งาน</td></tr>`;
        return;
      }

      tbody.innerHTML = allUsers.map(user => renderUserRow(user)).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">ไม่สามารถดึงข้อมูลผู้ใช้ได้ (${data.message})</td></tr>`;
    }
  } catch (err) {
    console.error('Fetch users error:', err);
  }
}

function renderUserRow(user) {
  const roleBadges = {
    admin: '<span class="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">⚙️ Admin</span>',
    vet: '<span class="px-2.5 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-semibold">🩺 Vet</span>',
    staff: '<span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">📋 Staff</span>',
    pet_owner: '<span class="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">🐶 Pet Owner</span>'
  };

  const statusBadge = user.is_active == 1 
    ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-md">🟢 ปกติ</span>'
    : '<span class="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-md">🔴 ระงับ</span>';

  return `
    <tr class="hover:bg-slate-50 transition">
      <td class="p-4 font-bold text-slate-500">#${user.id}</td>
      <td class="p-4 font-semibold text-slate-800">${user.full_name}</td>
      <td class="p-4">
        <div class="text-xs text-slate-700">${user.email}</div>
        <div class="text-xs text-slate-400">${user.phone || '-'}</div>
      </td>
      <td class="p-4">${roleBadges[user.role] || user.role}</td>
      <td class="p-4">${statusBadge}</td>
      <td class="p-4 text-center space-x-2">
        <button onclick="editUser(${user.id})" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium">✏️ แก้ไข</button>
      </td>
    </tr>
  `;
}

function openUserModal() {
  document.getElementById('user-modal-title').innerText = 'เพิ่มผู้ใช้งานใหม่';
  document.getElementById('user-form').reset();
  document.getElementById('user-id').value = '';
  
  // เพิ่มผู้ใช้ใหม่ -> ต้องกรอกรหัสผ่าน, ซ่อนช่องสถานะ
  document.getElementById('password-field-group').classList.remove('hidden');
  document.getElementById('user-password').required = true;
  document.getElementById('status-field-group').classList.add('hidden');

  document.getElementById('user-modal').classList.remove('hidden');
}

function closeUserModal() {
  document.getElementById('user-modal').classList.add('hidden');
}

function editUser(id) {
  const user = allUsers.find(u => u.id === id);
  if (!user) return;

  document.getElementById('user-modal-title').innerText = 'แก้ไขข้อมูลผู้ใช้งาน';
  document.getElementById('user-id').value = user.id;
  document.getElementById('user-fullname').value = user.full_name;
  document.getElementById('user-email').value = user.email;
  document.getElementById('user-phone').value = user.phone || '';
  document.getElementById('user-role').value = user.role;
  document.getElementById('user-is-active').value = user.is_active;

  // แก้ไขผู้ใช้ -> ซ่อนช่องรหัสผ่านตาม API 3
  document.getElementById('password-field-group').classList.add('hidden');
  document.getElementById('user-password').required = false;
  document.getElementById('status-field-group').classList.remove('hidden');

  document.getElementById('user-modal').classList.remove('hidden');
}

// 2 & 3. บันทึกข้อมูล (POST เพิ่มผู้ใช้ / PUT แก้ไขผู้ใช้)
async function handleUserSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('user-id').value;

  let userData = {};
  let url = '';
  let method = '';

  if (id) {
    // กรณีแก้ไข (PUT /api/users/:id)
    url = `/api/users/${id}`;
    method = 'PUT';
    userData = {
      full_name: document.getElementById('user-fullname').value,
      email: document.getElementById('user-email').value,
      phone: document.getElementById('user-phone').value,
      role: document.getElementById('user-role').value,
      is_active: parseInt(document.getElementById('user-is-active').value)
    };
  } else {
    // กรณีเพิ่มใหม่ (POST /api/users)
    url = '/api/users';
    method = 'POST';
    userData = {
      full_name: document.getElementById('user-fullname').value,
      email: document.getElementById('user-email').value,
      phone: document.getElementById('user-phone').value,
      role: document.getElementById('user-role').value,
      password: document.getElementById('user-password').value
    };
  }

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert('✅ ' + (data.message || 'บันทึกสำเร็จ'));
      closeUserModal();
      loadUsers();
    } else {
      alert('❌ ' + (data.message || 'บันทึกไม่สำเร็จ'));
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
  }
}