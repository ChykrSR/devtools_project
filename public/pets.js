let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  const userJson = localStorage.getItem('user');
  if (!userJson) {
    alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
    window.location.href = 'index.html';
    return;
  }

  currentUser = JSON.parse(userJson);

  // ตรวจสอบว่า user.id มีจริงหรือไม่
  if (!currentUser.id) {
    alert('ข้อมูลผู้ใช้งานไม่ถูกต้อง กรุณาล็อกอินใหม่อีกครั้ง');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('nav-user-name').innerText = currentUser.full_name || 'สมาชิก';

  // โหลดรายการสัตว์เลี้ยง
  loadPets();
});

// ดึงสัตว์เลี้ยงทั้งหมดจาก API
async function loadPets() {
  const container = document.getElementById('pets-container');
  
  try {
    const res = await fetch(`/api/pets/user/${currentUser.id}`);
    const data = await res.json();

    if (res.ok && data.success) {
      if (data.pets.length === 0) {
        container.innerHTML = `
          <div class="col-span-full bg-white p-12 rounded-2xl text-center border border-dashed border-slate-300">
            <span class="text-5xl">🐶</span>
            <p class="mt-3 text-slate-600 font-medium">ยังไม่มีข้อมูลสัตว์เลี้ยง</p>
            <p class="text-xs text-slate-400 mt-1">กดปุ่ม "+ เพิ่มสัตว์เลี้ยงใหม่" ด้านบนเพื่อลงทะเบียนสัตว์เลี้ยงของคุณ</p>
          </div>
        `;
        return;
      }

      container.innerHTML = data.pets.map(pet => renderPetCard(pet)).join('');
    } else {
      showErrorUI(container, data.message || 'ไม่สามารถดึงข้อมูลสัตว์เลี้ยงได้');
    }
  } catch (err) {
    console.error('Fetch error:', err);
    showErrorUI(container, 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
  }
}

// แสดง UI กรณีเกิดข้อผิดพลาด
function showErrorUI(container, message) {
  container.innerHTML = `
    <div class="col-span-full bg-red-50 text-red-700 p-8 rounded-2xl text-center border border-red-200">
      <span class="text-4xl">⚠️</span>
      <p class="font-bold text-lg mt-2">ดึงข้อมูลไม่สำเร็จ</p>
      <p class="text-xs text-red-600 mt-1">${message}</p>
      <button onclick="loadPets()" class="mt-4 bg-red-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-red-700 transition">
        🔄 ลองใหม่อีกครั้ง
      </button>
    </div>
  `;
}

// Render การ์ดสัตว์เลี้ยง
function renderPetCard(pet) {
  const typeIcons = { dog: '🐶', cat: '🐱', bird: '🦜', rabbit: '🐰', other: '🐾' };
  const genderText = { male: 'ผู้ ♂', female: 'เมีย ♀', unknown: 'ไม่ระบุ' };

  return `
    <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition">
      <div>
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 bg-teal-50 text-teal-700 rounded-xl flex items-center justify-center text-2xl">
              ${typeIcons[pet.type] || '🐾'}
            </div>
            <div>
              <h3 class="font-bold text-slate-800 text-lg">${pet.name}</h3>
              <p class="text-xs text-slate-400">${pet.breed || 'ไม่ระบุสายพันธุ์'}</p>
            </div>
          </div>
          <span class="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
            ${genderText[pet.gender] || 'ไม่ระบุ'}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
          <div><span class="text-slate-400">อายุ:</span> ${pet.age || '-'}</div>
          <div><span class="text-slate-400">น้ำหนัก:</span> ${pet.weight > 0 ? pet.weight + ' กก.' : '-'}</div>
        </div>

        ${pet.notes ? `
          <div class="mt-3 bg-amber-50 text-amber-800 p-2.5 rounded-lg text-xs">
            📌 <strong>บันทึก:</strong> ${pet.notes}
          </div>
        ` : ''}
      </div>

      <div class="flex justify-end space-x-2 mt-6 pt-3 border-t border-slate-100">
        <button onclick="editPet(${pet.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition">
          ✏️ แก้ไข
        </button>
        <button onclick="deletePet(${pet.id}, '${pet.name}')" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition">
          🗑️ ลบ
        </button>
      </div>
    </div>
  `;
}

function openPetModal() {
  document.getElementById('modal-title').innerText = 'เพิ่มสัตว์เลี้ยงใหม่';
  document.getElementById('pet-form').reset();
  document.getElementById('pet-id').value = '';
  document.getElementById('pet-modal').classList.remove('hidden');
}

function closePetModal() {
  document.getElementById('pet-modal').classList.add('hidden');
}

async function editPet(id) {
  try {
    const res = await fetch(`/api/pets/${id}`);
    const data = await res.json();

    if (data.success) {
      const pet = data.pet;
      document.getElementById('modal-title').innerText = 'แก้ไขข้อมูลสัตว์เลี้ยง';
      document.getElementById('pet-id').value = pet.id;
      document.getElementById('pet-name').value = pet.name;
      document.getElementById('pet-type').value = pet.type;
      document.getElementById('pet-breed').value = pet.breed || '';
      document.getElementById('pet-age').value = pet.age || '';
      document.getElementById('pet-gender').value = pet.gender || 'unknown';
      document.getElementById('pet-weight').value = pet.weight || '';
      document.getElementById('pet-notes').value = pet.notes || '';

      document.getElementById('pet-modal').classList.remove('hidden');
    }
  } catch (err) {
    alert('ไม่สามารถดึงข้อมูลสัตว์เลี้ยงได้');
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('pet-id').value;
  const petData = {
    user_id: currentUser.id,
    name: document.getElementById('pet-name').value,
    type: document.getElementById('pet-type').value,
    breed: document.getElementById('pet-breed').value,
    age: document.getElementById('pet-age').value,
    gender: document.getElementById('pet-gender').value,
    weight: document.getElementById('pet-weight').value,
    notes: document.getElementById('pet-notes').value,
  };

  const url = id ? `/api/pets/${id}` : '/api/pets';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(petData)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      closePetModal();
      loadPets();
    } else {
      alert(data.message || 'บันทึกข้อมูลไม่สำเร็จ');
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
  }
}

async function deletePet(id, name) {
  if (!confirm(`คุณต้องการลบข้อมูล "${name}" ใช่หรือไม่?`)) return;

  try {
    const res = await fetch(`/api/pets/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok && data.success) {
      loadPets();
    } else {
      alert(data.message || 'ลบข้อมูลไม่สำเร็จ');
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
  }
}

function handleLogout() {
  if (confirm('ต้องการออกจากระบบหรือไม่?')) {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  }
}