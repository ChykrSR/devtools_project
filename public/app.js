// สั่งให้ทำงานเมื่อโหลดหน้าเว็บเสร็จสมบูรณ์
document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
});

// ฟังก์ชันดึงข้อมูลสมาชิกจาก Backend API
function loadUsers() {
  const userList = document.getElementById('user-list');

  fetch('/api/users')
    .then(response => {
      if (!response.ok) {
        throw new Error('ไม่สามารถดึงข้อมูลจาก Server ได้');
      }
      return response.json();
    })
    .then(users => {
      // เคลียร์รายการเก่าก่อนแสดงผลใหม่
      userList.innerHTML = '';

      // วนลูปนำข้อมูลที่ได้จาก MySQL มาสร้างแท็ก <li> แสดงบนหน้าเว็บ
      users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = `${user.id}. ${user.name}`;
        userList.appendChild(li);
      });
    })
    .catch(error => {
      console.error('Error:', error);
      userList.innerHTML = '<li style="color: red;">เกิดข้อผิดพลาดในการโหลดข้อมูล</li>';
    });
}