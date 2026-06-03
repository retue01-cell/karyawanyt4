/**
 * Portal Karyawan - Journal
 * Daily work journal endpoints
 */

function getJournals(userId) {
  if (!userId) return { success: false, error: 'userId required' };
  const rows = findRows('Journals', 'userId', userId);
  rows.forEach(r => { if (r.date && typeof r.date === 'object') r.date = Utilities.formatDate(r.date, 'Asia/Jakarta', 'yyyy-MM-dd'); });
  rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  return { success: true, data: rows };
}

function saveJournalData(data) {
  if (!data.userId || !data.date) return { success: false, error: 'userId and date required' };
  let journalDate = data.date;
  if (journalDate && journalDate.indexOf('T')>0) journalDate = journalDate.split('T')[0];
  data.date = journalDate;
  const allRows = getAllRows('Journals');
  const existing = allRows.find(row => String(row.userId)===String(data.userId) && String(row.date)===String(data.date));
  data.updatedAt = new Date().toISOString();
  if (existing && existing.id) {
    const updated = updateRow('Journals', existing.id, data);
    return { success: true, data: updated };
  } else {
    data.id = getNextId('Journals');
    addRow('Journals', data);
    return { success: true, data: data };
  }
}

function getAllJournalsData() {
  const rows = getAllRows('Journals');
  rows.forEach(r => {
    if (r.date && typeof r.date === 'object') r.date = Utilities.formatDate(r.date, 'Asia/Jakarta', 'yyyy-MM-dd');
    else if (r.date && r.date.includes('T')) r.date = r.date.split('T')[0];
    if (!r.date && r.updatedAt) r.date = r.updatedAt.split('T')[0];
  });
  rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  return { success: true, data: rows };
}

function deleteJournalData(id) {
  if (!id) return { success: false, error: 'id required' };
  const deleted = deleteRow('Journals', id);
  return deleted ? { success: true, data: { id } } : { success: false, error: 'Not found' };
}