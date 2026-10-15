let currentUser = null;
let appointmentId = null;

/*document.addEventListener('DOMContentLoaded', async () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
        window.location.href = 'index.html';
        return;
    }
    currentUser = JSON.parse(userStr);
    document.getElementById('userInfo').innerText = `${currentUser.full_name} (${currentUser.role})`;

    // อ่าน appointment_id จาก URL parameter (?appointment_id=X)
    const urlParams = new URLSearchParams(window.location.search);
    appointmentId = urlParams.get('appointment_id');

    if (!appointmentId) {
        alert('ไม่พบรหัสคิวนัดหมาย');
        window.location.href = 'queue-manage.html';
        return;
    }

    loadAppointmentDetail();
});*/

async function loadAppointmentDetail() {
    try {
        const res = await fetch(`/api/appointments/${appointmentId}`);
        const data = await res.json();
        if (data.success && data.appointment) {
            const app = data.appointment;
            document.getElementById('appointmentDetail').innerHTML = `
                <b>🐾 ข้อมูลคนไข้:</b> ${app.pet_name} (${app.pet_type}) | 
                <b>เจ้าของ:</b> ${app.owner_name} <br>
                <b>อาการเบื้องต้น:</b> ${app.reason || 'ไม่ได้ระบุ'}
            `;
        }
    } catch (err) {
        document.getElementById('appointmentDetail').innerText = 'ไม่สามารถดึงข้อมูลนัดหมายได้';
    }
}

document.getElementById('treatmentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const body = {
        appointment_id: appointmentId,
        vet_id: currentUser.id,
        diagnosis: document.getElementById('diagnosis').value,
        medication_details: document.getElementById('medicationDetails').value,
        service_details: document.getElementById('serviceDetails').value
    };

    try {
        const res = await fetch('/api/prescriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await res.json();
        
        alert(result.message);
        if (result.success) {
            // เมื่อบันทึกสำเร็จ ให้กลับไปที่หน้าจัดการคิว (UC-07)
            window.location.href = 'queue-manage.html';
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลการรักษา');
    }
});