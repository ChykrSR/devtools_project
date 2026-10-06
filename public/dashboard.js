document.addEventListener('DOMContentLoaded', async () => {
  const userJson = localStorage.getItem('user');

  if (!userJson) {
    alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
    window.location.href = 'index.html';
    return;
  }

  const user = JSON.parse(userJson);

  // แสดงข้อมูลผู้ใช้งานบน Navigation และ Banner
  document.getElementById('nav-user-name').innerText = user.full_name || 'สมาชิก';
  document.getElementById('nav-user-role').innerText = user.role || 'pet_owner';
  document.getElementById('welcome-user-name').innerText = user.full_name || 'สมาชิก';
  document.getElementById('info-user-email').innerText = user.email || '-';
  document.getElementById('info-user-phone').innerText = user.phone || 'ไม่ได้ระบุ';

  // โหลดข้อมูลสัตว์เลี้ยงจริงของผู้ใช้คนนี้จาก MySQL
  await loadDashboardPets(user.id);
});

async function loadDashboardPets(userId) {
  const countTotalEl = document.getElementById('pet-count-total');
  const countDetailEl = document.getElementById('pet-count-detail');
  const listContainerEl = document.getElementById('pets-list-container');

  try {
    const response = await fetch(`/api/pets/user/${userId}`);
    const data = await response.json();

    if (data.success) {
      const pets = data.pets || [];

      // 1. คำนวณจำนวณสุนัข/แมว/สัตว์อื่นๆ
      const dogCount = pets.filter(p => p.type === 'dog').length;
      const catCount = pets.filter(p => p.type === 'cat').length;
      const otherCount = pets.length - (dogCount + catCount);

      // 2. อัปเดตตัวเลขในการ์ดสรุปผล
      countTotalEl.innerText = `${pets.length} ตัว`;
      let detailText = `สุนัข ${dogCount} | แมว ${catCount}`;
      if (otherCount > 0) detailText += ` | อื่นๆ ${otherCount}`;
      countDetailEl.innerText = detailText;

      // 3. Render แสดงรายการสัตว์เลี้ยงในหน้าจอ
      if (pets.length === 0) {
        listContainerEl.innerHTML = `
          <div class="col-span-full py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p class="text-slate-500 text-sm">ยังไม่มีประวัติสัตว์เลี้ยงในระบบ</p>
            <a href="pets.html" class="inline-block mt-2 text-xs text-teal-600 hover:underline font-semibold">+ เพิ่มสัตว์เลี้ยงตัวแรกของคุณ</a>
          </div>
        `;
        return;
      }

      const typeIcons = { dog: '🐶', cat: '🐱', bird: '🦜', rabbit: '🐰', other: '🐾' };
      const typeNames = { dog: 'สุนัข', cat: 'แมว', bird: 'นก', rabbit: 'กระต่าย', other: 'อื่นๆ' };

      listContainerEl.innerHTML = pets.map(pet => `
        <div class="p-4 border rounded-xl flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 transition">
          <div class="flex items-center space-x-4">
            <div class="w-12 h-12 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-2xl">
              ${typeIcons[pet.type] || '🐾'}
            </div>
            <div>
              <h4 class="font-bold text-slate-800">${pet.name}</h4>
              <p class="text-xs text-slate-500">${typeNames[pet.type] || 'สัตว์เลี้ยง'} • ${pet.breed || 'ไม่ระบุสายพันธุ์'} (${pet.age || 'ไม่ระบุอายุ'})</p>
              <span class="inline-block mt-1 text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-medium">
                น้ำหนัก ${pet.weight > 0 ? pet.weight + ' กก.' : 'ไม่ได้ระบุ'}
              </span>
            </div>
          </div>
          <a href="pets.html" class="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 hover:text-teal-600 font-medium transition">
            จัดการ
          </a>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading dashboard pets:', err);
    countTotalEl.innerText = '0 ตัว';
    countDetailEl.innerText = 'เกิดข้อผิดพลาดในการดึงข้อมูล';
  }
}

function handleLogout() {
  if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  }
}