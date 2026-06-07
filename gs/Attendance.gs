/**
 * Portal Karyawan - Attendance
 * Attendance/Clock In-Out endpoints with date-specific shift definitions
 */

function _parseDateToYMD(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  
  const valStr = String(val).trim();
  
  // 1. Deteksi Format ISO (yyyy-MM-dd atau yyyy/MM/dd)
  const ymdRegex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/;
  let match = valStr.match(ymdRegex);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  // 2. Deteksi Format dd-MM-yyyy atau dd/MM/yyyy (misal: 07/06/2026 atau 7/6/2026)
  // Format yang umum di regional Indonesia
  const dmyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/;
  match = valStr.match(dmyRegex);
  if (match) {
    const d = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    const y = match[3];
    return `${y}-${m}-${d}`;
  }
  
  // 3. Deteksi menggunakan parser Native JS Date sebagai pengaman terakhir
  try {
    const parsedDate = new Date(valStr);
    if (!isNaN(parsedDate.getTime())) {
      return Utilities.formatDate(parsedDate, 'Asia/Jakarta', 'yyyy-MM-dd');
    }
  } catch (e) {
    // Abaikan jika gagal parse
  }

  // Fallback cadangan jika panjang karakter mencukupi
  if (valStr.length >= 10) {
    return valStr.substring(0, 10);
  }
  return valStr;
}

// Helper: ambil shift definition yang sesuai dengan tanggal tertentu
function _getShiftForDate(shiftName, dateStr) {
  const allShifts = getAllRows('Shifts');
  // Cari shift yang namanya cocok dan tanggalnya sama (atau tanggal kosong untuk default)
  let found = null;
  // Prioritas: tanggal exact match
  for (let i = 0; i < allShifts.length; i++) {
    const s = allShifts[i];
    if (s.name === shiftName && s.date === dateStr) {
      found = s;
      break;
    }
  }
  if (!found) {
    // Cari shift dengan tanggal kosong (default)
    for (let i = 0; i < allShifts.length; i++) {
      const s = allShifts[i];
      if (s.name === shiftName && (!s.date || s.date === '')) {
        found = s;
        break;
      }
    }
  }
  return found;
}

function getAttendance(userId) {
  if (!userId) {
    return { success: false, error: 'userId is required' };
  }
  
  const rows = findRows('Attendance', 'userId', userId);
  rows.forEach(r => r.date = _parseDateToYMD(r.date));
  
  // Sort by date descending
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  
  return { success: true, data: rows };
}

function getTodayAttendance(userId) {
  if (!userId) {
    return { success: false, error: 'userId is required' };
  }
  
  const today = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  const allRows = getAllRows('Attendance');
  
  const todayRecord = allRows.find(row => 
    String(row.userId) === String(userId) && _parseDateToYMD(row.date) === today
  );
  
  if (todayRecord) {
    todayRecord.date = _parseDateToYMD(todayRecord.date);
    return { success: true, data: todayRecord };
  }
  
  // LOGIKA SINKRONISASI UTAMA: Tentukan shift hari ini dengan prioritas
  let todayShift = '';
  const scheduleRows = getAllRows('ShiftSchedule');
  
  // 1. Cek apakah ada jadwal pengecualian khusus untuk hari ini di ShiftSchedule
  const assigned = scheduleRows.find(row => 
    String(row.userId) === String(userId) && _parseDateToYMD(row.date) === today
  );
  
  if (assigned && assigned.shift) {
    todayShift = assigned.shift;
  } else {
    // 2. Jika tidak ada pengecualian, ambil default shift dari profil karyawan di Employees
    const emps = getAllRows('Employees');
    const emp = emps.find(e => String(e.id) === String(userId));
    if (emp && emp.shift) {
      todayShift = emp.shift;
    } else {
      todayShift = 'Pagi'; // Fallback mutlak jika profil belum diset
    }
  }
  
  // Ambal template respons kosong dengan shift hari ini yang valid
  return { 
    success: true, 
    data: {
      id: null,
      userId: userId,
      date: today,
      shift: todayShift,
      clockIn: '',
      clockOut: '',
      breakStart: '',
      breakEnd: '',
      overtimeStart: '',
      status: 'waiting',
      verificationPhoto: '',
      verificationLocation: '',
      verificationTimestamp: ''
    }
  };
}

function saveAttendanceData(data) {
  if (!data.userId || !data.date) {
    return { success: false, error: 'userId and date are required' };
  }
  
  // If clocking in, determine if ontime or late menggunakan shift berdasarkan tanggal
  if (data.clockIn && !data.clockOut && !data.breakStart && !data.breakEnd && !data.overtimeStart) {
      // Get settings tolerance
      const settingsRows = getAllRows('Settings');
      const earlyThreshold = parseInt((settingsRows.find(s => String(s.key) === 'early_in_threshold') || {}).value || '60', 10);
      const diligentThreshold = parseInt((settingsRows.find(s => String(s.key) === 'diligent_threshold') || {}).value || '30', 10);
      const lateTolerance = parseInt((settingsRows.find(s => String(s.key) === 'late_tolerance') || {}).value || '15', 10);
      
      // Get shift start time berdasarkan tanggal
      const dateStr = _parseDateToYMD(data.date);
      const shiftDef = _getShiftForDate(data.shift, dateStr);
      let shiftStartTimeStr = "08:00"; // fallback
      if (shiftDef && shiftDef.startTime) {
          if (shiftDef.startTime instanceof Date) {
              const h = String(shiftDef.startTime.getHours()).padStart(2, '0');
              const m = String(shiftDef.startTime.getMinutes()).padStart(2, '0');
              shiftStartTimeStr = h + ':' + m;
          } else {
              shiftStartTimeStr = String(shiftDef.startTime).substring(0, 5);
          }
      } else {
          // fallback: cari shift tanpa date
          const fallbackShift = getAllRows('Shifts').find(s => s.name === data.shift && (!s.date || s.date === ''));
          if (fallbackShift && fallbackShift.startTime) {
              shiftStartTimeStr = String(fallbackShift.startTime).substring(0,5);
          }
      }
      
      // Compare times
      const safeClockIn = String(data.clockIn).replace('.', ':');
      const safeShiftStart = String(shiftStartTimeStr).replace('.', ':');
      
      const [inH, inM] = safeClockIn.split(':').map(Number);
      const [startH, startM] = safeShiftStart.split(':').map(Number);
      
      const inMinutes = (inH || 0) * 60 + (inM || 0);
      const expectedMinutes = (startH || 0) * 60 + (startM || 0);
      
      const diffMinutes = inMinutes - expectedMinutes; // positif = terlambat, negatif = lebih awal
      
      if (diffMinutes <= -earlyThreshold) {
          data.status = 'Early In';
      } else if (diffMinutes <= -diligentThreshold) {
          data.status = 'Rajin';
      } else if (diffMinutes <= lateTolerance) {
          data.status = 'Tepat';
      } else {
          data.status = 'Terlambat';
      }
  }
  
  // Check if record exists for this user+date
  const allRows = getAllRows('Attendance');
  const existing = allRows.find(row => 
    String(row.userId) === String(data.userId) && _parseDateToYMD(row.date) === String(data.date)
  );
  
  if (existing && existing.id) {
    // Update existing record
    const updated = updateRow('Attendance', existing.id, data);
    return { success: true, data: updated };
  } else {
    // Create new record
    data.id = getNextId('Attendance');
    addRow('Attendance', data);
    return { success: true, data: data };
  }
}

function getAllAttendanceData() {
  const rows = getAllRows('Attendance');
  rows.forEach(r => r.date = _parseDateToYMD(r.date));
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return { success: true, data: rows };
}