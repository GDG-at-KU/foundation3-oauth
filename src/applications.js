export const STATUSES = ['saved', 'applied', 'interview'];

// Shared status values used by validation, filtering, and the interface.
export function validateApplications(records) {
  if (!Array.isArray(records)) throw new Error('Sample data must be an array.');
  const ids = new Set();
  for (const record of records) {
    const required = ['id', 'company', 'role', 'createdAt'];
    if (!record || required.some(key => typeof record[key] !== 'string' || !record[key].trim())
      || !STATUSES.includes(record.status) || ids.has(record.id)
      || Number.isNaN(Date.parse(record.createdAt))) {
      throw new Error('Check sample data: use unique IDs, nonblank text, a valid date, and a supported status.');
    }
    for (const key of ['location', 'description']) {
      if (record[key] !== undefined && typeof record[key] !== 'string') {
        throw new Error(`Check sample data: ${key} must be text.`);
      }
    }
    ids.add(record.id);
  }
}

export function filterApplications(records, query = '', status = 'all') {
  const search = query.trim().toLowerCase();
  return records.filter(record => {
    const matchesText = `${record.company} ${record.role}`.toLowerCase().includes(search);
    return matchesText && (status === 'all' || record.status === status);
  });
}
