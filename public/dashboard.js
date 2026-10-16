document.addEventListener('DOMContentLoaded', () => {
    // 1. ดึงข้อมูล User จาก localStorage
    const user = JSON.parse(localStorage.getItem('user'));

    // เช็คกรณีไม่ได้ล็อกอิน
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    console.log('👉 Current User Session:', user);

    // 2. แสดงผลข้อมูล User บน Header / Banner
    const navUserName = document.getElementById('nav-user-name');
    const navUserRole = document.getElementById('nav-user-role');
    const welcomeUserName = document.getElementById('welcome-user-name');
    const infoUserEmail = document.getElementById('info-user-email');
    const infoUserPhone = document.getElementById('info-user-phone');

    if (navUserName) navUserName.textContent = user.full_name || user.email || 'ผู้ใช้งาน';
    if (welcomeUserName) welcomeUserName.textContent = user.full_name || 'สมาชิก';
    if (infoUserEmail) infoUserEmail.textContent = user.email || '-';
    if (infoUserPhone) infoUserPhone.textContent = user.phone || '-';

    if (navUserRole) {
        navUserRole.textContent = user.role || 'pet_owner';
        if (user.role === 'admin') {
            navUserRole.className = 'text-xs bg-amber-400 text-slate-900 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider';
        }
    }

    // 🟢 3. เปิดแสดงผลปุ่ม Admin ต่างๆ เมื่อ user.role === 'admin'
    if (user.role === 'admin') {
        const adminClinicMenu = document.getElementById('adminClinicMenu');
        const adminQueueMenu = document.getElementById('adminQueueMenu');
        const adminQueueCard = document.getElementById('adminQueueCard');
        const editClinicBtn = document.getElementById('editClinicBtn');

        if (adminClinicMenu) {
            adminClinicMenu.classList.remove('hidden');
            adminClinicMenu.classList.add('flex');
        }
        if (adminQueueMenu) {
            adminQueueMenu.classList.remove('hidden');
            adminQueueMenu.classList.add('flex');
        }
        if (adminQueueCard) {
            adminQueueCard.classList.remove('hidden');
            adminQueueCard.classList.add('block');
        }
        if (editClinicBtn) {
            editClinicBtn.classList.remove('hidden');
            editClinicBtn.classList.add('flex');
        }
    }

    // 4. ดึง ID ของ User (รองรับทั้ง user.id และ user.user_id)
    const userId = user.id || user.user_id;

    if (!userId) {
        console.error('❌ ไม่พบ ID ของผู้ใช้งานใน localStorage');
        showPetError('ไม่พบข้อมูลรหัสผู้ใช้ กรุณาล็อกอินใหม่อีกครั้ง');
        return;
    }

    // 5. โหลดรายการสัตว์เลี้ยง และสถานะคิว
    loadUserPets(userId);
    loadTodayQueue(userId);
    setInterval(() => {
        if (!document.hidden) loadTodayQueue(userId);
    }, 5000);

    // โหลดข้อมูลคลินิกมาแสดงบน Dashboard
    loadClinicInfo();
});

async function loadTodayQueue(userId) {
    const title = document.getElementById('today-queue-title');
    const detail = document.getElementById('today-queue-detail');
    if (!title || !detail) return;

    try {
        const response = await fetch(`/api/appointments/user/${encodeURIComponent(userId)}`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'โหลดสถานะคิวไม่สำเร็จ');

        const now = new Date();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const todayAppointments = (result.appointments || []).filter(appointment =>
            String(appointment.appointment_date).slice(0, 10) === todayKey
        );
        const activeAppointments = todayAppointments.filter(appointment =>
            ['pending', 'calling', 'in_progress'].includes(appointment.status)
        );

        if (!activeAppointments.length) {
            if (todayAppointments.some(appointment => appointment.status === 'completed')) {
                title.textContent = 'เสร็จสิ้นแล้ว';
                detail.textContent = `วันนี้ตรวจเสร็จ ${todayAppointments.filter(appointment => appointment.status === 'completed').length} คิว`;
            } else if (todayAppointments.length) {
                title.textContent = 'ไม่มีคิวที่กำลังดำเนินการ';
                detail.textContent = 'คิววันนี้ถูกยกเลิกแล้ว';
            } else {
                title.textContent = 'ไม่มีคิววันนี้';
                detail.textContent = 'ยังไม่มีนัดหมายสำหรับวันนี้';
            }
            return;
        }

        const currentQueue = activeAppointments.find(appointment => appointment.status === 'calling')
            || activeAppointments.find(appointment => appointment.status === 'in_progress')
            || activeAppointments[0];
        const statusLabels = {
            pending: 'รอเรียกคิว',
            calling: 'กำลังเรียกคิว',
            in_progress: 'กำลังตรวจ'
        };
        const time = String(currentQueue.appointment_time || '').slice(0, 5);
        const queuePosition = currentQueue.queue_position ? `คิวที่ ${currentQueue.queue_position}` : statusLabels[currentQueue.status];

        title.textContent = statusLabels[currentQueue.status] || 'มีคิววันนี้';
        detail.textContent = `${currentQueue.pet_name || 'สัตว์เลี้ยง'} · ${time} น. · ${queuePosition}${activeAppointments.length > 1 ? ` · อีก ${activeAppointments.length - 1} คิว` : ''}`;
    } catch (error) {
        title.textContent = 'โหลดสถานะคิวไม่ได้';
        detail.textContent = error.message || 'กรุณาลองใหม่อีกครั้ง';
    }
}

// ฟังก์ชันดึงสัตว์เลี้ยงจาก Backend API
async function loadUserPets(userId) {
    const container = document.getElementById('pets-list-container');
    const totalCountEl = document.getElementById('pet-count-total');
    const detailCountEl = document.getElementById('pet-count-detail');

    try {
        console.log(`📡 Fetching pets for userId: ${userId}...`);
        const response = await fetch(`/api/pets/user/${userId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP Error status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Pets API Response:', result);

        const pets = result.pets || result.data || [];

        if (result.success && Array.isArray(pets) && pets.length > 0) {
            const dogs = pets.filter(p => p.type === 'dog').length;
            const cats = pets.filter(p => p.type === 'cat').length;
            const others = pets.length - (dogs + cats);

            if (totalCountEl) totalCountEl.textContent = pets.length;
            if (detailCountEl) detailCountEl.textContent = `สุนัข ${dogs} | แมว ${cats}${others > 0 ? ` | อื่นๆ ${others}` : ''}`;

            container.innerHTML = pets.map(pet => `
                <div class="p-4 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="text-3xl">${getPetEmoji(pet.type)}</div>
                        <div>
                            <h4 class="font-bold text-slate-800">${escapeHtml(pet.name)}</h4>
                            <p class="text-xs text-slate-500">${escapeHtml(pet.breed || 'ไม่ระบุสายพันธุ์')} • ${pet.gender === 'male' ? 'ผู้' : pet.gender === 'female' ? 'เมีย' : 'ไม่ระบุ'}</p>
                        </div>
                    </div>
                    <a href="pets.html" class="text-xs text-teal-600 font-semibold hover:underline">แก้ไข</a>
                </div>
            `).join('');

        } else {
            if (totalCountEl) totalCountEl.textContent = '0';
            if (detailCountEl) detailCountEl.textContent = 'สุนัข 0 | แมว 0';
            container.innerHTML = `
                <div class="col-span-full py-6 text-center text-slate-400 border border-dashed rounded-xl">
                    ยังไม่มีข้อมูลสัตว์เลี้ยง <a href="pets.html" class="text-teal-600 font-semibold underline">คลิกเพิ่มสัตว์เลี้ยง</a>
                </div>
            `;
        }
    } catch (error) {
        console.error('❌ Error loading pets:', error);
        showPetError('ไม่สามารถดึงข้อมูลสัตว์เลี้ยงได้');
    }
}

function showPetError(message) {
    const container = document.getElementById('pets-list-container');
    const totalCountEl = document.getElementById('pet-count-total');
    const detailCountEl = document.getElementById('pet-count-detail');

    if (totalCountEl) totalCountEl.textContent = '0';
    if (detailCountEl) detailCountEl.textContent = 'เกิดข้อผิดพลาด';
    if (container) {
        container.innerHTML = `<div class="col-span-full text-center text-red-500 py-4 font-medium">${message}</div>`;
    }
}

function getPetEmoji(type) {
    switch (type) {
        case 'cat': return '🐱';
        case 'bird': return '🦜';
        case 'rabbit': return '🐰';
        case 'other': return '🐾';
        default: return '🐶';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}

async function loadClinicInfo() {
    try {
        const response = await fetch('/api/clinic');
        const result = await response.json();

        if (result.success && result.data) {
            const clinic = result.data;
            
            const nameEl = document.getElementById('display-clinic-name');
            const phoneEl = document.getElementById('display-clinic-phone');
            const hoursEl = document.getElementById('display-clinic-hours');
            const addressEl = document.getElementById('display-clinic-address');

            if (nameEl) nameEl.textContent = clinic.name || 'Pet Care Clinic';
            if (phoneEl) phoneEl.textContent = clinic.phone || '-';
            if (hoursEl) hoursEl.textContent = clinic.opening_hours || '-';
            if (addressEl) addressEl.textContent = clinic.address || '-';
        }
    } catch (error) {
        console.error('❌ Error loading clinic info:', error);
    }
}

async function handleLogout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (error) {}
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}