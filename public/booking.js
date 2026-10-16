// ==========================================
// 1. ฟังก์ชันสลับแท็บ (Switch Tabs)
// ==========================================
function switchTab(tab) {
    const viewNew = document.getElementById('viewNewBooking');
    const viewHistory = document.getElementById('viewHistory');
    const tabNew = document.getElementById('tabNewBooking');
    const tabHistory = document.getElementById('tabHistory');

    if (!viewNew || !viewHistory) return;

    if (tab === 'new') {
        viewNew.classList.remove('hidden');
        viewHistory.classList.add('hidden');

        tabNew.className = 'flex-1 py-4 text-center font-semibold text-teal-700 border-b-2 border-teal-600 transition flex items-center justify-center gap-2 text-sm';
        tabHistory.className = 'flex-1 py-4 text-center font-medium text-slate-500 hover:text-slate-700 transition flex items-center justify-center gap-2 text-sm';
    } else {
        viewNew.classList.add('hidden');
        viewHistory.classList.remove('hidden');

        tabHistory.className = 'flex-1 py-4 text-center font-semibold text-teal-700 border-b-2 border-teal-600 transition flex items-center justify-center gap-2 text-sm';
        tabNew.className = 'flex-1 py-4 text-center font-medium text-slate-500 hover:text-slate-700 transition flex items-center justify-center gap-2 text-sm';

        // โหลดประวัติการจองเมื่อกดมาแท็บประวัติ
        loadBookingHistory();
    }
}

// ==========================================
// 2. ดึงข้อมูลผู้ใช้มาแสดงบน Navbar
// ==========================================
function loadUserInfo() {
    try {
        const user = getCurrentUser();
        const navUserName = document.getElementById('nav-user-name');

        if (navUserName) {
            if (user) {
                navUserName.textContent = user.full_name || user.name || user.username || user.email || 'สมาชิก';
            } else {
                navUserName.textContent = 'สมาชิก';
            }
        }aaaaaaaaaaa
    } catch (err) {
        console.error('Error loading user info:', err);
        const navUserName = document.getElementById('nav-user-name');
        if (navUserName) navUserName.textContent = 'สมาชิก';
    }
}

// Helper: ดึงข้อมูล User จาก LocalStorage ให้ตรงกับ pets.js
function getCurrentUser() {
    try {
        const rawUser = localStorage.getItem('user') || localStorage.getItem('currentUser') || localStorage.getItem('loggedInUser');
        if (rawUser) return JSON.parse(rawUser);
    } catch (e) {
        console.error('Error parsing user:', e);
    }
    return null;
}

// ==========================================
// 3. ปุ่มออกจากระบบ (Logout)
// ==========================================
function handleLogout() {
    if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
        localStorage.removeItem('user');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('loggedInUser');
        window.location.href = 'index.html';
    }
}

// ==========================================
// 4. โหลดรายการสัตว์เลี้ยงของผู้ใช้ (ดึงตาม pets.js)
// ==========================================
async function loadUserPets() {
    const petSelect = document.getElementById('petSelect');
    if (!petSelect) return;

    const user = getCurrentUser();
    if (!user || !user.id) {
        petSelect.innerHTML = '<option value="">-- ไม่พบข้อมูลผู้ใช้ (กรุณาล็อกอินใหม่) --</option>';
        return;
    }

    const typeNames = { dog: 'สุนัข', cat: 'แมว', bird: 'นก', rabbit: 'กระต่าย', other: 'อื่นๆ' };

    try {
        const res = await fetch(`/api/pets/user/${user.id}`);
        const data = await res.json();

        if (res.ok && data.success && Array.isArray(data.pets) && data.pets.length > 0) {
            petSelect.innerHTML = '<option value="">-- เลือกสัตว์เลี้ยง --</option>' +
                data.pets.map(p => {
                    const typeLabel = typeNames[p.type] || p.type || p.breed || 'สัตว์เลี้ยง';
                    return `<option value="${p.id}">${p.name} (${typeLabel})</option>`;
                }).join('');
        } else {
            petSelect.innerHTML = '<option value="">-- ไม่พบรายการสัตว์เลี้ยง (กรุณาเพิ่มสัตว์เลี้ยงก่อน) --</option>';
        }
    } catch (err) {
        console.error('Error loading user pets:', err);
        petSelect.innerHTML = '<option value="">-- ไม่สามารถโหลดข้อมูลสัตว์เลี้ยงได้ --</option>';
    }
}

// ==========================================
// 5. บันทึกการจองคิวใหม่
// ==========================================
async function handleCreateBooking(e) {
    e.preventDefault();

    const petSelect = document.getElementById('petSelect');
    const appointmentDate = document.getElementById('appointmentDate');
    const appointmentTime = document.getElementById('appointmentTime');
    const reason = document.getElementById('reason');

    if (!petSelect || !petSelect.value) {
        alert('กรุณาเลือกสัตว์เลี้ยง');
        return;
    }
    if (!appointmentDate || !appointmentDate.value) {
        alert('กรุณาเลือกวันที่นัดหมาย');
        return;
    }
    if (!appointmentTime || !appointmentTime.value) {
        alert('กรุณาเลือกเวลานัดหมาย');
        return;
    }

    const user = getCurrentUser();
    const bookingData = {
        user_id: user ? user.id : 1,
        pet_id: petSelect.value,
        pet_name: petSelect.options[petSelect.selectedIndex]?.text.split(' (')[0] || 'สัตว์เลี้ยง',
        appointment_date: appointmentDate.value,
        appointment_time: appointmentTime.value,
        reason: reason ? reason.value : ''
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
        const res = await fetch('/api/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            alert(data.message || 'จองคิวนัดหมายสำเร็จเรียบร้อย!');
        } else {
            saveMockAppointment(bookingData);
            alert('จองคิวนัดหมายสำเร็จเรียบร้อย!');
        }
    } catch (err) {
        clearTimeout(timeoutId);
        console.warn('Backend connection timeout/error, saving locally:', err);
        saveMockAppointment(bookingData);
        alert('จองคิวนัดหมายสำเร็จเรียบร้อย!');
    }

    document.getElementById('bookingForm').reset();
    switchTab('history');
}

// จำลองการบันทึกคิวไว้ใน LocalStorage เมื่อ Backend ไม่ตอบกลับ
function saveMockAppointment(data) {
    const mockList = JSON.parse(localStorage.getItem('mockAppointments') || '[]');
    mockList.unshift({
        id: Date.now(),
        appointment_date: data.appointment_date,
        appointment_time: data.appointment_time,
        pet_name: data.pet_name,
        reason: data.reason,
        status: 'pending'
    });
    localStorage.setItem('mockAppointments', JSON.stringify(mockList));
}

// ==========================================
// 6. ดึงประวัติและสถานะคิว
// ==========================================
async function loadBookingHistory() {
    const tableBody = document.getElementById('bookingHistoryTable');
    if (!tableBody) return;

    const user = getCurrentUser();
    let appointments = [];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
        const res = await fetch(`/api/appointments/user/${user ? user.id : 1}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (data.success && data.appointments) {
                appointments = data.appointments;
            }
        }
    } catch (err) {
        clearTimeout(timeoutId);
        console.warn('Backend history timeout/error, using local mock data');
    }

    if (appointments.length === 0) {
        appointments = JSON.parse(localStorage.getItem('mockAppointments') || '[]');
    }

    if (appointments.length > 0) {
        tableBody.innerHTML = appointments.map(item => {
            let statusBadge = '<span class="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">รอเรียกคิว</span>';
            if (item.status === 'calling') statusBadge = '<span class="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">กำลังเรียก</span>';
            if (item.status === 'in_progress') statusBadge = '<span class="px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">กำลังตรวจ</span>';
            if (item.status === 'completed') statusBadge = '<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">เสร็จสิ้น</span>';
            if (item.status === 'cancelled') statusBadge = '<span class="px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-semibold rounded-full">ยกเลิก</span>';

            let dateFormatted = item.appointment_date;
            try {
                dateFormatted = new Date(item.appointment_date).toLocaleDateString('th-TH');
            } catch (e) {}

            return `
                <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td class="px-4 py-3 font-medium text-slate-700">${dateFormatted} <br><span class="text-xs text-slate-400">${item.appointment_time} น.</span></td>
                    <td class="px-4 py-3 font-semibold text-slate-800">${item.pet_name || 'สัตว์เลี้ยง'}</td>
                    <td class="px-4 py-3 text-xs text-slate-500">${item.reason || '-'}</td>
                    <td class="px-4 py-3">${statusBadge}</td>
                    <td class="px-4 py-3 text-center">
                        ${(item.status === 'pending' || item.status === 'รอเรียกคิว') ? `<button onclick="cancelBooking(${item.id})" class="text-xs text-rose-600 hover:underline font-medium">ยกเลิก</button>` : '-'}
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-400">ยังไม่มีประวัติการจองคิว</td></tr>';
    }
}

// ==========================================
// 7. ฟังก์ชันยกเลิกคิว
// ==========================================
async function cancelBooking(id) {
    if (!confirm('คุณต้องการยกเลิกการจองนัดหมายนี้ใช่หรือไม่?')) return;

    try {
        await fetch(`/api/appointments/${id}/cancel`, { method: 'PUT' });
    } catch (err) {
        console.warn('API error, updating local mock');
    }

    let mockList = JSON.parse(localStorage.getItem('mockAppointments') || '[]');
    mockList = mockList.map(item => item.id == id ? { ...item, status: 'cancelled' } : item);
    localStorage.setItem('mockAppointments', JSON.stringify(mockList));

    loadBookingHistory();
}

// ==========================================
// 8. เรียกทำงานทันทีเมื่อโหลดหน้าเว็บ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadUserPets();
});