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
  
  const updated = updateRow('Izin', id, { status: 'approved' });
  if (updated) {
    return { success: true, data: updated };
  }
  return { success: false, error: 'Izin not found' };
}

function rejectIzinData(id) {
  if (!id) {
    return { success: false, error: 'id is required' };
  }
  
  const updated = updateRow('Izin', id, { status: 'rejected' });
  if (updated) {
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