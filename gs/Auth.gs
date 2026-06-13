/**
 * Portal Karyawan - Authentication
 * Login validation against Users sheet + Employees sheet (fallback)
 */

function handleLogin(email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email dan password harus diisi' };
  }
  
  // 1. Try Users sheet first (admin accounts)
  const user = findRow('Users', 'email', email);
  
  if (user) {
    if (String(user.password) !== String(password)) {
      return { success: false, error: 'Password salah' };
    }
    
    return {
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        readNotifs: user.readNotifs || '[]'
      }
    };
  }
  
  // 2. Fallback: Try Employees sheet (employee accounts)
  const employee = findRow('Employees', 'email', email);
  
  if (!employee) {
    return { success: false, error: 'Email tidak ditemukan' };
  }
  
  // Check password: use employee's password field if set, otherwise default "1234"
  var empPassword = employee.password ? String(employee.password) : '1234';
  if (String(password) !== empPassword) {
    return { success: false, error: 'Password salah' };
  }
  
  return {
    success: true,
    data: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: 'karyawan',
      department: employee.department || '',
      position: employee.position || '',
      shift: employee.shift || 'Pagi',
      avatar: employee.avatar || '',
      readNotifs: employee.readNotifs || '[]'
    }
  };
}

/**
 * Change password for a user/employee
 */
function changePasswordData(userId, oldPassword, newPassword) {
  if (!userId || !oldPassword || !newPassword) {
    return { success: false, error: 'Semua field harus diisi' };
  }
  
  if (newPassword.length < 4) {
    return { success: false, error: 'Password minimal 4 karakter' };
  }
  
  var errors = [];
  var foundAny = false;
  
  // Try Users sheet first
  var user = findRow('Users', 'id', userId);
  if (user) {
    foundAny = true;
    var currentPwd = user.password ? String(user.password) : '';
    if (currentPwd === String(oldPassword)) {
      updateRow('Users', userId, { password: newPassword });
      return { success: true, data: { message: 'Password berhasil diubah' } };
    } else {
      errors.push('Users');
    }
  }
  
  // Try Employees sheet
  var employee = findRow('Employees', 'id', userId);
  if (employee) {
    foundAny = true;
    var empPwd = employee.password ? String(employee.password) : '1234';
    if (empPwd === String(oldPassword)) {
      updateRow('Employees', userId, { password: newPassword });
      return { success: true, data: { message: 'Password berhasil diubah' } };
    } else {
      errors.push('Employees');
    }
  }
  
  if (foundAny) {
    return { success: false, error: 'Password lama salah' };
  }
  
  return { success: false, error: 'User tidak ditemukan' };
}

/**
 * Get employee profile data
 */
function getEmployeeProfile(userId) {
  if (!userId) {
    return { success: false, error: 'userId is required' };
  }
  
  // Try Employees sheet
  var employee = findRow('Employees', 'id', userId);
  if (employee) {
    return {
      success: true,
      data: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        department: employee.department || '',
        position: employee.position || '',
        shift: employee.shift || '',
        status: employee.status || '',
        joinDate: employee.joinDate || '',
        avatar: employee.avatar || ''
      }
    };
  }
  
  // Try Users sheet
  var user = findRow('Users', 'id', userId);
  if (user) {
    return {
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'admin',
        avatar: user.avatar || ''
      }
    };
  }
  
  return { success: false, error: 'User tidak ditemukan' };
}
