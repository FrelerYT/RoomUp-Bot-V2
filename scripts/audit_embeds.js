const fs = require('fs');
const content = fs.readFileSync('src/web/views/dashboard.ejs', 'utf8');

const tabs = [
  { id: 'tab-verification', name: 'Verifica' },
  { id: 'tab-welcome', name: 'Benvenuto' },
  { id: 'tab-tickets', name: 'Ticket' },
  { id: 'tab-suggestions', name: 'Suggerimenti' },
  { id: 'tab-giveaways', name: 'Giveaway' },
  { id: 'tab-levels', name: 'Livelli' },
  { id: 'tab-partnerships', name: 'Partnership' },
  { id: 'tab-starboard', name: 'Starboard' },
  { id: 'tab-automod', name: 'AutoMod' },
  { id: 'tab-warns', name: 'Warn & Sanzioni' },
  { id: 'tab-antinuke', name: 'AntiNuke' },
  { id: 'tab-antiraid', name: 'AntiRaid' },
  { id: 'tab-music', name: 'Musica' },
  { id: 'tab-entertainment', name: 'Intrattenimento' }
];

tabs.forEach(t => {
  const startIdx = content.indexOf(`id="${t.id}"`);
  if (startIdx === -1) {
    console.log(`${t.name}: NOT FOUND`);
    return;
  }
  const nextTabIdx = content.indexOf('class="tab-pane"', startIdx + 20);
  const tabContent = content.slice(startIdx, nextTabIdx !== -1 ? nextTabIdx : startIdx + 3000);
  
  const inputs = (tabContent.match(/id=\"([a-zA-Z0-9_-]+)\"/g) || []).map(s => s.replace(/id=|\"/g, ''));
  console.log(`\n--- ${t.name} (${t.id}) ---`);
  console.log('Inputs found:', inputs.length, 'IDs:', inputs.slice(0, 15).join(', '));
  const hasEmbedTitle = tabContent.toLowerCase().includes('titolo') && tabContent.toLowerCase().includes('embed');
  const hasEmbedDesc = tabContent.toLowerCase().includes('descrizione') || tabContent.toLowerCase().includes('messaggio');
  const hasEmbedColor = tabContent.toLowerCase().includes('colore');
  const hasFooter = tabContent.toLowerCase().includes('footer') || tabContent.toLowerCase().includes('piè di pagina');
  const hasImage = tabContent.toLowerCase().includes('banner') || tabContent.toLowerCase().includes('immagine') || tabContent.toLowerCase().includes('image');
  const hasThumb = tabContent.toLowerCase().includes('thumbnail') || tabContent.toLowerCase().includes('icona');
  console.log(`Embed Controls: Title=${hasEmbedTitle}, Desc/Msg=${hasEmbedDesc}, Color=${hasEmbedColor}, Footer=${hasFooter}, Image/Banner=${hasImage}, Thumb=${hasThumb}`);
});
