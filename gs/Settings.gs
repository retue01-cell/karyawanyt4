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
 * Automatisasi: Membaca jadwal Admin untuk hari ini dan memaksanya ke kolom 'shift' di tabel Employees.
 * Fungsi ini bisa dipanggil manual, via trigger jam 00:00, atau otomatis sesaat setelah Simpan Jadwal.
 */
function autoUpdateDailyShifts() {
  const jakartaDateStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  const dateParts = jakartaDateStr.split('-');
  const currentYear = parseInt(dateParts[0], 10);
  const currentMonth = parseInt(dateParts[1], 10) - 1; // JS month 0-index
  const currentDay = parseInt(dateParts[2], 10);
  
  const key = `shift_schedule_${currentYear}-${currentMonth}`;
  console.log(`[ShiftSync] Mulai sinkronisasi untuk Hari ini: ${currentDay}, Kunci Bulan: ${key}`);
  
  const settingsRows = getAllRows('Settings');
  let monthScheduleStr = null;
  settingsRows.forEach(row => {
    if (String(row.key) === key) {
      monthScheduleStr = row.value;
    }
  });
  
  if (!monthScheduleStr) {
    console.log(`[ShiftSync] Gagal: Tidak ada string pengaturan untuk ${key}`);
    return { success: false, error: 'Belum ada jadwal bulan ini' };
  }
  
  let schedules;
  try {
    schedules = JSON.parse(monthScheduleStr);
    console.log(`[ShiftSync] Berhasil parsing JSON jadwal. Mengandung ID karyawan:`, Object.keys(schedules));
  } catch (e) {
    console.log(`[ShiftSync] Gagal JSON parse:`, e);
    return { success: false, error: 'Gagal membaca format jadwal' };
  }
  
  const employeesRows = getAllRows('Employees');
  let updatedCount = 0;
  
  employeesRows.forEach(emp => {
    const stringId = String(emp.id);
    if (schedules[stringId] && schedules[stringId][currentDay]) {
      const assignedShift = schedules[stringId][currentDay];
      if (assignedShift && String(emp.shift).trim() !== String(assignedShift).trim()) {
        updateRow('Employees', emp.id, { shift: assignedShift });
        updatedCount++;
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
      endTime: formatTimeToHHMM(row.endTime)
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

function getScheduleData(month, year) {
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