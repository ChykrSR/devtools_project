// ==========================================
// 1. ฟังก์ชันสลับแท็บ (Switch Tabs)
// ==========================================
let queuePollingTimer = null;
let isLoadingBookingHistory = false;
let lastBookingHistorySignature = null;
let previousQueueStatuses = new Map();

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
        const rawUser = localStorage.getItem('currentUser') || localStorage.getItem('user') || localStorage.getItem('loggedInUser');
        const navUserName = document.getElementById('nav-user-name');

        if (navUserName) {
            if (rawUser) {
                const user = JSON.parse(rawUser);
                navUserName.textContent = user.full_name || user.name || user.username || user.email || 'สมชาย ใจดี';
            } else {
                navUserName.textContent = 'สมชาย ใจดี'; // Fallback กรณีไม่มี Session
            }
        }
    } catch (err) {
        console.error('Error loading user info:', err);
        const navUserName = document.getElementById('nav-user-name');
        if (navUserName) navUserName.textContent = 'สมชาย ใจดี';
    }
}

// Helper: ดึงข้อมูล User จาก LocalStorage
function getCurrentUser() {
    try {
        const rawUser = localStorage.getItem('currentUser') || localStorage.getItem('user') || localStorage.getItem('loggedInUser');
        if (rawUser) return JSON.parse(rawUser);
    } catch (e) {
        console.error('Error parsing user:', e);
    }
    return { id: 1, full_name: 'สมชาย ใจดี' };
}

// ==========================================
// 3. ปุ่มออกจากระบบ (Logout)
// ==========================================
function handleLogout() {
    if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('user');
        localStorage.removeItem('loggedInUser');
        window.location.href = 'index.html';
    }
}

// ==========================================
// 4. โหลดรายการสัตว์เลี้ยงของผู้ใช้
// ==========================================
async function loadUserPets() {
    const petSelect = document.getElementById('petSelect');
    if (!petSelect) return;

    const user = getCurrentUser();

    try {
        const res = await fetch(`/api/pets/user/${user.id || 1}`);
        if (!res.ok) throw new Error('API Request failed');
        const data = await res.json();

        if (data.success && data.pets && data.pets.length > 0) {
            petSelect.innerHTML = '<option value="">-- เลือกสัตว์เลี้ยง --</option>' +
                data.pets.map(p => `<option value="${p.id}">${p.name} (${p.type || p.species || 'ไม่ระบุ'})</option>`).join('');
        } else {
            // Mock แสดงผลตัวอย่างกรณีใน DB ยังไม่มีสัตว์เลี้ยง
            petSelect.innerHTML = `
                <option value="">-- เลือกสัตว์เลี้ยง --</option>
                <option value="1">โคล่า (สุนัข)</option>
                <option value="2">มิลค์ (แมว)</option>
            `;
        }
    } catch (err) {
        console.warn('API /api/pets not available, using demo fallback');
        petSelect.innerHTML = `
            <option value="">-- เลือกสัตว์เลี้ยง --</option>
            <option value="1">โคล่า (สุนัข)</option>
            <option value="2">มิลค์ (แมว)</option>
        `;
    }
}

// ==========================================
// 5. บันทึกการจองคิวใหม่ (พร้อมระบบ Timeout ป้องกันค้าง)
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
        user_id: user.id || 1,
        pet_id: petSelect.value,
        pet_name: petSelect.options[petSelect.selectedIndex]?.text.split(' (')[0] || 'สัตว์เลี้ยง',
        appointment_date: appointmentDate.value,
        appointment_time: appointmentTime.value,
        reason: reason ? reason.value : ''
    };

    // Stop waiting if the booking API does not respond.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const res = await fetch('/api/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'จองคิวนัดหมายไม่สำเร็จ');
        alert(data.message || 'จองคิวนัดหมายสำเร็จเรียบร้อย!');
        document.getElementById('bookingForm').reset();
        switchTab('history');
    } catch (err) {
        clearTimeout(timeoutId);
        alert(err.message || 'ไม่สามารถบันทึกการจองได้ กรุณาลองใหม่');
    }
}

async function loadBookingHistory(silent = false) {
    const tableBody = document.getElementById('bookingHistoryTable');
    if (!tableBody || isLoadingBookingHistory) return;

    isLoadingBookingHistory = true;
    const user = getCurrentUser();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const res = await fetch(`/api/appointments/user/${encodeURIComponent(user.id || 1)}`, {
            signal: controller.signal
        });
        const data = await res.json();
        if (!res.ok || !data.success || !Array.isArray(data.appointments)) {
            throw new Error(data.message || 'โหลดสถานะคิวไม่สำเร็จ');
        }

        const appointments = data.appointments;
        const statusChanged = appointments.some(item =>
            previousQueueStatuses.has(String(item.id)) && previousQueueStatuses.get(String(item.id)) !== item.status
        );
        const nextStatuses = new Map(appointments.map(item => [String(item.id), item.status]));
        const signature = JSON.stringify(appointments.map(item => [item.id, item.status, item.queue_position]));

        if (signature !== lastBookingHistorySignature) {
            tableBody.innerHTML = renderBookingRows(appointments);
            lastBookingHistorySignature = signature;
        }
        previousQueueStatuses = nextStatuses;
        const updatedAt = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setQueueLiveStatus('live', `${statusChanged ? 'สถานะคิวเปลี่ยนแปลง · ' : ''}อัปเดตล่าสุด ${updatedAt}`);
    } catch (err) {
        setQueueLiveStatus('offline', 'เชื่อมต่อระบบคิวไม่ได้ · กำลังลองใหม่อัตโนมัติ');
        if (lastBookingHistorySignature === null) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-rose-600">${escapeHtml(err.message || 'ไม่สามารถโหลดสถานะคิวได้')}</td></tr>`;
        }
    } finally {
        clearTimeout(timeoutId);
        isLoadingBookingHistory = false;
    }
}

function renderBookingRows(appointments) {
    if (!appointments.length) {
        return '<tr><td colspan="5" class="text-center py-6 text-slate-400">ยังไม่มีประวัติการจองคิว</td></tr>';
    }

    const statuses = {
        pending: ['รอเรียกคิว', 'bg-amber-100 text-amber-800'],
        calling: ['กำลังเรียกคิว', 'bg-blue-100 text-blue-800'],
        in_progress: ['กำลังตรวจ', 'bg-indigo-100 text-indigo-800'],
        completed: ['เสร็จสิ้น', 'bg-emerald-100 text-emerald-800'],
        cancelled: ['ยกเลิก', 'bg-rose-100 text-rose-800']
    };

    return appointments.map(item => {
        const [statusLabel, statusClasses] = statuses[item.status] || ['ไม่ทราบสถานะ', 'bg-slate-100 text-slate-700'];
        const date = new Date(item.appointment_date);
        const dateFormatted = Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('th-TH');
        const queuePosition = item.queue_position ? `<p class="mt-1 text-xs font-semibold text-teal-700">ลำดับคิว ${Number(item.queue_position)}</p>` : '';

        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="px-4 py-3 font-medium text-slate-700">${dateFormatted}<br><span class="text-xs text-slate-400">${escapeHtml(String(item.appointment_time || '').slice(0, 5))} น.</span></td>
                <td class="px-4 py-3 font-semibold text-slate-800">${escapeHtml(item.pet_name || 'สัตว์เลี้ยง')}</td>
                <td class="px-4 py-3 text-xs text-slate-500">${escapeHtml(item.reason || '-')}</td>
                <td class="px-4 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses}">${statusLabel}</span>${queuePosition}</td>
                <td class="px-4 py-3 text-center">
                    ${item.status === 'pending' ? `<button onclick="cancelBooking(${Number(item.id)})" class="text-xs font-medium text-rose-600 hover:underline">ยกเลิก</button>` : '-'}
                </td>
            </tr>
        `;
    }).join('');
}

function setQueueLiveStatus(state, message) {
    const indicator = document.getElementById('queue-live-status');
    const dot = document.getElementById('queue-live-dot');
    if (!indicator || !dot) return;

    indicator.textContent = message;
    dot.className = state === 'live'
        ? 'h-2.5 w-2.5 rounded-full bg-emerald-500'
        : state === 'offline'
            ? 'h-2.5 w-2.5 rounded-full bg-rose-500'
            : 'h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse';
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function startQueueStatusPolling() {
    if (queuePollingTimer) clearInterval(queuePollingTimer);
    queuePollingTimer = setInterval(() => {
        const historyView = document.getElementById('viewHistory');
        if (!document.hidden && historyView && !historyView.classList.contains('hidden')) {
            loadBookingHistory(true);
        }
    }, 5000);
}

// ==========================================
// 7. ฟังก์ชันยกเลิกคิว
// ==========================================
async function cancelBooking(id) {
    if (!confirm('คุณต้องการยกเลิกการจองนัดหมายนี้ใช่หรือไม่?')) return;

    try {
        const response = await fetch(`/api/appointments/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'ยกเลิกคิวไม่สำเร็จ');
    } catch (err) {
        alert(err.message || 'ไม่สามารถยกเลิกคิวได้');
        return;
    }

    loadBookingHistory();
}

// ==========================================
// 8. เรียกทำงานทันทีเมื่อโหลดหน้าเว็บ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadUserPets();
    startQueueStatusPolling();

    if (new URLSearchParams(window.location.search).get('tab') === 'history') {
        switchTab('history');
    }
});