// Applied and interview records both count as submitted.
export function summarizeApplications(applications) {
  const interviews = applications.filter(application => application.status === 'interview').length;
  const submitted = applications.filter(application => application.status !== 'saved').length;
  return { total: applications.length, interviews, submitted };
}
