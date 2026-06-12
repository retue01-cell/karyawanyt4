/**
 * Portal Karyawan - Leave (Cuti)
 * Leave request endpoints
 */

function getLeaves(userId) {
  if (!userId) {
    return { success: false, error: 'userId is required' };
  }
  
  const rows = findRows('Leaves', 'userId', userId);
  rows.sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt)));
  
  return { success: true, data: rows };
}

function submitLeaveData(data) {
  if (!data.userId || !data.type || !data.startDate || !data.endDate) {
    return { success: false, error: 'Required fields missing' };
  }
  
  data.id = getNextId('Leaves');
  data.status = 'pending';
  data.appliedAt = new Date().toISOString();
  
  addRow('Leaves', data);
  return { success: true, data: data };
}

function approveLeaveData(id) {
  if (!id) {
    return { success: false, error: 'id is required' };
  }
  
  const updated = updateRow('Leaves', id, { status: 'approved' });
  if (updated) {
    // SINKRONISASI: Buat entry di tabel Attendance untuk setiap hari cuti
    _syncLeaveToAttendance(updated);
    return { success: true, data: updated };
  }
  return { success: false, error: 'Leave not found' };
}

function rejectLeaveData(id) {
  if (!id) {
    return { success: false, error: 'id is required' };
  }
  
  const updated = updateRow('Leaves', id, { status: 'rejected' });
  if (updated) {
    // SINKRONISASI: Hapus entry di tabel Attendance jika ada
    _removeSyncLeaveFromAttendance(updated);
    return { success: true, data: updated };
  }
  return { success: false, error: 'Leave not found' };
}

function getAllLeavesData() {
  const rows = getAllRows('Leaves');
  rows.sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt)));
  return { success: true, data: rows };
}

// ========== DELETE LEAVE ==========
function deleteLeaveData(id) {
  if (!id) {
    return { success: false, error: 'id is required' };
  }
  
  const deleted = deleteRow('Leaves', id);
  if (deleted) {
    return { success: true, data: { id: id } };
  }
  return { success: false, error: 'Leave request not found' };
}


// ========== SINKRONISASI KE ATTENDANCE ==========
/**
 * Sinkronisasi cuti yang disetujui ke tabel Attendance
 * Membuat entry untuk setiap hari dalam periode cuti dengan status = typeLabel cuti
 */
function _syncLeaveToAttendance(leaveData) {
  if (!leaveData || !leaveData.userId || !leaveData.startDate || !leaveData.endDate) {
    return;
  }
  
  const startDate = _parseLeaveDate(leaveData.startDate);
  const endDate = _parseLeaveDate(leaveData.endDate);
  
  if (!startDate || !endDate) {
    return;
  }
  
  const typeLabel = leaveData.typeLabel || leaveData.type || 'Cuti';
  const allAttendance = getAllRows('Attendance');
  
  // Loop setiap hari dari startDate hingga endDate
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = Utilities.formatDate(currentDate, 'Asia/Jakarta', 'yyyy-MM-dd');
    
    // Cek apakah sudah ada entry untuk user+date ini
    const existing = allAttendance.find(a => 
      String(a.userId) === String(leaveData.userId) && 
      _parseDateToYMD(a.date) === dateStr
    );
    
    // Data yang akan ditulis (hapus semua jam absensi, set status cuti)
    const attendanceData = {
      status: typeLabel,
      shift: typeLabel,
      clockIn: '',
      clockOut: '',
      breakStart: '',
      breakEnd: '',
      overtimeStart: '',
      verificationPhoto: '',
      verificationLocation: '',
      verificationTimestamp: ''
    };
    
    if (existing && existing.id) {
      // Update existing entry (timpa apapun yang ada)
      updateRow('Attendance', existing.id, attendanceData);
    } else {
      // Buat entry baru
      attendanceData.id = getNextId('Attendance');
      attendanceData.userId = leaveData.userId;
      attendanceData.date = dateStr;
      addRow('Attendance', attendanceData);
    }
    
    // Lanjut ke hari berikutnya
    currentDate.setDate(currentDate.getDate() + 1);
  }
}

/**
 * Helper untuk parse tanggal dari berbagai format
 */
function _parseLeaveDate(val) {
  if (!val) return null;
  
  if (val instanceof Date) {
    return val;
  }
  
  const valStr = String(val).trim();
  
  // Coba parse sebagai ISO string atau format lainnya
  try {
    const parsed = new Date(valStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (e) {
    // Abaikan
  }
  
  return null;
}

/**
 * Helper untuk parse tanggal ke format YYYY-MM-DD
 */
function _parseDateToYMD(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  
  const valStr = String(val).trim();
  
  // Deteksi Format ISO (yyyy-MM-dd atau yyyy/MM/dd)
  const ymdRegex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/;
  let match = valStr.match(ymdRegex);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  // Deteksi Format dd-MM-yyyy atau dd/MM/yyyy
  const dmyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/;
  match = valStr.match(dmyRegex);
  if (match) {
    const d = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    const y = match[3];
    return `${y}-${m}-${d}`;
  }
  
  // Fallback
  if (valStr.length >= 10) {
    return valStr.substring(0, 10);
  }
  return valStr;
}

/**
 * Hapus entry di tabel Attendance jika cuti ditolak
 */
function _removeSyncLeaveFromAttendance(leaveData) {
  if (!leaveData || !leaveData.userId || !leaveData.startDate || !leaveData.endDate) {
    return;
  }
  
  const startDate = _parseLeaveDate(leaveData.startDate);
  const endDate = _parseLeaveDate(leaveData.endDate);
  
  if (!startDate || !endDate) {
    return;
  }
  
  const typeLabel = leaveData.typeLabel || leaveData.type || 'Cuti';
  const allAttendance = getAllRows('Attendance');
  
  // Loop setiap hari dari startDate hingga endDate
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = Utilities.formatDate(currentDate, 'Asia/Jakarta', 'yyyy-MM-dd');
    
    // Cari entry yang sesuai dengan cuti ini (status = typeLabel cuti)
    const toDelete = allAttendance.find(a => 
      String(a.userId) === String(leaveData.userId) && 
      _parseDateToYMD(a.date) === dateStr &&
      (a.status === typeLabel || a.status === leaveData.type)
    );
    
    if (toDelete && toDelete.id) {
      deleteRow('Attendance', toDelete.id);
    }
    
    // Lanjut ke hari berikutnya
    currentDate.setDate(currentDate.getDate() + 1);
  }
}
