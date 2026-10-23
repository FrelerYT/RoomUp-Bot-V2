const fs = require('fs');
const content = fs.readFileSync('src/web/views/dashboard.ejs', 'utf8');
const lines = content.split('\n');

function inspectTab(tabId) {
  const start = lines.findIndex(l => l.includes('id="' + tabId + '"'));
  if (start === -1) return console.log(tabId, 'NOT FOUND');
  let end = lines.findIndex((l, idx) => idx > start && l.includes('class="tab-pane"'));
  if (end === -1) end = lines.length;
  console.log('=== ' + tabId + ' (lines ' + (start+1) + ' - ' + end + ') ===');
  const slice = lines.slice(start, end).join('\n');
  const cardTitles = (slice.match(/class="card-title"[^>]*>([^<]+)/g) || []);
  console.log('Cards:', cardTitles.map(c => c.replace(/.*>/, '').trim()));
  const inputs = (slice.match(/id="([a-zA-Z0-9_-]+)"/g) || []).map(s => s.replace(/id=|"/g, ''));
  console.log('Inputs (' + inputs.length + '):', inputs.join(', '));
}

[
  'tab-verification',
  'tab-welcome',
  'tab-tickets',
  'tab-suggestions',
  'tab-giveaways',
  'tab-levels',
  'tab-reaction-roles',
  'tab-custom-commands',
  'tab-counting',
  'tab-partnerships',
  'tab-automod',
  'tab-music',
  'tab-starboard',
  'tab-server-stats',
  'tab-antinuke',
  'tab-antiraid',
  'tab-warns',
  'tab-entertainment',
  'tab-utilities'
].forEach(inspectTab);
