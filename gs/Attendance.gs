/**
 * Portal Karyawan - Attendance
 * Attendance/Clock In-Out endpoints with date-specific shift definitions
 */

/**
 * Mengecek apakah karyawan memiliki izin/cuti yang disetujui pada tanggal tertentu
 * @param {string} userId - ID karyawan
 * @param {string} dateStr - tanggal (YYYY-MM-DD)
 * @returns {Object|null} - data izin/cuti jika ada, null jika tidak
 */
function getApprovedLeaveOrIzin(userId, dateStr) {
  const leaves = getAllRows('Leaves');
  const approvedLeave = leaves.find(l => 
    String(l.userId) === String(userId) &&
    l.status === 'approved' &&
    _parseDateToYMD(l.startDate) <= dateStr &&
    _parseDateToYMD(l.endDate) >= dateStr
  );
  if (approvedLeave) {
    return { type: 'cuti', typeLabel: approvedLeave.typeLabel };
  }

  const izins = getAllRows('Izin');
  const approvedIzin = izins.find(i => 
    String(i.userId) === String(userId) &&
    i.status === 'approved' &&
    _parseDateToYMD(i.date) === dateStr
  );
  if (approvedIzin) {
    return { type: 'izin', typeLabel: approvedIzin.typeLabel };
  }
  return null;
}

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

// Helper: normalisasi waktu ke format HH:MM
function _normalizeTime(val) {
  if (!val && val !== 0) return '';
  var str = String(val).trim();
  
  // 1. Sudah format HH:MM atau HH:MM:SS
  var match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    var hour = match[1].padStart(2, '0');
    var minute = match[2].padStart(2, '0');
    return hour + ':' + minute;
  }
  
  // 2. Format desimal (contoh: "14.31" atau 14.31) - konversi fraksi jam ke menit
  var num = parseFloat(str);
  if (!isNaN(num) && str.indexOf('.') !== -1) {
    var hourInt = Math.floor(num);
    var minuteDecimal = num - hourInt;
    var minuteInt = Math.round(minuteDecimal * 60);
    if (minuteInt === 60) {
      hourInt++;
      minuteInt = 0;
    }
    minuteInt = Math.min(59, minuteInt);
    return hourInt.toString().padStart(2, '0') + ':' + minuteInt.toString().padStart(2, '0');
  }
  
  // 3. Format angka bulat (jam saja)
  var intNum = parseInt(str, 10);
  if (!isNaN(intNum)) {
    return intNum.toString().padStart(2, '0') + ':00';
  }
  
  // fallback
  return str;
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
  // Normalisasi waktu shift
  if (found) {
    if (found.startTime) found.startTime = _normalizeTime(found.startTime);
    if (found.endTime) found.endTime = _normalizeTime(found.endTime);
  }
  return found;
}

function getAttendance(userId) {
  if (!userId) {
    return { success: false, error: 'userId is required' };
  }
  
  const rows = findRows('Attendance', 'userId', userId);
  rows.forEach(r => {
    r.date = _parseDateToYMD(r.date);
    // Normalisasi semua field waktu
    if (r.clockIn) r.clockIn = _normalizeTime(r.clockIn);
    if (r.clockOut) r.clockOut = _normalizeTime(r.clockOut);
    if (r.breakStart) r.breakStart = _normalizeTime(r.breakStart);
    if (r.breakEnd) r.breakEnd = _normalizeTime(r.breakEnd);
    if (r.overtimeStart) r.overtimeStart = _normalizeTime(r.overtimeStart);
  });
  
  // Sort by date descending
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  
  return { success: true, data: rows };
}

function getTodayAttendance(userId, dateStr) {
  if (!userId) {
    return { success: false, error: 'userId is required' };
  }
  
  // Tentukan tanggal: prioritaskan dari parameter, fallback ke waktu server Asia/Jakarta
  let today;
  if (dateStr) {
    today = _parseDateToYMD(dateStr);
  } else {
    today = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  
  const allRows = getAllRows('Attendance');
  
  const todayRecord = allRows.find(row => 
    String(row.userId) === String(userId) && _parseDateToYMD(row.date) === today
  );
  
  // CEK APAKAH ADA IZIN/CUTI YANG DISETUJUI
  const approved = getApprovedLeaveOrIzin(userId, today);
  if (approved) {
    // Override data attendance: tidak boleh absen, status = jenis cuti/izin
    return {
      success: true,
      data: {
        id: null,
        userId: userId,
        date: today,
        shift: approved.typeLabel, // misal "Cuti Tahunan", "Sakit", "Dinas Luar"
        clockIn: null,
        clockOut: null,
        breakStart: null,
        breakEnd: null,
        overtimeStart: null,
        status: approved.typeLabel, // status untuk keperluan UI
        verificationPhoto: '',
        verificationLocation: '',
        verificationTimestamp: '',
        isBlocked: true // flag khusus frontend
      }
    };
  }
  
  if (todayRecord) {
    todayRecord.date = _parseDateToYMD(todayRecord.date);
    // Normalisasi semua field waktu
    if (todayRecord.clockIn) todayRecord.clockIn = _normalizeTime(todayRecord.clockIn);
    if (todayRecord.clockOut) todayRecord.clockOut = _normalizeTime(todayRecord.clockOut);
    if (todayRecord.breakStart) todayRecord.breakStart = _normalizeTime(todayRecord.breakStart);
    if (todayRecord.breakEnd) todayRecord.breakEnd = _normalizeTime(todayRecord.breakEnd);
    if (todayRecord.overtimeStart) todayRecord.overtimeStart = _normalizeTime(todayRecord.overtimeStart);
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
  
  // NORMALISASI SEMUA WAKTU SEBELUM DIPROSES
  if (data.clockIn) data.clockIn = _normalizeTime(data.clockIn);
  if (data.clockOut) data.clockOut = _normalizeTime(data.clockOut);
  if (data.breakStart) data.breakStart = _normalizeTime(data.breakStart);
  if (data.breakEnd) data.breakEnd = _normalizeTime(data.breakEnd);
  if (data.overtimeStart) data.overtimeStart = _normalizeTime(data.overtimeStart);
  
  // CEK APAKAH ADA IZIN/CUTI YANG DISETUJUI - tolak absensi
  const approved = getApprovedLeaveOrIzin(data.userId, data.date);
  if (approved) {
    return { success: false, error: `Anda sedang ${approved.typeLabel} pada tanggal ini, tidak dapat melakukan absensi.` };
  }
  
  // If clocking in, determine if ontime or late menggunakan shift berdasarkan tanggal
  if (data.clockIn && !data.clockOut && !data.breakStart && !data.breakEnd && !data.overtimeStart) {
      // Get settings tolerance
      const settingsRows = getAllRows('Settings');
      const earlyThreshold = parseInt((settingsRows.find(s => String(s.key) === 'early_in_threshold') || {}).value || '60', 10);
      const diligentThreshold = parseInt((settingsRows.find(s => String(s.key) === 'diligent_threshold') || {}).value || '30', 10);
      const lateTolerance = parseInt((settingsRows.find(s => String(s.key) === 'late_tolerance') || {}).value || '15', 10);
      
      // Get shift start and end time berdasarkan tanggal
      const dateStr = _parseDateToYMD(data.date);
      const shiftDef = _getShiftForDate(data.shift, dateStr);
      let shiftStartTimeStr = "08:00"; // fallback
      let shiftEndTimeStr = "17:00"; // fallback
      
      if (shiftDef) {
          if (shiftDef.startTime) {
              if (shiftDef.startTime instanceof Date) {
                  const h = String(shiftDef.startTime.getHours()).padStart(2, '0');
                  const m = String(shiftDef.startTime.getMinutes()).padStart(2, '0');
                  shiftStartTimeStr = h + ':' + m;
              } else {
                  shiftStartTimeStr = String(shiftDef.startTime).substring(0, 5);
              }
          }
          if (shiftDef.endTime) {
              if (shiftDef.endTime instanceof Date) {
                  const h = String(shiftDef.endTime.getHours()).padStart(2, '0');
                  const m = String(shiftDef.endTime.getMinutes()).padStart(2, '0');
                  shiftEndTimeStr = h + ':' + m;
              } else {
                  shiftEndTimeStr = String(shiftDef.endTime).substring(0, 5);
              }
          }
      } else {
          // fallback: cari shift tanpa date
          const fallbackShift = getAllRows('Shifts').find(s => s.name === data.shift && (!s.date || s.date === ''));
          if (fallbackShift) {
              if (fallbackShift.startTime) {
                  shiftStartTimeStr = String(fallbackShift.startTime).substring(0,5);
              }
              if (fallbackShift.endTime) {
                  shiftEndTimeStr = String(fallbackShift.endTime).substring(0,5);
              }
          }
      }
      
      // Compare times
      const safeClockIn = String(data.clockIn).replace('.', ':');
      const safeShiftStart = String(shiftStartTimeStr).replace('.', ':');
      const safeShiftEnd = String(shiftEndTimeStr).replace('.', ':');
      
      const [inH, inM] = safeClockIn.split(':').map(Number);
      const [startH, startM] = safeShiftStart.split(':').map(Number);
      const [endH, endM] = safeShiftEnd.split(':').map(Number);
      
      let inMinutes = (inH || 0) * 60 + (inM || 0);
      const expectedMinutes = (startH || 0) * 60 + (startM || 0);
      let shiftEndMinutes = (endH || 0) * 60 + (endM || 0);
      const shiftStartMinutes = (startH || 0) * 60 + (startM || 0);
      
      // Handle shift malam yang melewati tengah malam (startTime > endTime)
      let isOvernight = shiftStartMinutes > shiftEndMinutes;
      if (isOvernight) {
          shiftEndMinutes += 24 * 60; // Tambah 24 jam untuk perbandingan
          // Jika clock in terjadi sebelum tengah malam (misal 22:00), biarkan seperti apa adanya
          // Jika clock in terjadi setelah tengah malam (misal 02:00), tambah 24 jam
          if (inMinutes < shiftStartMinutes && inMinutes <= (shiftEndMinutes - 24 * 60)) {
              inMinutes += 24 * 60;
          }
      }
      
      const diffMinutes = inMinutes - expectedMinutes; // positif = terlambat, negatif = lebih awal
      
      // Cek outside untuk clock in dengan penanganan shift malam
      let isOutside = false;
      if (isOvernight) {
          // Shift malam: valid jika clock in antara startTime s/d midnight ATAU midnight s/d endTime
          // Contoh: shift 22:00-06:00, valid jika 22:00-23:59 ATAU 00:00-06:00
          if (inMinutes >= shiftStartMinutes && inMinutes <= shiftEndMinutes) {
              isOutside = false;
          } else {
              isOutside = true;
          }
      } else {
          // Shift normal: outside jika clock in setelah endTime
          if (inMinutes > shiftEndMinutes) {
              isOutside = true;
          }
      }
      
      if (isOutside) {
          data.status = 'Outside';
      } else if (diffMinutes <= -earlyThreshold) {
          data.status = 'Early In';
      } else if (diffMinutes <= -diligentThreshold) {
          data.status = 'Rajin';
      } else if (diffMinutes <= lateTolerance) {
          data.status = 'On Time'; // ubah dari 'Tepat' menjadi 'On Time'
      } else {
          data.status = 'Terlambat';
      }
  }
  
  // Setelah data lengkap (clockIn dan clockOut ada), kita hitung ulang status
  if (data.clockIn && data.clockOut) {
      const dateStr = _parseDateToYMD(data.date);
      const shiftDef = _getShiftForDate(data.shift, dateStr);
      let shiftStartTimeStr = "08:00";
      let shiftEndTimeStr = "17:00";
      
      if (shiftDef) {
          if (shiftDef.startTime) {
              if (shiftDef.startTime instanceof Date) {
                  const h = String(shiftDef.startTime.getHours()).padStart(2, '0');
                  const m = String(shiftDef.startTime.getMinutes()).padStart(2, '0');
                  shiftStartTimeStr = h + ':' + m;
              } else {
                  shiftStartTimeStr = String(shiftDef.startTime).substring(0, 5);
              }
          }
          if (shiftDef.endTime) {
              if (shiftDef.endTime instanceof Date) {
                  const h = String(shiftDef.endTime.getHours()).padStart(2, '0');
                  const m = String(shiftDef.endTime.getMinutes()).padStart(2, '0');
                  shiftEndTimeStr = h + ':' + m;
              } else {
                  shiftEndTimeStr = String(shiftDef.endTime).substring(0, 5);
              }
          }
      } else {
          const fallbackShift = getAllRows('Shifts').find(s => s.name === data.shift && (!s.date || s.date === ''));
          if (fallbackShift) {
              if (fallbackShift.startTime) {
                  shiftStartTimeStr = String(fallbackShift.startTime).substring(0,5);
              }
              if (fallbackShift.endTime) {
                  shiftEndTimeStr = String(fallbackShift.endTime).substring(0,5);
              }
          }
      }
      
      const safeClockIn = String(data.clockIn).replace('.', ':');
      const safeClockOut = String(data.clockOut).replace('.', ':');
      const safeShiftStart = String(shiftStartTimeStr).replace('.', ':');
      const safeShiftEnd = String(shiftEndTimeStr).replace('.', ':');
      
      const [inH, inM] = safeClockIn.split(':').map(Number);
      const [outH, outM] = safeClockOut.split(':').map(Number);
      const [startH, startM] = safeShiftStart.split(':').map(Number);
      const [endH, endM] = safeShiftEnd.split(':').map(Number);
      
      let inMinutes = (inH || 0) * 60 + (inM || 0);
      let outMinutes = (outH || 0) * 60 + (outM || 0);
      let shiftStartMinutes = (startH || 0) * 60 + (startM || 0);
      let shiftEndMinutes = (endH || 0) * 60 + (endM || 0);
      
      // Penanganan shift malam (start > end)
      let isOvernight = shiftStartMinutes > shiftEndMinutes;
      if (isOvernight) {
          shiftEndMinutes += 24 * 60;
          if (inMinutes < shiftStartMinutes) inMinutes += 24 * 60;
          if (outMinutes < shiftStartMinutes) outMinutes += 24 * 60;
      }
      
      const settingsRows = getAllRows('Settings');
      const lateTolerance = parseInt((settingsRows.find(s => String(s.key) === 'late_tolerance') || {}).value || '15', 10);
      
      const isLate = (inMinutes > shiftStartMinutes + lateTolerance);
      const isEarlyOut = (outMinutes < shiftEndMinutes);
      
      let finalStatus = '';
      if (isLate && isEarlyOut) finalStatus = 'Late & Early Out';
      else if (isLate) finalStatus = 'Terlambat';
      else if (isEarlyOut) finalStatus = 'Early Out';
      else finalStatus = 'On Time';
      
      // Jika ada status 'Outside' atau 'Lembur' dari sebelumnya, prioritaskan
      if (data.status === 'Outside') finalStatus = 'Outside';
      else if (data.status === 'Lembur') finalStatus = 'Lembur';
      
      data.status = finalStatus;
  }
  
  // Cek outside untuk clock out
  if (data.clockOut) {
      const settingsRows = getAllRows('Settings');
      const outsideTolerance = parseInt((settingsRows.find(s => String(s.key) === 'outside_tolerance') || {}).value || '120', 10);
      const dateStr = _parseDateToYMD(data.date);
      const shiftDef = _getShiftForDate(data.shift, dateStr);
      let shiftStartTimeStr = "08:00";
      let shiftEndTimeStr = "17:00";
      
      if (shiftDef) {
          if (shiftDef.startTime) {
              if (shiftDef.startTime instanceof Date) {
                  const h = String(shiftDef.startTime.getHours()).padStart(2, '0');
                  const m = String(shiftDef.startTime.getMinutes()).padStart(2, '0');
                  shiftStartTimeStr = h + ':' + m;
              } else {
                  shiftStartTimeStr = String(shiftDef.startTime).substring(0, 5);
              }
          }
          if (shiftDef.endTime) {
              if (shiftDef.endTime instanceof Date) {
                  const h = String(shiftDef.endTime.getHours()).padStart(2, '0');
                  const m = String(shiftDef.endTime.getMinutes()).padStart(2, '0');
                  shiftEndTimeStr = h + ':' + m;
              } else {
                  shiftEndTimeStr = String(shiftDef.endTime).substring(0, 5);
              }
          }
      } else {
          const fallbackShift = getAllRows('Shifts').find(s => s.name === data.shift && (!s.date || s.date === ''));
          if (fallbackShift) {
              if (fallbackShift.startTime) {
                  shiftStartTimeStr = String(fallbackShift.startTime).substring(0,5);
              }
              if (fallbackShift.endTime) {
                  shiftEndTimeStr = String(fallbackShift.endTime).substring(0,5);
              }
          }
      }
      
      const safeClockOut = String(data.clockOut).replace('.', ':');
      const safeShiftStart = String(shiftStartTimeStr).replace('.', ':');
      const safeShiftEnd = String(shiftEndTimeStr).replace('.', ':');
      
      const [outH, outM] = safeClockOut.split(':').map(Number);
      const [startH, startM] = safeShiftStart.split(':').map(Number);
      const [endH, endM] = safeShiftEnd.split(':').map(Number);
      
      const outMinutes = (outH || 0) * 60 + (outM || 0);
      let shiftStartMinutes = (startH || 0) * 60 + (startM || 0);
      let shiftEndMinutes = (endH || 0) * 60 + (endM || 0);
      
      // Handle shift malam yang melewati tengah malam (startTime > endTime)
      let isOvernight = shiftStartMinutes > shiftEndMinutes;
      let adjustedOutMinutes = outMinutes;
      
      if (isOvernight) {
          // Untuk shift malam, tambah 24 jam pada endTime untuk perbandingan
          shiftEndMinutes += 24 * 60;
          // Jika clock out terjadi setelah tengah malam (misal 02:00), tambah 24 jam
          if (adjustedOutMinutes < shiftStartMinutes && adjustedOutMinutes <= (shiftEndMinutes - 24 * 60)) {
              adjustedOutMinutes += 24 * 60;
          }
      }
      
      // Cek outside untuk clock out dengan penanganan shift malam dan toleransi
      let isOutside = false;
      if (isOvernight) {
          // Shift malam: outside jika clock out sebelum startTime atau setelah endTime + tolerance
          if (adjustedOutMinutes < shiftStartMinutes || adjustedOutMinutes > shiftEndMinutes + outsideTolerance) {
              isOutside = true;
          }
      } else {
          // Shift normal: outside jika clock out sebelum startTime atau setelah endTime + tolerance
          if (outMinutes < shiftStartMinutes || outMinutes > shiftEndMinutes + outsideTolerance) {
              isOutside = true;
          }
      }
      
      if (isOutside) {
          data.status = 'Outside';
      }
  }
  
  // Cek status lembur jika overtimeStart diisi dan clockOut melebihi endTime
  if (data.overtimeStart && data.clockOut && data.status !== 'Outside') {
      const dateStr = _parseDateToYMD(data.date);
      const shiftDef = _getShiftForDate(data.shift, dateStr);
      let shiftEndTimeStr = "17:00";
      
      if (shiftDef && shiftDef.endTime) {
          if (shiftDef.endTime instanceof Date) {
              const h = String(shiftDef.endTime.getHours()).padStart(2, '0');
              const m = String(shiftDef.endTime.getMinutes()).padStart(2, '0');
              shiftEndTimeStr = h + ':' + m;
          } else {
              shiftEndTimeStr = String(shiftDef.endTime).substring(0, 5);
          }
      } else {
          const fallbackShift = getAllRows('Shifts').find(s => s.name === data.shift && (!s.date || s.date === ''));
          if (fallbackShift && fallbackShift.endTime) {
              shiftEndTimeStr = String(fallbackShift.endTime).substring(0,5);
          }
      }
      
      const safeClockOut = String(data.clockOut).replace('.', ':');
      const safeShiftEnd = String(shiftEndTimeStr).replace('.', ':');
      
      const [outH, outM] = safeClockOut.split(':').map(Number);
      const [endH, endM] = safeShiftEnd.split(':').map(Number);
      
      let outMinutes = (outH || 0) * 60 + (outM || 0);
      let endMinutes = (endH || 0) * 60 + (endM || 0);
      
      // Penanganan shift malam
      const safeShiftStart = shiftDef && shiftDef.startTime ? 
          (shiftDef.startTime instanceof Date ? 
              String(shiftDef.startTime.getHours()).padStart(2,'0') + ':' + String(shiftDef.startTime.getMinutes()).padStart(2,'0') : 
              String(shiftDef.startTime).substring(0,5)) : "08:00";
      const [startH, startM] = safeShiftStart.split(':').map(Number);
      const shiftStartMinutes = (startH || 0) * 60 + (startM || 0);
      
      if (endMinutes < shiftStartMinutes) {
          endMinutes += 24 * 60;
      }
      if (outMinutes > endMinutes) {
          data.status = 'Lembur';
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
    if (updated) {
      return { success: true, data: updated };
    } else {
      return { success: false, error: 'Gagal mengupdate data absensi. Silakan coba lagi.' };
    }
  } else {
    // Create new record
    data.id = getNextId('Attendance');
    addRow('Attendance', data);
    return { success: true, data: data };
  }
}

function getAllAttendanceData() {
  const rows = getAllRows('Attendance');
  rows.forEach(r => {
    r.date = _parseDateToYMD(r.date);
    // Normalisasi semua field waktu
    if (r.clockIn) r.clockIn = _normalizeTime(r.clockIn);
    if (r.clockOut) r.clockOut = _normalizeTime(r.clockOut);
    if (r.breakStart) r.breakStart = _normalizeTime(r.breakStart);
    if (r.breakEnd) r.breakEnd = _normalizeTime(r.breakEnd);
    if (r.overtimeStart) r.overtimeStart = _normalizeTime(r.overtimeStart);
  });
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return { success: true, data: rows };
}