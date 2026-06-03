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