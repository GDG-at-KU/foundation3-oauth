import { appConfig } from './config.js';
import { applications } from './sample-data.js';
import { filterApplications, STATUSES, validateApplications } from './applications.js';
import { summarizeApplications } from './summary.js';

const select = id => document.getElementById(id);
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// Prepared rendering. Always render record text as text, never as raw HTML.
function renderApplication(record) {
  const item = element('li', 'application-card');
  const initials = record.company.split(/\s+/).map(word => word[0]).slice(0, 2).join('');
  const monogram = element('span', `monogram ${record.status}`, initials);
  monogram.setAttribute('aria-hidden', 'true');
  const content = element('div', 'card-content');
  const company = element('p', 'company', record.company);
  company.setAttribute('aria-label', `${appConfig.companyLabel}: ${record.company}`);
  const role = element('h3', 'role', record.role);
  const location = element('p', 'location', record.location || 'Location not specified');
  content.append(company, role, location);
  const aside = element('div', 'card-aside');
  aside.append(element('span', `status-label ${record.status}`, appConfig.statuses[record.status]));
  if (record.description) {
    const details = element('details', 'notes');
    details.append(element('summary', '', 'View notes'), element('p', '', record.description));
    content.append(details);
  }
  item.append(monogram, content, aside);
  return item;
}

function renderSummary() {
  const summary = summarizeApplications(applications);
  const statistics = [['Applications', summary.total], ['Interviews', summary.interviews]];
  if (summary.submitted !== undefined) statistics.push(['Submitted', summary.submitted]);
  select('summary').replaceChildren(...statistics.map(([label, count]) => {
    const group = element('div', 'stat');
    const value = element('dd', '', count === null ? '—' : String(count));
    if (count === null) value.setAttribute('aria-label', 'Not calculated yet');
    group.append(element('dt', '', label), value);
    return group;
  }));
}

function renderList() {
  const visible = filterApplications(applications, select('search').value, select('filter-status').value);
  select('applications').replaceChildren(...visible.map(renderApplication));
  select('results-count').textContent = `${visible.length} of ${applications.length} shown`;
  select('empty').hidden = visible.length !== 0;
  if (applications.length === 0) {
    select('empty-title').textContent = 'Room for your next opportunity';
    select('empty-description').textContent = 'Your collection is empty. New opportunities will appear here.';
  }
}

try {
  validateApplications(applications);
  document.title = `${appConfig.name} — Application tracker`;
  document.documentElement.style.setProperty('--accent', appConfig.accentColor);
  for (const [id, text] of Object.entries({ 'app-name': appConfig.name, 'page-title': appConfig.title,
    description: appConfig.description, 'collection-title': appConfig.collectionTitle, release: appConfig.releaseLabel })) {
    select(id).textContent = text;
  }
  select('search').placeholder = `Search ${appConfig.companyLabel.toLowerCase()} or ${appConfig.roleLabel.toLowerCase()}…`;
  for (const status of STATUSES) {
    const option = element('option', '', appConfig.statuses[status]);
    option.value = status;
    select('filter-status').append(option);
  }
  renderSummary();
  renderList();
  select('search').addEventListener('input', renderList);
  select('filter-status').addEventListener('change', renderList);
  select('clear').addEventListener('click', () => {
    select('search').value = '';
    select('filter-status').value = 'all';
    renderList();
    select('search').focus();
  });
} catch (error) {
  select('error').textContent = `The tracker could not load. ${error.message}`;
  select('error').hidden = false;
  for (const id of ['search', 'filter-status', 'clear']) select(id).disabled = true;
}
