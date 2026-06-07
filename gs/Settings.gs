/**
 * Portal Karyawan - Settings
 * Company settings, shifts, and schedule endpoints
 * Perbaikan: membaca working_days dengan benar, format waktu HH:MM
 */

// ========== SETTINGS ==========

function getSettingsData() {
  const sheet = getSheet('Settings');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { success: true, data: {} };
  }
  const data = sheet.getRange(1, 1, lastRow, 2).getDisplayValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    let key = data[i][0];
    const value = data[i][1];
    if (key && key.trim() !== '') {
      key = key.trim();
      settings[key] = value;
    }
  }
  console.log('Settings data loaded:', settings);
  return { success: true, data: settings };
}

function saveSettingData(key, value) {
  if (!key) {
    return { success: false, error: 'key is required' };
  }
  
  const sheet = getSheet('Settings');
  let lastRow = sheet.getLastRow();
  
  // Pastikan header ada
  if (lastRow === 0 || sheet.getRange(1, 1).getValue() !== 'key') {
    if (lastRow === 0) sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
    sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
    sheet.setFrozenRows(1);
    lastRow = sheet.getLastRow();
  }
  
  // Cari baris dengan key yang sama
  let foundRow = -1;
  if (lastRow > 1) {
    const keys = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]).trim() === String(key).trim()) {
        foundRow = i + 2; // +2 karena baris 1 header, baris 2 adalah data pertama
        break;
      }
    }
  }
  
  if (foundRow !== -1) {
    // Update existing
    sheet.getRange(foundRow, 2).setValue(value);
  } else {
    // Append new
    sheet.appendRow([key, value]);
  }
  
  // Trigger auto update shift jika jadwal berubah
  if (key.startsWith('shift_schedule_')) {
    try {
      autoUpdateDailyShifts();
    } catch(e) {
      console.error('Auto update shift gagal:', e);
    }
  }
  
  return { success: true, data: { key: key, value: value } };
}

/**
 * Automatisasi: Membaca jadwal dari sheet ShiftSchedule untuk hari ini 
 * dan memperbarui kolom 'shift' di tabel Employees.
 * Fungsi ini bisa dipanggil manual, via trigger jam 00:00, atau otomatis sesaat setelah Simpan Jadwal.
 */
function autoUpdateDailyShifts() {
  const jakartaDateStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  console.log(`[ShiftSync] Mulai sinkronisasi untuk Hari ini: ${jakartaDateStr}`);
  
  // Ambil semua data dari sheet ShiftSchedule (bukan dari Settings)
  const scheduleRows = getAllRows('ShiftSchedule');
  
  // Filter jadwal yang tanggalnya sama dengan hari ini
  const todaySchedules = scheduleRows.filter(row => {
    const rowDate = _parseDateToYMD(row.date);
    return rowDate === jakartaDateStr;
  });
  
  console.log(`[ShiftSync] Ditemukan ${todaySchedules.length} jadwal untuk hari ini`);
  
  const employeesRows = getAllRows('Employees');
  let updatedCount = 0;
  
  todaySchedules.forEach(schedule => {
    const userId = String(schedule.userId);
    const newShift = schedule.shift;
    
    if (userId && newShift) {
      // Cari karyawan berdasarkan ID
      const emp = employeesRows.find(e => String(e.id) === userId);
      
      if (emp && String(emp.shift).trim() !== String(newShift).trim()) {
        updateRow('Employees', userId, { shift: newShift });
        updatedCount++;
        console.log(`[ShiftSync] Updated ${userId}: ${emp.shift} -> ${newShift}`);
      }
    }
  });
  
  console.log(`[ShiftSync] SELESAI. Total Karyawan Diupdate: ${updatedCount}`);
  return { success: true, message: `Berhasil sinkronisasi fisik shift hari ini untuk ${updatedCount} karyawan` };
}

/**
 * Automatisasi: Memasang Trigger Time-Driven eksternal untuk autoUpdateDailyShifts
 * agar skrip tersebut berlari sendiri secara rahasia tiap tengah malam (00:00).
 */
function setupDailyTrigger() {
  // Hapus semua trigger autoUpdateDailyShifts yang sudah ada agar tidak bentrok
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'autoUpdateDailyShifts') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Bikin trigger baru untuk menyala setiap hari di jam 00:00 (Tengah Malam)
  ScriptApp.newTrigger('autoUpdateDailyShifts')
           .timeBased()
           .everyDays(1)
           .atHour(0)
           .create();

  return { success: true, message: 'Weker Shift Otomatis (Trigger 00:00) berhasil dipasang!' };
}

// ========== SHIFTS ==========

function getShiftsData() {
  const rows = getAllRows('Shifts');
  // Konversi waktu ke format HH:MM (dua digit jam)
  const fixed = rows.map(row => {
    return {
      id: row.id,
      name: row.name,
      startTime: formatTimeToHHMM(row.startTime),
      endTime: formatTimeToHHMM(row.endTime),
      date: row.date || '' // Tambahkan field date untuk sinkronisasi dengan database
    };
  });
  return { success: true, data: fixed };
}

/**
 * Convert berbagai format waktu ke "HH:MM" (dua digit jam, contoh "08:30")
 */
function formatTimeToHHMM(val) {
  if (!val) return '09:00';
  if (typeof val === 'string') {
    // Cek format HH:MM atau HH:MM:SS
    if (val.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
      return val.substring(0, 5);
    }
    // Jika ada huruf atau format lain, coba parse
    if (val.includes(':')) {
      let parts = val.split(':');
      let hour = parseInt(parts[0], 10);
      let minute = parseInt(parts[1], 10);
      if (isNaN(hour)) hour = 9;
      if (isNaN(minute)) minute = 0;
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
    return '09:00';
  }
  if (val instanceof Date) {
    const hour = val.getHours();
    const minute = val.getMinutes();
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
  return '09:00';
}

function addShiftData(data) {
  if (!data.name) {
    return { success: false, error: 'Shift name is required' };
  }
  
  data.id = getNextId('Shifts');
  if (!data.startTime) data.startTime = '09:00';
  if (!data.endTime) data.endTime = '18:00';
  if (!data.date) data.date = ''; // Tambahkan field date default kosong
  
  // Pastikan format waktu HH:MM
  data.startTime = formatTimeToHHMM(data.startTime);
  data.endTime = formatTimeToHHMM(data.endTime);
  
  addRow('Shifts', data);
  return { success: true, data: data };
}

function updateShiftData(id, data) {
  if (!id) {
    return { success: false, error: 'id is required' };
  }
  
  if (data.startTime) data.startTime = formatTimeToHHMM(data.startTime);
  if (data.endTime) data.endTime = formatTimeToHHMM(data.endTime);
  // Field date bisa diupdate jika ada
  
  const updated = updateRow('Shifts', id, data);
  if (updated) {
    return { success: true, data: updated };
  }
  return { success: false, error: 'Shift not found' };
}

function deleteShiftData(id) {
  if (!id) {
    return { success: false, error: 'id is required' };
  }
  
  const deleted = deleteRow('Shifts', id);
  if (deleted) {
    return { success: true, data: { id: id } };
  }
  return { success: false, error: 'Shift not found' };
}

// ========== SCHEDULE (Jadwal Shift Bulanan) ==========

/**
 * Mendapatkan data jadwal shift untuk periode tertentu dari sheet ShiftSchedule
 * @param {Date} startDate - Tanggal mulai
 * @param {Date} endDate - Tanggal akhir
 * @returns {Object} Data jadwal dalam format array
 */
function getScheduleData(startDate, endDate) {
  try {
    const sheet = getSheet('ShiftSchedule');
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return { success: true, data: [] };
    }
    
    const headers = sheet.getRange(1, 1, 1, 4).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    
    const result = [];
    const startStr = Utilities.formatDate(startDate, "Asia/Jakarta", "yyyy-MM-dd");
    const endStr = Utilities.formatDate(endDate, "Asia/Jakarta", "yyyy-MM-dd");
    
    // Gunakan object untuk mencegah duplikasi (key: userId_date)
    const uniqueMap = {};
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const dateStr = Utilities.formatDate(new Date(row[2]), "Asia/Jakarta", "yyyy-MM-dd");
      
      // Filter berdasarkan periode
      if (dateStr >= startStr && dateStr <= endStr) {
        const userId = String(row[1]);
        const uniqueKey = userId + '_' + dateStr;
        
        // Hanya ambil data terakhir jika ada duplikasi
        uniqueMap[uniqueKey] = {
          id: row[0],
          userId: userId,
          date: dateStr,
          shift: row[3]
        };
      }
    }
    
    // Convert map ke array
    for (const key in uniqueMap) {
      result.push(uniqueMap[key]);
    }
    
    return { success: true, data: result };
  } catch (e) {
    console.error('Error getScheduleData:', e);
    return { success: false, error: e.message, data: [] };
  }
}

/**
 * Menyimpan satu item jadwal shift ke database
 * @param {string} userId - ID karyawan
 * @param {string} dateStr - Tanggal dalam format YYYY-MM-DD
 * @param {string} shiftId - ID shift
 * @returns {Object} Hasil operasi
 */
function saveSingleSchedule(userId, dateStr, shiftId) {
  try {
    const sheet = getSheet('ShiftSchedule');
    
    // Pastikan header ada
    let lastRow = sheet.getLastRow();
    if (lastRow === 0 || sheet.getRange(1, 1).getValue() !== 'id') {
      if (lastRow === 0) sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, 4).setValues([['id', 'userId', 'date', 'shift']]);
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
      sheet.setFrozenRows(1);
      lastRow = sheet.getLastRow();
    }
    
    // Cari apakah sudah ada data untuk userId dan tanggal ini
    let foundRow = -1;
    if (lastRow > 1) {
      const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
      for (let i = 0; i < data.length; i++) {
        const rowUserId = String(data[i][1]);
        const rowDate = Utilities.formatDate(new Date(data[i][2]), "Asia/Jakarta", "yyyy-MM-dd");
        
        if (rowUserId === String(userId) && rowDate === dateStr) {
          foundRow = i + 2; // +2 karena baris 1 header
          break;
        }
      }
    }
    
    if (foundRow !== -1) {
      if (shiftId === '' || shiftId === null) {
        // Hapus data jika shift kosong
        sheet.deleteRow(foundRow);
        return { success: true, message: 'Shift deleted' };
      } else {
        // Update data existing
        sheet.getRange(foundRow, 4).setValue(shiftId);
        return { success: true, message: 'Shift updated' };
      }
    } else {
      if (shiftId === '' || shiftId === null) {
        // Tidak ada data untuk dihapus
        return { success: true, message: 'Nothing to delete' };
      } else {
        // Tambah data baru
        const newId = getNextId('ShiftSchedule');
        const dateObj = new Date(dateStr + 'T00:00:00');
        sheet.appendRow([newId, userId, dateObj, shiftId]);
        return { success: true, message: 'Shift created' };
      }
    }
  } catch (e) {
    console.error('Error saveSingleSchedule:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Menyimpan banyak item jadwal shift sekaligus
 * @param {Array} payload - Array objek {userId, date, shift}
 * @returns {Object} Hasil operasi
 */
function saveBulkSchedule(payload) {
  try {
    if (!payload || payload.length === 0) {
      return { success: true, message: 'No data to save' };
    }
    
    const sheet = getSheet('ShiftSchedule');
    
    // Pastikan header ada
    let lastRow = sheet.getLastRow();
    if (lastRow === 0 || sheet.getRange(1, 1).getValue() !== 'id') {
      if (lastRow === 0) sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, 4).setValues([['id', 'userId', 'date', 'shift']]);
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
      sheet.setFrozenRows(1);
      lastRow = sheet.getLastRow();
    }
    
    // Hapus semua data lama untuk periode yang sama (berdasarkan tanggal di payload)
    const datesToDelete = payload.map(p => p.date);
    const userIdsToDelete = payload.map(p => p.userId);
    
    if (lastRow > 1) {
      const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
      const rowsToDelete = [];
      
      for (let i = 0; i < data.length; i++) {
        const rowUserId = String(data[i][1]);
        const rowDate = Utilities.formatDate(new Date(data[i][2]), "Asia/Jakarta", "yyyy-MM-dd");
        
        // Cek apakah kombinasi userId dan date ada di payload
        for (let j = 0; j < payload.length; j++) {
          if (rowUserId === String(payload[j].userId) && rowDate === payload[j].date) {
            rowsToDelete.push(i + 2); // +2 karena baris 1 header
            break;
          }
        }
      }
      
      // Hapus dari bawah ke atas agar index tidak bergeser
      for (let i = rowsToDelete.length - 1; i >= 0; i--) {
        sheet.deleteRow(rowsToDelete[i]);
      }
    }
    
    // Tambah data baru
    const newRows = [];
    for (let i = 0; i < payload.length; i++) {
      const item = payload[i];
      if (item.shift && item.shift !== '') {
        const newId = getNextId('ShiftSchedule');
        const dateObj = new Date(item.date + 'T00:00:00');
        newRows.push([newId, item.userId, dateObj, item.shift]);
      }
    }
    
    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);
    }
    
    return { success: true, message: `Saved ${newRows.length} schedules` };
  } catch (e) {
    console.error('Error saveBulkSchedule:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Menyalin jadwal dari bulan sebelumnya ke bulan saat ini
 * @param {number} year - Tahun tujuan
 * @param {number} month - Bulan tujuan (0-11)
 * @returns {Object} Hasil operasi
 */
function copyScheduleFromLastMonth(year, month) {
  try {
    // Hitung bulan sebelumnya
    let prevYear = year;
    let prevMonth = month - 1;
    
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear = year - 1;
    }
    
    const startDate = new Date(prevYear, prevMonth, 1);
    const endDate = new Date(prevYear, prevMonth + 1, 0);
    
    // Ambil data dari bulan sebelumnya
    const prevDataResult = getScheduleData(startDate, endDate);
    
    if (!prevDataResult.success || !prevDataResult.data || prevDataResult.data.length === 0) {
      return { success: false, error: 'Tidak ada data jadwal di bulan sebelumnya' };
    }
    
    const prevData = prevDataResult.data;
    
    // Siapkan data untuk bulan baru
    const newPayload = [];
    
    for (let i = 0; i < prevData.length; i++) {
      const item = prevData[i];
      const prevDateParts = item.date.split('-');
      const prevDay = parseInt(prevDateParts[2], 10);
      
      // Cek apakah tanggal ini ada di bulan tujuan
      const daysInNewMonth = new Date(year, month + 1, 0).getDate();
      
      if (prevDay <= daysInNewMonth) {
        newPayload.push({
          userId: item.userId,
          date: `${year}-${(month + 1).toString().padStart(2, '0')}-${prevDay.toString().padStart(2, '0')}`,
          shift: item.shift
        });
      }
    }
    
    // Simpan data baru
    return saveBulkSchedule(newPayload);
    
  } catch (e) {
    console.error('Error copyScheduleFromLastMonth:', e);
    return { success: false, error: e.message };
  }
}

// ========== LEGACY SCHEDULE FUNCTIONS (untuk kompatibilitas) ==========

function getScheduleDataLegacy(month, year) {
  const key = `shift_schedule_${year}-${month}`;
  const settings = getAllRows('Settings');
  const entry = settings.find(s => String(s.key) === key);
  
  if (entry) {
    try {
      return { success: true, data: JSON.parse(entry.value) };
    } catch (e) {
      return { success: true, data: {} };
    }
  }
  
  return { success: true, data: {} };
}

function saveScheduleData(data) {
  if (!data.month || !data.year) {
    return { success: false, error: 'month and year are required' };
  }
  
  const key = `shift_schedule_${data.year}-${data.month}`;
  const scheduleData = data.schedule || {};
  
  return saveSettingData(key, JSON.stringify(scheduleData));
}