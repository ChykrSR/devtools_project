let currentUser = null;

function getLoggedInUser() {
    try {
        const raw = localStorage.getItem('user')
            || localStorage.getItem('currentUser')
            || localStorage.getItem('loggedInUser');
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

// แปลงวันที่จากฐานข้อมูลเป็น วัน/เดือน/ปี (DD/MM/YYYY) สำหรับแสดงในตาราง
function formatDateDMY(rawDate) {
    if (!rawDate) return '-';
    const str = String(rawDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, d] = str.split('-');
        return `${d}/${m}/${y}`;
    }
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return str;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

// แปลงวันที่ให้อยู่ในรูป YYYY-MM-DD ตามเวลาท้องถิ่นเพื่อใช้เปรียบเทียบ
function getLocalYMD(rawDate) {
    if (!rawDate) return '';
    const str = String(rawDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function setFilterToday() {
    const today = new Date();
    const localYMD = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    document.getElementById('filterDate').value = localYMD;
    loadQueues();
}

function resetFilters() {
    document.getElementById('filterDate').value = '';
    document.getElementById('filterStatus').value = 'all';
    loadQueues();
}

document.addEventListener('DOMContentLoaded', () => {
    currentUser = getLoggedInUser();

    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
        userInfoEl.textContent = `${currentUser.full_name || currentUser.name || 'ผู้ใช้งาน'} (${currentUser.role || 'staff'})`;
    }

    loadQueues();
});

async function loadQueues() {
    const date = document.getElementById('filterDate')?.value || '';
    const status = document.getElementById('filterStatus')?.value || 'all';

    const tbody = document.getElementById('queueList');
    const summaryEl = document.getElementById('queueSummary');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#64748b;">กำลังโหลดข้อมูลคิว...</td></tr>';

    let appointments = [];

    try {
        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (status && status !== 'all') params.append('status', status);

        const res = await fetch(`/api/appointments?${params.toString()}`);
        if (!res.ok) throw new Error('ไม่สามารถโหลดคิวจากเซิร์ฟเวอร์ได้');

        const data = await res.json();
        if (data.success && Array.isArray(data.appointments)) {
            appointments = data.appointments;
        }
    } catch (err) {
        console.warn('API Error, fallback to local mockAppointments:', err);
    }

    // Fallback กรณีไม่มีข้อมูลจากฐานข้อมูล ให้ดึงจาก LocalStorage
    if (appointments.length === 0) {
        const mockList = JSON.parse(localStorage.getItem('mockAppointments') || '[]');
        appointments = mockList
            .filter(item => (!date || getLocalYMD(item.appointment_date) === date))
            .filter(item => (status === 'all' || !status || item.status === status))
            .map(item => ({
                ...item,
                owner_name: item.owner_name || currentUser?.full_name || 'ลูกค้าทั่วไป',
                pet_type: item.pet_type || 'สัตว์เลี้ยง',
                isMock: true
            }));
    }

    if (summaryEl) {
        summaryEl.textContent = `ทั้งหมด ${appointments.length} คิว`;
    }

    if (appointments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#94a3b8;">ไม่พบข้อมูลคิวนัดหมายตามเงื่อนไขที่เลือก</td></tr>';
        return;
    }

    const statusMap = {
        'pending': '<span class="badge bg-pending">รอเรียกคิว</span>',
        'calling': '<span class="badge bg-calling">กำลังเรียกคิว</span>',
        'in_progress': '<span class="badge bg-inprogress">กำลังตรวจ</span>',
        'completed': '<span class="badge bg-completed">เสร็จสิ้น</span>',
        'cancelled': '<span class="badge bg-cancelled">ยกเลิก</span>'
    };

    tbody.innerHTML = appointments.map((a, index) => `
        <tr>
            <td><span class="queue-no">คิวที่ ${index + 1}</span></td>
            <td>
                <b>${formatDateDMY(a.appointment_date)}</b><br>
                <small style="color:#64748b;">เวลา ${a.appointment_time || '-'} น.</small>
            </td>
            <td>${a.owner_name || '-'}</td>
            <td><b>${a.pet_name || 'สัตว์เลี้ยง'}</b> <span style="color:#64748b;">(${a.pet_type || '-'})</span></td>
            <td>${a.reason || '-'}</td>
            <td>${statusMap[a.status] || a.status}</td>
            <td>
                <div class="action-group">
                    ${a.status === 'pending' ? `<button class="btn btn-call" onclick="updateStatus(${a.id}, 'calling', ${!!a.isMock})">เรียกคิว</button>` : ''}
                    ${a.status !== 'completed' && a.status !== 'cancelled' ? `
                        <a href="treatment.html?appointment_id=${a.id}" class="btn btn-rx">ส่งเข้าตรวจ/สั่งยา</a>
                        <button class="btn btn-cancel" onclick="updateStatus(${a.id}, 'cancelled', ${!!a.isMock})">ยกเลิก</button>
                    ` : '<small style="color:#94a3b8;">ดำเนินการแล้ว</small>'}
                </div>
            </td>
        </tr>
    `).join('');
}

async function updateStatus(id, status, isMock = false) {
    if (status === 'cancelled' && !confirm('คุณต้องการยกเลิกคิวนัดหมายนี้ใช่หรือไม่?')) {
        return;
    }

    if (isMock) {
        let mockList = JSON.parse(localStorage.getItem('mockAppointments') || '[]');
        mockList = mockList.map(item => item.id == id ? { ...item, status } : item);
        localStorage.setItem('mockAppointments', JSON.stringify(mockList));
        alert('อัปเดตสถานะคิวสำเร็จ');
        loadQueues();
        return;
    }

    try {
        const res = await fetch(`/api/appointments/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.message || 'อัปเดตสถานะไม่สำเร็จ');
        alert(result.message);
        loadQueues();
    } catch (err) {
        alert(err.message || 'เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    }
}

async function handleLogout() {
    if (!confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) return;
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    localStorage.removeItem('user');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('loggedInUser');
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    currentUser = getLoggedInUser();

    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
        userInfoEl.textContent = currentUser.full_name || currentUser.name || 'ผู้ใช้งาน';
    }

    loadQueues();
});