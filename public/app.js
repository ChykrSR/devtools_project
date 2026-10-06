function switchTab(tab) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginBtn = document.getElementById('tab-login-btn');
  const registerBtn = document.getElementById('tab-register-btn');
  hideAlert();

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginBtn.className = "w-1/2 py-3 text-center font-medium text-teal-600 border-b-2 border-teal-600 focus:outline-none";
    registerBtn.className = "w-1/2 py-3 text-center font-medium text-slate-500 border-b-2 border-transparent hover:text-teal-600 focus:outline-none";
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    registerBtn.className = "w-1/2 py-3 text-center font-medium text-teal-600 border-b-2 border-teal-600 focus:outline-none";
    loginBtn.className = "w-1/2 py-3 text-center font-medium text-slate-500 border-b-2 border-transparent hover:text-teal-600 focus:outline-none";
  }
}

function showAlert(message, isSuccess = false) {
  const alertBox = document.getElementById('alert-box');
  alertBox.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700');
  
  if (isSuccess) {
    alertBox.classList.add('bg-green-100', 'text-green-700');
  } else {
    alertBox.classList.add('bg-red-100', 'text-red-700');
  }
  alertBox.innerText = message;
}

function hideAlert() {
  document.getElementById('alert-box').classList.add('hidden');
}

// Handle Login
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (response.ok && data.success) {
      localStorage.setItem('user', JSON.stringify(data.user));
      showAlert('เข้าสู่ระบบสำเร็จ!', true);
      setTimeout(() => {
        alert(`ยินดีต้อนรับคุณ ${data.user.full_name} (${data.user.role})`);
      }, 500);
    } else {
      showAlert(data.message || 'เข้าสู่ระบบไม่สำเร็จ');
    }
  } catch (err) {
    showAlert('ไม่สามารถเชื่อมต่อกับ Server ได้');
  }
}

// Handle Register
async function handleRegister(e) {
  e.preventDefault();
  const full_name = document.getElementById('reg-fullname').value;
  const email = document.getElementById('reg-email').value;
  const phone = document.getElementById('reg-phone').value;
  const password = document.getElementById('reg-password').value;

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, email, phone, password })
    });

    const data = await response.json();
    if (response.ok && data.success) {
      showAlert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ', true);
      setTimeout(() => {
        switchTab('login');
        document.getElementById('login-email').value = email;
      }, 1000);
    } else {
      showAlert(data.message || 'การลงทะเบียนล้มเหลว');
    }
  } catch (err) {
    showAlert('ไม่สามารถเชื่อมต่อกับ Server ได้');
  }
}