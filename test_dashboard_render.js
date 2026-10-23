const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

// Load the REAL AUDIT_CATEGORIES from server.js via a trick: extract the array manually
// Actually just use a minimal version that matches the structure
const AUDIT_CATEGORIES = [
  { id: 'channels', title: 'Canali', icon: 'fa-folder', events: [{ key: 'channelCreate', label: 'Canale Creato', desc: '' }] },
  { id: 'members', title: 'Membri', icon: 'fa-users', events: [{ key: 'memberJoin', label: 'Nuovo Membro', desc: '' }] }
];

const template = fs.readFileSync('src/web/views/dashboard.ejs', 'utf8');

// Test 1: RoomUp guild (hiddenTabs set)
const mockRoomUp = {
  user: { id: 'test', username: 'TestUser', global_name: 'Test', avatarUrl: '' },
  guildId: '1429445691452948524',
  guildName: 'RoomUp',
  guildIcon: '',
  memberCount: 100,
  config: {
    economy: { enabled: false, currencyName: 'Monete', currencySymbol: '🪙', dailyAmount: 50, startingBalance: 100 },
    entertainment: { enabled: false, games: { trivia: {}, math: {}, rps: {}, wordle: {}, uno: {}, slots: {}, blackjack: {}, quiz: {}, hunt: {}, fishing: {}, roulette: {}, dice: {}, race: {}, heist: {}, mine: {} } },
    counting: { enabled: true, currentCount: 3, highestScore: 102, channelId: null, lastUserId: null, resetOnFail: true, allowConsecutive: false },
    dashboard: { hiddenTabs: ['tab-economy', 'tab-entertainment'] },
    logs: { categories: {} },
    welcome: { enabled: false }, moderation: { enabled: false }, automod: { enabled: false },
    tickets: { enabled: false }, partnership: { enabled: false }, sentinel: { enabled: false },
    reputation: { enabled: false }, quests: { enabled: false }, social: { enabled: false },
    levels: { enabled: false }, voice: { enabled: false }, music: { enabled: false },
    utilities: { enabled: false }, integrations: { enabled: false }, aiAgent: { enabled: false },
    forms: { enabled: false }, modmail: { enabled: false }, giveaway: { enabled: false },
    suggestions: { enabled: false }, antiRaid: { enabled: false }, backup: { enabled: false }
  },
  channels: [], textChannels: [], voiceChannels: [], categories: [], groupedChannels: {}, roles: [],
  allGuilds: [], allBotGuilds: [],
  partnersData: { partners: [] },
  collabs: { connected: [], incoming: [], outgoing: [], history: [] },
  allCategories: AUDIT_CATEGORIES,
  aiMemory: { precedents: [], learnedRules: [], consultationHistory: [], stats: { autonomousActions: 0, humanEscalations: 0, learnedDecisions: 0 } },
  giveaways: [], suggestions: [], levelsData: {}, allInfractions: {},
  channelCount: 0, roleCount: 0, cases: [],
  diagnostics: { score: 100, issues: [] },
  economyLeaderboard: [], reputationLeaderboard: [],
  modmailSessions: {}, forms: {}, knowledgeBaseArticles: [],
  presets: {}, backups: [], revisions: [], reportsData: {},
  hiddenTabs: ['tab-economy', 'tab-entertainment']
};

// Test 2: Another guild (no hiddenTabs)
const mockOther = Object.assign({}, mockRoomUp, {
  guildId: '999999999999999',
  guildName: 'Other Server',
  hiddenTabs: []
});

let passed = 0;
let failed = 0;

function test(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

console.log('\n=== DASHBOARD RENDER TESTS ===\n');

// --- Test for RoomUp (hiddenTabs active) ---
console.log('🔷 Test 1: RoomUp guild (hiddenTabs: economy + entertainment)');
try {
  const html = ejs.render(template, mockRoomUp, { filename: 'src/web/views/dashboard.ejs' });
  test('Renders without error', true);
  test('tab-economy pane hidden', !html.includes('id="tab-economy"'));
  test('tab-entertainment pane hidden', !html.includes('id="tab-entertainment"'));
  test('Economy nav button hidden', !html.includes("switchTab('tab-economy')"));
  test('Entertainment nav button hidden', !html.includes("switchTab('tab-entertainment')"));
  test('tab-counting visible', html.includes('id="tab-counting"'));
  test('Counting nav button visible', html.includes("switchTab('tab-counting')"));
  test('Output size reasonable', html.length > 100000);
  console.log(`  📏 Output: ${Math.round(html.length / 1024)}KB`);
} catch(e) {
  test('Renders without error', false);
  console.log(`  ERROR: ${e.message.split('\n')[0]}`);
}

console.log('');

// --- Test for Other guild (no hiddenTabs) ---
console.log('🔷 Test 2: Other guild (no hiddenTabs)');
try {
  const html = ejs.render(template, mockOther, { filename: 'src/web/views/dashboard.ejs' });
  test('Renders without error', true);
  test('tab-economy pane visible', html.includes('id="tab-economy"'));
  test('tab-entertainment pane visible', html.includes('id="tab-entertainment"'));
  test('Economy nav button visible', html.includes("switchTab('tab-economy')"));
  test('Entertainment nav button visible', html.includes("switchTab('tab-entertainment')"));
} catch(e) {
  test('Renders without error', false);
  console.log(`  ERROR: ${e.message.split('\n')[0]}`);
}

console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
if (failed > 0) process.exit(1);
