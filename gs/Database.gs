/**
 * Portal Karyawan - Database Helper
 * Generic CRUD operations for Google Sheets
 * 
 * PENTING: Ganti SPREADSHEET_ID dengan ID spreadsheet kamu
 */

const SPREADSHEET_ID = '1K8ZogDZS96LlSPSqf7J0eH25uvSyq6oHxgzlWWkBJ_4';

let _spreadsheet = null;

function getSpreadsheet() {
  if (!_spreadsheet) {
    _spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return _spreadsheet;
}

function getSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

// ========== PASTIKAN SHEET MEMILIKI HEADER ==========
function ensureSheetHasHeaders(sheetName, headers) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  // Jika sheet benar-benar kosong (tidak ada baris atau kolom)
  if (lastRow === 0 || lastCol === 0) {
    // Buat header
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  
  // Jika sheet memiliki data, pastikan baris pertama adalah header
  const firstRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  // Jika header tidak sesuai, timpa dengan header baru (hati-hati, ini akan menghapus data lama)
  // Untuk keamanan, kita hanya tambah kolom jika kurang
  if (firstRow.length < headers.length) {
    // Tambah kolom baru
    for (let i = firstRow.length; i < headers.length; i++) {
      sheet.insertColumnAfter(i);
      sheet.getRange(1, i + 1).setValue(headers[i]);
    }
  }
  return sheet;
}

// ========== INIT DATABASE ==========
function initDatabase() {
  const sheetsConfig = {
    'Users': ['id', 'name', 'email', 'password', 'role', 'avatar', 'createdAt'],
    'Employees': ['id', 'name', 'email', 'department', 'position', 'shift', 'status', 'joinDate', 'avatar', 'password'],
    'Attendance': ['id', 'userId', 'date', 'shift', 'clockIn', 'clockOut', 'breakStart', 'breakEnd', 'overtimeStart', 'status', 'verificationPhoto', 'verificationLocation', 'verificationTimestamp'],
    'Journals': ['id', 'userId', 'date', 'tasks', 'achievements', 'obstacles', 'plan', 'photo', 'updatedAt'],
    'Leaves': ['id', 'userId', 'type', 'typeLabel', 'startDate', 'endDate', 'duration', 'reason', 'status', 'appliedAt'],
    'Izin': ['id', 'userId', 'type', 'typeLabel', 'date', 'duration', 'reason', 'status', 'hasAttachment', 'verificationPhoto', 'verificationLocation', 'verificationTimestamp', 'appliedAt'],
    'Settings': ['key', 'value'],
    'Shifts': ['id', 'name', 'startTime', 'endTime', 'date'],
    'ShiftSchedule': ['id', 'userId', 'date', 'shift']
  };

  for (const [sheetName, headers] of Object.entries(sheetsConfig)) {
    ensureSheetHasHeaders(sheetName, headers);
  }

  seedDefaultData();
  
  try {
    setupDailyTrigger();
  } catch (e) {
    console.error("Gagal menginisialisasi trigger harian:", e);
  }
  
  return { success: true, message: 'Database initialized successfully' };
}

function repairDatabase() {
  return initDatabase();
}

function seedDefaultData() {
  // Users
  const usersSheet = getSheet('Users');
  if (usersSheet.getLastRow() <= 1) {
    usersSheet.appendRow([1, 'Admin User', 'admin@company.com', 'admin123', 'admin', 'https://ui-avatars.com/api/?name=Admin&background=F59E0B&color=fff', new Date().toISOString()]);
    usersSheet.appendRow([2, 'Dewi Karyawan', 'karyawan@company.com', 'karyawan123', 'karyawan', 'https://ui-avatars.com/api/?name=Dewi&background=3B82F6&color=fff', new Date().toISOString()]);
  }

  // Shifts
  const shiftsSheet = getSheet('Shifts');
  if (shiftsSheet.getLastRow() <= 1) {
    shiftsSheet.appendRow([1, 'Pagi', '08:30', '17:30', '']);
    shiftsSheet.appendRow([2, 'Siang', '14:00', '23:00', '']);
    shiftsSheet.appendRow([3, 'Malam', '23:00', '08:00', '']);
  }

  // Settings
  const settingsSheet = getSheet('Settings');
  if (settingsSheet.getLastRow() <= 1) {
    settingsSheet.appendRow(['company_name', 'Portal Karyawan']);
    settingsSheet.appendRow(['company_logo', '']);
    settingsSheet.appendRow(['working_days', JSON.stringify({senin:true, selasa:true, rabu:true, kamis:true, jumat:true, sabtu:false, minggu:false})]);
    settingsSheet.appendRow(['late_tolerance', '15']);
    settingsSheet.appendRow(['face_recognition', 'true']);
    settingsSheet.appendRow(['location_tracking', 'true']);
  }

  // Employees
  const empSheet = getSheet('Employees');
  if (empSheet.getLastRow() <= 1) {
    const employees = [
      [1, 'Ahmad Rizky', 'ahmad@company.com', 'IT', 'Developer', 'Pagi', 'active', '2024-01-15', 'https://ui-avatars.com/api/?name=Ahmad&background=3B82F6&color=fff', 'pass'],
      [2, 'Budi Santoso', 'budi@company.com', 'HR', 'HR Manager', 'Pagi', 'active', '2023-06-01', 'https://ui-avatars.com/api/?name=Budi&background=10B981&color=fff', 'pass'],
      [3, 'Citra Dewi', 'citra@company.com', 'Finance', 'Accountant', 'Pagi', 'on-leave', '2024-03-10', 'https://ui-avatars.com/api/?name=Citra&background=F59E0B&color=fff', ''],
      [4, 'Dedi Pratama', 'dedi@company.com', 'Marketing', 'Marketing Staff', 'Siang', 'active', '2024-02-20', 'https://ui-avatars.com/api/?name=Dedi&background=EF4444&color=fff', ''],
      [5, 'Eka Putri', 'eka@company.com', 'IT', 'UI/UX Designer', 'Pagi', 'active', '2024-01-05', 'https://ui-avatars.com/api/?name=Eka&background=8B5CF6&color=fff', 'pass'],
      [6, 'Fajar Nugraha', 'fajar@company.com', 'Operations', 'Supervisor', 'Malam', 'inactive', '2023-09-12', 'https://ui-avatars.com/api/?name=Fajar&background=6B7280&color=fff', '']
    ];
    employees.forEach(emp => empSheet.appendRow(emp));
  }
}

// ========== GENERIC CRUD (AMAN UNTUK SHEET KOSONG) ==========

function getAllRows(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  const data = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }
  return rows;
}

function findRows(sheetName, column, value) {
  const allRows = getAllRows(sheetName);
  return allRows.filter(row => String(row[column]) === String(value));
}

function findRow(sheetName, column, value) {
  const rows = findRows(sheetName, column, value);
  return rows.length > 0 ? rows[0] : null;
}

function addRow(sheetName, data) {
  const sheet = getSheet(sheetName);
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    throw new Error('Sheet ' + sheetName + ' has no headers. Run initDatabase first.');
  }
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const row = headers.map(header => data[header] !== undefined ? data[header] : '');
  sheet.appendRow(row);
  return data;
}

function updateRow(sheetName, id, data) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return null;
  const allData = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const headers = allData[0];
  const idColIndex = headers.indexOf('id');
  if (idColIndex === -1) return null;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idColIndex]) === String(id)) {
      headers.forEach((header, j) => {
        if (data[header] !== undefined && header !== 'id') {
          sheet.getRange(i + 1, j + 1).setValue(data[header]);
        }
      });
      return { ...rowToObject(headers, allData[i]), ...data };
    }
  }
  return null;
}

function deleteRow(sheetName, id) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return false;
  const allData = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const headers = allData[0];
  const idColIndex = headers.indexOf('id');
  if (idColIndex === -1) return false;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idColIndex]) === String(id)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function getNextId(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return 1;
  const allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = allData[0];
  const idColIndex = headers.indexOf('id');
  if (idColIndex === -1) return Date.now();
  let maxId = 0;
  for (let i = 1; i < allData.length; i++) {
    const id = Number(allData[i][idColIndex]);
    if (id > maxId) maxId = id;
  }
  return maxId + 1;
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, i) => { obj[header] = row[i]; });
  return obj;
}

// ========== SHIFT SCHEDULE (BARU) ==========

function ensureShiftScheduleInitialized() {
  const headers = ['id', 'userId', 'date', 'shift'];
  ensureSheetHasHeaders('ShiftSchedule', headers);
}

function getAllShiftSchedules() {
  ensureShiftScheduleInitialized();
  const sheet = getSheet('ShiftSchedule');
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  const data = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }
  return rows;
}

function getShiftScheduleForMonth(yearMonth) {
  try {
    ensureShiftScheduleInitialized();
    const all = getAllShiftSchedules();
    const result = {};
    
    if (!all || all.length === 0) {
      return { success: true, data: {} };
    }
    
    // Normalisasi yearMonth untuk pencocokan (pastikan format YYYY-MM dengan leading zero)
    let normalizedYearMonth = yearMonth;
    if (yearMonth.includes('-')) {
      const parts = yearMonth.split('-');
      const year = parts[0];
      const month = String(parseInt(parts[1], 10)).padStart(2, '0');
      normalizedYearMonth = `${year}-${month}`;
    }
    const expectedPrefix = normalizedYearMonth + '-';
    
    console.log('getShiftScheduleForMonth input:', yearMonth, 'normalized:', normalizedYearMonth, 'prefix:', expectedPrefix);
    
    // Gunakan map untuk mencegah duplikasi (key: userId_day)
    const uniqueMap = {};
    
    all.forEach(item => {
      if (item && item.date && item.userId) {
        const dateStr = String(item.date);
        
        // Cek apakah tanggal sesuai dengan bulan yang diminta
        const isMatch = dateStr.startsWith(expectedPrefix);
        
        if (isMatch) {
          const userId = String(item.userId);
          const dayParts = dateStr.split('-');
          if (dayParts.length >= 3) {
            const day = parseInt(dayParts[2], 10);
            if (!isNaN(day) && day >= 1 && day <= 31) {
              const uniqueKey = userId + '_' + day;
              // Simpan data terakhir jika ada duplikasi
              uniqueMap[uniqueKey] = {
                userId: userId,
                day: day,
                shift: item.shift || ''
              };
            }
          }
        }
      }
    });
    
    // Convert map ke format result yang diharapkan
    for (const key in uniqueMap) {
      const item = uniqueMap[key];
      if (!result[item.userId]) result[item.userId] = {};
      result[item.userId][item.day] = item.shift;
    }
    
    console.log('getShiftScheduleForMonth:', yearMonth, 'result:', result);
    return { success: true, data: result };
  } catch (e) {
    console.error('Error getShiftScheduleForMonth:', e);
    return { success: false, error: e.message, data: {} };
  }
}

function saveShiftScheduleItemData(userId, date, shift) {
  ensureShiftScheduleInitialized();
  if (!userId || !date) {
    return { success: false, error: 'userId and date required' };
  }
  
  // Normalisasi format tanggal (pastikan YYYY-MM-DD dengan leading zero)
  const normalizedDate = normalizeDate(date);
  
  console.log('saveShiftScheduleItemData:', userId, date, normalizedDate, shift);
  
  const all = getAllShiftSchedules();
  
  // Cari semua entri yang cocok untuk userId dan date ini
  const existingIndices = [];
  for (let i = 0; i < all.length; i++) {
    const item = all[i];
    const itemDate = normalizeDate(String(item.date));
    if (item && String(item.userId) === String(userId) && itemDate === normalizedDate) {
      existingIndices.push(i);
    }
  }
  
  if (existingIndices.length > 0) {
    // Data sudah ada, update atau hapus
    const firstExisting = all[existingIndices[0]];
    
    if (shift === '' || shift === null || shift === undefined) {
      // Hapus semua data duplikat jika shift kosong
      for (let i = existingIndices.length - 1; i >= 0; i--) {
        const idx = existingIndices[i];
        const itemToDelete = all[idx];
        deleteRow('ShiftSchedule', itemToDelete.id);
      }
      return { success: true, message: 'Shift deleted', data: { userId, date: normalizedDate, shift: '' } };
    } else {
      // Update data pertama, hapus duplikat lainnya
      if (existingIndices.length > 1) {
        for (let i = existingIndices.length - 1; i > 0; i--) {
          const idx = existingIndices[i];
          const itemToDelete = all[idx];
          deleteRow('ShiftSchedule', itemToDelete.id);
        }
      }
      // Update entri pertama
      updateRow('ShiftSchedule', firstExisting.id, { shift: shift });
      return { success: true, message: 'Shift updated', data: { userId, date: normalizedDate, shift } };
    }
  } else {
    // Data belum ada
    if (shift === '' || shift === null || shift === undefined) {
      // Tidak ada data untuk dihapus
      return { success: true, message: 'Nothing to delete', data: { userId, date: normalizedDate, shift: '' } };
    } else {
      // Tambah data baru
      const newId = getNextId('ShiftSchedule');
      const newRow = { id: newId, userId: String(userId), date: normalizedDate, shift: shift };
      addRow('ShiftSchedule', newRow);
      return { success: true, message: 'Shift created', data: newRow };
    }
  }
}

// Helper function untuk normalisasi tanggal ke format YYYY-MM-DD
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    const year = parts[0];
    const month = String(parseInt(parts[1], 10)).padStart(2, '0');
    const day = String(parseInt(parts[2], 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

function saveShiftScheduleBulk(yearMonth, scheduleData) {
  ensureShiftScheduleInitialized();
  if (!yearMonth || !scheduleData) {
    return { success: false, error: 'yearMonth and scheduleData required' };
  }
  
  // Normalisasi yearMonth ke format YYYY-MM dengan leading zero
  let normalizedYearMonth = yearMonth;
  if (yearMonth.includes('-')) {
    const parts = yearMonth.split('-');
    const year = parts[0];
    const month = String(parseInt(parts[1], 10)).padStart(2, '0');
    normalizedYearMonth = `${year}-${month}`;
  }
  
  console.log('saveShiftScheduleBulk:', yearMonth, 'normalized:', normalizedYearMonth);
  
  const all = getAllShiftSchedules();
  const toDelete = all.filter(item => {
    const itemDate = normalizeDate(String(item.date));
    return itemDate.startsWith(normalizedYearMonth + '-');
  });
  toDelete.forEach(item => deleteRow('ShiftSchedule', item.id));
  
  for (const userId in scheduleData) {
    const days = scheduleData[userId];
    for (const day in days) {
      const shift = days[day];
      if (shift && shift !== '') {
        const date = `${normalizedYearMonth}-${String(day).padStart(2, '0')}`;
        saveShiftScheduleItemData(userId, date, shift);
      }
    }
  }
  return { success: true, message: 'Bulk schedule saved' };
}

// ========== DEPARTMENTS ==========

/**
 * Mengambil daftar departemen unik dari sheet Employees
 * @returns {Array} Array of department names
 */
function getUniqueDepartments() {
  try {
    const sheet = getSheet('Employees');
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    
    const lastCol = sheet.getLastColumn();
    if (lastCol < 1) return [];
    
    const allData = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
    const headers = allData[0];
    
    // Cari index kolom 'department' (case-insensitive)
    let deptIndex = -1;
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].toLowerCase() === 'department') {
        deptIndex = i;
        break;
      }
    }
    
    if (deptIndex === -1) return [];
    
    const departments = [];
    const seen = {};
    
    // Mulai dari baris ke-2 (index 1) untuk skip header
    for (let i = 1; i < allData.length; i++) {
      const dept = allData[i][deptIndex];
      if (dept && typeof dept === 'string' && dept.trim() !== '') {
        const cleanDept = dept.trim();
        if (!seen[cleanDept]) {
          seen[cleanDept] = true;
          departments.push(cleanDept);
        }
      }
    }
    
    // Urutkan alfabetis
    departments.sort();
    return departments;
  } catch (e) {
    console.error('Error getUniqueDepartments:', e);
    return [];
  }
}
