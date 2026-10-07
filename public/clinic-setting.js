document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Authorization Check: เฉพาะ Admin เท่านั้น
    if (!user || user.role !== 'admin') {
        alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
        window.location.href = 'dashboard.html';
        return;
    }

    loadClinicData();

    document.getElementById('clinicForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            name: document.getElementById('clinicName').value,
            phone: document.getElementById('clinicPhone').value,
            email: document.getElementById('clinicEmail').value,
            tax_id: document.getElementById('clinicTaxId').value,
            opening_hours: document.getElementById('clinicHours').value,
            address: document.getElementById('clinicAddress').value,
        };

        try {
            const res = await fetch('/api/clinic', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            if (result.success) {
                alert('บันทึกข้อมูลคลินิกเรียบร้อยแล้ว');
            } else {
                alert('เกิดข้อผิดพลาด: ' + result.message);
            }
        } catch (err) {
            console.error(err);
            alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        }
    });
});

async function loadClinicData() {
    try {
        const res = await fetch('/api/clinic');
        const { success, data } = await res.json();
        
        if (success && data) {
            document.getElementById('clinicName').value = data.name || '';
            document.getElementById('clinicPhone').value = data.phone || '';
            document.getElementById('clinicEmail').value = data.email || '';
            document.getElementById('clinicTaxId').value = data.tax_id || '';
            document.getElementById('clinicHours').value = data.opening_hours || '';
            document.getElementById('clinicAddress').value = data.address || '';
        }
    } catch (err) {
        console.error('Error loading clinic data:', err);
    }
}