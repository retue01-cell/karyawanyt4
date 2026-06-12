/**
 * Portal Karyawan - Permission (Izin/Sakit)
 * Permission request endpoints
 */

function getIzinData(userId) {
  if (!userId) {
    return { success: false, error: 'userId is required' };
  }
  
  const rows = findRows('Izin', 'userId', userId);
  rows.sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt)));
  
  return { success: true, data: rows };
}

function submitIzinData(data) {
  if (!data.userId || !data.type || !data.date) {
    return { success: false, error: 'Required fields missing' };
  }
  
  data.id = getNextId('Izin');
  data.status = 'pending';
  data.appliedAt = new Date().toISOString();
  
  addRow('Izin', data);
  return { success: true, data: data };
}

function approveIzinData(id) {
  if (!id) {
    return { success: false, error: 'id is required' };
  }
  
  // Ambil data lengkap terlebih dahulu untuk memastikan semua field tersedia
  const allIzins = getAllRows('Izin');
  const izin = allIzins.find(i => String(i.id) === String(id));
  if (!izin) {
    return { success: false, error: 'Izin not found' };
  }
  
  const updated = updateRow('Izin', id, { status: 'approved' });
  if (updated) {
    // Gabungkan data lama dengan data baru untuk memastikan field lengkap
    const fullData = { ...izin, ...updated };
    // SINKRONISASI: Buat entry di tabel Attendance dengan status = typeLabel izin
    _syncIzinToAttendance(fullData);
    return { success: true, data: updated };
  }
  return { success: false, error: 'Izin not found' };
}

function rejectIzinData(id) {
  if (!id) {
    return { success: false, error: 'id is required' };
  }
  
  // Ambil data lengkap terlebih dahulu untuk memastikan semua field tersedia
  const allIzins = getAllRows('Izin');
  const izin = allIzins.find(i => String(i.id) === String(id));
  if (!izin) {
    return { success: false, error: 'Izin not found' };
  }
  
  const updated = updateRow('Izin', id, { status: 'rejected' });
  if (updated) {
    // Gabungkan data lama dengan data baru untuk memastikan field lengkap
    const fullData = { ...izin, ...updated };
    // SINKRONISASI: Hapus entry di tabel Attendance jika ada
    _removeSyncIzinFromAttendance(fullData);
    return { success: true, data: updated };
  }
  return { success: false, error: 'Izin not found' };
}

function getAllIzinData() {
  const rows = getAllRows('Izin');
  rows.sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt)));
  return { success: true, data: rows };
}

// ========== DELETE IZIN ==========
function deleteIzinData(id) {
  if (!id) {
    return { success: false, error: 'id is required' };
  }
  
  const deleted = deleteRow('Izin', id);
  if (deleted) {
    return { success: true, data: { id: id } };
  }
  return { success: false, error: 'Izin request not found' };
}


// ========== SINKRONISASI KE ATTENDANCE ==========
/**
 * Sinkronisasi izin yang disetujui ke tabel Attendance
 * Membuat entry dengan status = typeLabel izin pada tanggal izin
 */
function _syncIzinToAttendance(izinData) {
  if (!izinData || !izinData.userId) {
    console.error('Sync izin: missing userId', izinData);
    return;
  }
  
  const dateStr = _parseDateToYMD(izinData.date);
  if (!dateStr) {
    console.error('Sync izin: invalid date', izinData.date);
    return;
  }
  
  const typeLabel = izinData.typeLabel || izinData.type || 'Izin';
  
  // Cek apakah sudah ada entry attendance untuk user+date ini
  const allAttendance = getAllRows('Attendance');
  const existing = allAttendance.find(a => 
    String(a.userId) === String(izinData.userId) && 
    _parseDateToYMD(a.date) === dateStr
  );
  
  // Data yang akan ditulis (hapus semua jam absensi, set status izin)
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
    // Update existing entry dengan status izin (timpa apapun yang ada)
    updateRow('Attendance', existing.id, attendanceData);
    console.log('Updated attendance for', dateStr, 'with status', typeLabel);
  } else {
    // Buat entry baru di Attendance
    attendanceData.id = getNextId('Attendance');
    attendanceData.userId = izinData.userId;
    attendanceData.date = dateStr;
    addRow('Attendance', attendanceData);
    console.log('Created attendance for', dateStr, 'with status', typeLabel);
  }
}

/**
 * Helper untuk parse tanggal ke format YYYY-MM-DD
 * Digunakan untuk sinkronisasi
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
  
  // Fallback: gunakan native JS Date parser
  try {
    const parsedDate = new Date(valStr);
    if (!isNaN(parsedDate.getTime())) {
      return Utilities.formatDate(parsedDate, 'Asia/Jakarta', 'yyyy-MM-dd');
    }
  } catch (e) {
    // Abaikan jika gagal parse
  }

  if (valStr.length >= 10) {
    return valStr.substring(0, 10);
  }
  return valStr;
}

/**
 * Hapus entry di tabel Attendance jika izin ditolak
 */
function _removeSyncIzinFromAttendance(izinData) {
  if (!izinData || !izinData.userId || !izinData.date) {
    return;
  }
  
  const dateStr = _parseDateToYMD(izinData.date);
  const allAttendance = getAllRows('Attendance');
  
  // Cari entry yang sesuai dengan izin ini (status = typeLabel izin)
  const toDelete = allAttendance.find(a => 
    String(a.userId) === String(izinData.userId) && 
    _parseDateToYMD(a.date) === dateStr &&
    (a.status === (izinData.typeLabel || izinData.type || 'Izin'))
  );
  
  if (toDelete && toDelete.id) {
    deleteRow('Attendance', toDelete.id);
  }
}
