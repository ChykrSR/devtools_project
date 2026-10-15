let currentUser = null;
let appointmentId = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch (error) {
        currentUser = null;
    }

    if (!currentUser) {
        alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
        window.location.href = 'index.html';
        return;
    }
    document.getElementById('userInfo').textContent = `${currentUser.full_name || 'ผู้ใช้งาน'} (${currentUser.role || 'staff'})`;

    const urlParams = new URLSearchParams(window.location.search);
    appointmentId = urlParams.get('appointment_id');

    if (!appointmentId) {
        alert('ไม่พบรหัสคิวนัดหมาย');
        window.location.href = 'queue-manage.html';
        return;
    }

    await loadAppointmentDetail();
});

async function loadAppointmentDetail() {
    try {
        const res = await fetch(`/api/appointments/${appointmentId}`);
        const data = await res.json();
        if (!res.ok || !data.success || !data.appointment) throw new Error(data.message || 'ไม่พบข้อมูลนัดหมาย');

        const app = data.appointment;
        document.getElementById('appointmentDetail').textContent =
            `🐾 ข้อมูลคนไข้: ${app.pet_name} (${app.pet_type}) | เจ้าของ: ${app.owner_name} | อาการเบื้องต้น: ${app.reason || 'ไม่ได้ระบุ'}`;
    } catch (err) {
        document.getElementById('appointmentDetail').textContent = err.message || 'ไม่สามารถดึงข้อมูลนัดหมายได้';
        document.getElementById('treatmentForm').querySelector('button[type="submit"]').disabled = true;
    }
}

document.getElementById('recordVaccination').addEventListener('change', event => {
    const fields = document.getElementById('vaccinationFields');
    const enabled = event.target.checked;
    fields.hidden = !enabled;
    document.getElementById('vaccineName').required = enabled;
    document.getElementById('vaccineDate').required = enabled;
    if (enabled && !document.getElementById('vaccineDate').value) {
        document.getElementById('vaccineDate').value = new Date().toISOString().slice(0, 10);
    }
});

document.getElementById('treatmentForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const hasVaccination = document.getElementById('recordVaccination').checked;
    const body = {
        appointment_id: appointmentId,
        vet_id: currentUser.id,
        diagnosis: document.getElementById('diagnosis').value,
        medication_details: document.getElementById('medicationDetails').value,
        service_details: document.getElementById('serviceDetails').value,
        vaccination: hasVaccination ? {
            vaccine_name: document.getElementById('vaccineName').value.trim(),
            lot_number: document.getElementById('vaccineLot').value.trim(),
            administered_at: document.getElementById('vaccineDate').value,
            next_due_date: document.getElementById('vaccineNextDate').value || null,
            notes: document.getElementById('vaccineNotes').value.trim()
        } : null
    };

    const submitButton = e.currentTarget.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
        const res = await fetch('/api/prescriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.message || 'บันทึกการรักษาไม่สำเร็จ');

        alert(result.message);
        window.location.href = 'queue-manage.html';
    } catch (err) {
        alert(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลการรักษา');
        submitButton.disabled = false;
    }
});