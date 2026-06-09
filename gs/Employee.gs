/**
 * Portal Karyawan - Employee Management
 * Employee CRUD endpoints for admin
 */

function getEmployeesData() {
  const rows = getAllRows('Employees');
  return { success: true, data: rows };
}

function addEmployeeData(data) {
  if (!data.name || !data.email || !data.password) {
    return { success: false, error: 'Name, email and password are required' };
  }
  
  const existing = findRow('Employees', 'email', data.email);
  if (existing) {
    return { success: false, error: 'Email sudah terdaftar' };
  }
  
  data.id = getNextId('Employees');
  
  if (!data.avatar) {
    data.avatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(data.name) + '&background=F59E0B&color=fff';
  }
  
  // Default leave balance
  if (data.leaveBalance === undefined || data.leaveBalance === null) {
    data.leaveBalance = 12;
  }
  
  addRow('Employees', data);
  return { success: true, data: data };
}

function updateEmployeeData(id, data) {
  if (!id) {
    return { success: false, error: 'id is required' };
  }
  
  if (data.email) {
    const existing = findRow('Employees', 'email', data.email);
    if (existing && String(existing.id) !== String(id)) {
      return { success: false, error: 'Email sudah digunakan oleh karyawan lain' };
    }
  }
  
  const updated = updateRow('Employees', id, data);
  if (updated) {
    return { success: true, data: updated };
  }
  return { success: false, error: 'Employee not found' };
}

function deleteEmployeeData(id) {
  if (!id) {
    return { success: false, error: 'id is required' };
  }
  
  const deleted = deleteRow('Employees', id);
  if (deleted) {
    return { success: true, data: { id: id } };
  }
  return { success: false, error: 'Employee not found' };
}

// Get employee profile with leave balance
function getEmployeeProfile(userId) {
  if (!userId) {
    return { success: false, error: 'User ID required' };
  }
  
  const employee = findRow('Employees', 'id', userId);
  if (!employee) {
    return { success: false, error: 'Employee not found' };
  }
  
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
      avatar: employee.avatar || '',
      leaveBalance: employee.leaveBalance !== undefined ? employee.leaveBalance : 12
    }
  };
}

// Update employee email (self-service)
function updateEmployeeEmail(userId, newEmail, password) {
  if (!userId || !newEmail || !password) {
    return { success: false, error: 'Data tidak lengkap' };
  }
  
  const emp = findRow('Employees', 'id', userId);
  if (!emp) {
    return { success: false, error: 'User tidak ditemukan' };
  }
  
  // Verifikasi password
  const currentPwd = emp.password ? String(emp.password) : '1234';
  if (currentPwd !== String(password)) {
    return { success: false, error: 'Password salah' };
  }
  
  // Cek email sudah dipakai user lain
  const existing = findRow('Employees', 'email', newEmail);
  if (existing && String(existing.id) !== String(userId)) {
    return { success: false, error: 'Email sudah digunakan karyawan lain' };
  }
  
  updateRow('Employees', userId, { email: newEmail });
  return { success: true, message: 'Email berhasil diubah' };
}

// Update leave balance (admin only)
function updateEmployeeLeaveBalance(userId, leaveBalance) {
  if (!userId || leaveBalance === undefined) {
    return { success: false, error: 'Data tidak lengkap' };
  }
  
  const newBalance = parseInt(leaveBalance, 10);
  if (isNaN(newBalance) || newBalance < 0) {
    return { success: false, error: 'Jumlah cuti harus angka positif' };
  }
  
  updateRow('Employees', userId, { leaveBalance: newBalance });
  return { success: true, message: 'Sisa cuti berhasil diperbarui' };
}