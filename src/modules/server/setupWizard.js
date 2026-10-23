const fs = require("fs");
const path = require("path");
const { ChannelType, PermissionFlagsBits } = require("discord.js");
const { readJsonSafe, writeJsonSafe, DATA_DIR } = require("../../core/storage");
const { updateGuildConfig } = require("../../config/settingsManager");

const BACKUPS_DIR = path.join(DATA_DIR, "backups");
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

const PRESETS = {
  community: {
    id: "community",
    name: "Community & Social Hub",
    description: "Configurazione completa per community accoglienti, canali testuali, vocali e supporto.",
    roles: [
      { name: "👑 Fondatore", color: 0xe67e22, hoist: true, mentionable: false },
      { name: "🛡️ Moderatore", color: 0x3498db, hoist: true, mentionable: true },
      { name: "💎 VIP", color: 0x9b59b6, hoist: true, mentionable: false },
      { name: "🌟 Membro", color: 0x2ecc71, hoist: false, mentionable: false }
    ],
    categories: [
      {
        name: "📢 INFORMAZIONI",
        channels: [
          { name: "annunci", type: ChannelType.GuildText },
          { name: "regolamento", type: ChannelType.GuildText },
          { name: "benvenuto", type: ChannelType.GuildText }
        ]
      },
      {
        name: "💬 CHAT COMMUNITY",
        channels: [
          { name: "generale", type: ChannelType.GuildText },
          { name: "media-meme", type: ChannelType.GuildText },
          { name: "bot-comandi", type: ChannelType.GuildText }
        ]
      },
      {
        name: "🔊 VOCALI",
        channels: [
          { name: "Salotto 1", type: ChannelType.GuildVoice },
          { name: "Salotto 2", type: ChannelType.GuildVoice },
          { name: "Lounge Chill", type: ChannelType.GuildVoice }
        ]
      }
    ],
    recommendedSettings: {
      welcome: { enabled: true, sendChannelMessage: true, useEmbed: true },
      levels: { enabled: true, gainXpText: true },
      counting: { enabled: false },
      starboard: { enabled: true, threshold: 3 }
    }
  },
  gaming: {
    id: "gaming",
    name: "Gaming & Esports",
    description: "Ottimizzato per tornei, clip, LFG (Looking for Group) e canali vocali di squadra.",
    roles: [
      { name: "👑 Capo Squadra", color: 0xe74c3c, hoist: true, mentionable: false },
      { name: "🛡️ Arbitro/Mod", color: 0xf1c40f, hoist: true, mentionable: true },
      { name: "🎮 Gamer", color: 0x1abc9c, hoist: true, mentionable: false }
    ],
    categories: [
      {
        name: "📢 NEWS & TORNEI",
        channels: [
          { name: "annunci-giochi", type: ChannelType.GuildText },
          { name: "calendario-eventi", type: ChannelType.GuildText }
        ]
      },
      {
        name: "🎯 LFG & HIGHLIGHTS",
        channels: [
          { name: "lfg-cerca-squadra", type: ChannelType.GuildText },
          { name: "clip-e-highlight", type: ChannelType.GuildText }
        ]
      },
      {
        name: "🔊 SQUADRE VOCALI",
        channels: [
          { name: "Squadra A", type: ChannelType.GuildVoice },
          { name: "Squadra B", type: ChannelType.GuildVoice }
        ]
      }
    ],
    recommendedSettings: {
      entertainment: { enabled: true },
      levels: { enabled: true }
    }
  },
  store: {
    id: "store",
    name: "Store & Support Hub",
    description: "Perfetto per negozi, venditori e server con assistenza clienti ticketing avanzata.",
    roles: [
      { name: "💼 Proprietario", color: 0x2c3e50, hoist: true, mentionable: false },
      { name: "🛎️ Support Team", color: 0x34495e, hoist: true, mentionable: true },
      { name: "⭐ Cliente Verificato", color: 0xf39c12, hoist: true, mentionable: false }
    ],
    categories: [
      {
        name: "📦 VETRINA & INFO",
        channels: [
          { name: "prodotti", type: ChannelType.GuildText },
          { name: "recensioni", type: ChannelType.GuildText },
          { name: "faq-info", type: ChannelType.GuildText }
        ]
      },
      {
        name: "🎫 ASSISTENZA",
        channels: [
          { name: "apri-ticket", type: ChannelType.GuildText }
        ]
      }
    ],
    recommendedSettings: {
      tickets: { enabled: true, allowClaim: true, generateTranscript: true }
    }
  }
};

async function applyPreset(guild, presetId, options = {}) {
  const preset = PRESETS[presetId];
  if (!preset) throw new Error(`Preset sconosciuto: ${presetId}`);

  const createdRoles = {};
  const createdChannels = [];

  // 1. Create Roles if requested
  if (options.createRoles !== false && preset.roles) {
    for (const r of preset.roles) {
      const existing = guild.roles.cache.find(role => role.name.toLowerCase() === r.name.toLowerCase());
      if (!existing) {
        const newRole = await guild.roles.create({
          name: r.name,
          color: r.color,
          hoist: r.hoist,
          mentionable: r.mentionable,
          reason: `Preset Setup Wizard: ${preset.name}`
        });
        createdRoles[r.name] = newRole.id;
      } else {
        createdRoles[r.name] = existing.id;
      }
    }
  }

  // 2. Create Categories & Channels if requested
  if (options.createChannels !== false && preset.categories) {
    for (const cat of preset.categories) {
      const categoryChannel = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        reason: `Preset Setup Wizard: ${preset.name}`
      });
      createdChannels.push({ id: categoryChannel.id, name: cat.name, type: "category" });

      for (const ch of cat.channels) {
        const subCh = await guild.channels.create({
          name: ch.name,
          type: ch.type,
          parent: categoryChannel.id,
          reason: `Preset Setup Wizard: ${preset.name}`
        });
        createdChannels.push({ id: subCh.id, name: ch.name, type: ch.type === ChannelType.GuildText ? "text" : "voice" });
      }
    }
  }

  // 3. Apply recommended settings
  if (preset.recommendedSettings) {
    updateGuildConfig(guild.id, preset.recommendedSettings);
  }

  return {
    presetId,
    presetName: preset.name,
    createdRolesCount: Object.keys(createdRoles).length,
    createdChannelsCount: createdChannels.length,
    createdChannels
  };
}

async function backupGuild(guild) {
  const channelList = Array.from(guild.channels?.cache?.values?.() || []);
  const channels = channelList.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    parentId: c.parentId,
    position: c.position
  }));

  const roleList = Array.from(guild.roles?.cache?.values?.() || []);
  const roles = roleList.map(r => ({
    id: r.id,
    name: r.name,
    color: r.color,
    hoist: r.hoist,
    position: r.position,
    permissions: r.permissions?.bitfield ? r.permissions.bitfield.toString() : "0"
  }));

  const backupData = {
    guildId: guild.id,
    guildName: guild.name,
    createdAt: new Date().toISOString(),
    id: "backup_" + Date.now(),
    channels,
    roles
  };

  const backupFile = path.join(BACKUPS_DIR, `backup_${guild.id}_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), "utf8");

  return backupData;
}

function getBackups(guildId) {
  try {
    const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith(`backup_${guildId}_`));
    return files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(BACKUPS_DIR, f), "utf8"));
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = {
  PRESETS,
  applyPreset,
  backupGuild,
  getBackups
};