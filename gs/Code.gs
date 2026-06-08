/**
 * Portal Karyawan - Main Entry Point
 * Handles doGet/doPost routing and CORS
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const params = e.parameter || {};
    
    let postData = {};
    if (e.postData) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (err) {
        postData = {};
      }
    }
    
    const data = { ...params, ...postData };
    const action = data.action || '';
    
    let result;
    
    switch (action) {
      case 'initDatabase':
        result = initDatabase();
        break;
      case 'repairDatabase':
        result = repairDatabase();
        break;
      case 'login':
        result = handleLogin(data.email, data.password);
        break;
      case 'changePassword':
        result = changePasswordData(data.userId, data.oldPassword, data.newPassword);
        break;
      case 'getEmployeeProfile':
        result = getEmployeeProfile(data.userId);
        break;
      case 'getAttendance':
        result = getAttendance(data.userId);
        break;
      case 'getTodayAttendance':
        result = getTodayAttendance(data.userId);
        break;
      case 'saveAttendance':
        result = saveAttendanceData(data);
        break;
      case 'getAllAttendance':
        result = getAllAttendanceData();
        break;
      case 'getJournals':
        result = getJournals(data.userId);
        break;
      case 'saveJournal':
        result = saveJournalData(data);
        break;
      case 'getAllJournals':
        result = getAllJournalsData();
        break;
      case 'deleteJournal':
        result = deleteJournalData(data.id);
        break;
      case 'getLeaves':
        result = getLeaves(data.userId);
        break;
      case 'submitLeave':
        result = submitLeaveData(data);
        break;
      case 'approveLeave':
        result = approveLeaveData(data.id);
        break;
      case 'rejectLeave':
        result = rejectLeaveData(data.id);
        break;
      case 'getAllLeaves':
        result = getAllLeavesData();
        break;
      case 'deleteLeave':
        result = deleteLeaveData(data.id);
        break;
      case 'getIzin':
        result = getIzinData(data.userId);
        break;
      case 'submitIzin':
        result = submitIzinData(data);
        break;
      case 'approveIzin':
        result = approveIzinData(data.id);
        break;
      case 'rejectIzin':
        result = rejectIzinData(data.id);
        break;
      case 'getAllIzin':
        result = getAllIzinData();
        break;
      case 'deleteIzin':
        result = deleteIzinData(data.id);
        break;
      case 'getEmployees':
        result = getEmployeesData();
        break;
      case 'addEmployee':
        result = addEmployeeData(data);
        break;
      case 'updateEmployee':
        result = updateEmployeeData(data.id, data);
        break;
      case 'deleteEmployee':
        result = deleteEmployeeData(data.id);
        break;
      case 'getSettings':
        result = getSettingsData();
        break;
      case 'saveSetting':
        result = saveSettingData(data.key, data.value);
        break;
      case 'syncDailyShifts':
        result = autoUpdateDailyShifts();
        break;
      case 'setupDailyTrigger':
        result = setupDailyTrigger();
        break;
      case 'getShifts':
        result = getShiftsData();
        break;
      case 'addShift':
        result = addShiftData(data);
        break;
      case 'updateShift':
        result = updateShiftData(data.id, data);
        break;
      case 'deleteShift':
        result = deleteShiftData(data.id);
        break;
      case 'getDepartments':
        result = { success: true, data: getUniqueDepartments() };
        break;
      case 'getSchedule':
        result = getScheduleData(data.month, data.year);
        break;
      case 'saveSchedule':
        result = saveScheduleData(data);
        break;
      case 'getShiftScheduleForMonth':
        result = getShiftScheduleForMonth(data.yearMonth);
        break;
      case 'saveShiftScheduleBulk':
        result = saveShiftScheduleBulk(data.yearMonth, data.schedule);
        break;
      case 'saveShiftScheduleItem':
        result = saveShiftScheduleItemData(data.userId, data.date, data.shift);
        break;
      case 'getLocationSettings':
        result = { success: true, data: getLocationSettings() };
        break;
      case 'saveLocationSettings':
        result = saveLocationSettings(data.lat, data.lng, data.radius);
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
    
    return sendResponse(result);
    
  } catch (error) {
    return sendResponse({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}

function sendResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}