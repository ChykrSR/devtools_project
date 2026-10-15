let currentUser = null;

/*document.addEventListener('DOMContentLoaded', () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
        window.location.href = 'index.html';
        return;
    }
    currentUser = JSON.parse(userStr);
    document.getElementById('userInfo').innerText = `${currentUser.full_name} (${currentUser.role})`;
    document.getElementById('filterDate').value = new Date().toISOString().split('T')[0];

    loadQueues();
});*/

async function loadQueues() {
    const date = document.getElementById('filterDate').value;
    const status = document.getElementById('filterStatus').value;

    try {
        const res = await fetch(`/api/appointments?date=${date}&status=${status}`);
        const data = await res.json();
        const tbody = document.getElementById('queueList');

        if (!data.success || data.appointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ไม่พบข้อมูลคิวนัดหมาย</td></tr>';
            return;
        }

        const statusMap = {
            'pending': '<span class="badge bg-pending">รอเรียกคิว</span>',
            'calling': '<span class="badge bg-calling">กำลังเรียกคิว</span>',
            'completed': '<span class="badge bg-completed">เสร็จสิ้น</span>',
            'cancelled': '<span class="badge bg-cancelled">ยกเลิก</span>'
        };

        tbody.innerHTML = data.appointments.map(a => `
            <tr>
                <td><b>${a.appointment_time}</b></td>
                <td>${a.owner_name}</td>
                <td><b>${a.pet_name}</b> (${a.pet_type})</td>
                <td>${a.reason || '-'}</td>
                <td>${statusMap[a.status] || a.status}</td>
                <td>
                    ${a.status === 'pending' ? `<button class="btn btn-call" onclick="updateStatus(${a.id}, 'calling')">เรียกคิว</button>` : ''}
                    ${a.status !== 'completed' && a.status !== 'cancelled' ? `
                        <a href="treatment.html?appointment_id=${a.id}" class="btn btn-rx">ส่งเข้าตรวจ/สั่งยา</a>
                        <button class="btn btn-cancel" onclick="updateStatus(${a.id}, 'cancelled')">ยกเลิก</button>
                    ` : '<small style="color:#888;">เสร็จสิ้นแล้ว</small>'}
                </td>
            </tr>
        `).join('');
    } catch (err) { console.error(err); }
}

async function updateStatus(id, status) {
    try {
        const res = await fetch(`/api/appointments/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const result = await res.json();
        alert(result.message);
        loadQueues();
    } catch (err) { alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ'); }
}