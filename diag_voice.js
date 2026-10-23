// Script di diagnostica: logga ogni VoiceStateUpdate in tempo reale
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, AuditLogEvent } = require('discord.js');

const FRELERR_ID = '1020343046539325480';
const GUILD_ID   = '1429445691452948524';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.GuildMember, Partials.User]
});

client.once('ready', () => {
  console.log(`[DIAG] Connesso come ${client.user.tag}`);
  console.log('[DIAG] In ascolto di VoiceStateUpdate. Prova a mutare/deafenare/kickare Frelerr...');
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  const userId = oldState.id || newState.id;
  const isFrelerr = userId === FRELERR_ID;

  const changes = [];
  if (oldState.channelId !== newState.channelId)   changes.push(`channel: ${oldState.channelId} → ${newState.channelId}`);
  if (oldState.serverMute !== newState.serverMute) changes.push(`serverMute: ${oldState.serverMute} → ${newState.serverMute}`);
  if (oldState.serverDeaf !== newState.serverDeaf) changes.push(`serverDeaf: ${oldState.serverDeaf} → ${newState.serverDeaf}`);
  if (oldState.selfMute !== newState.selfMute)     changes.push(`selfMute: ${oldState.selfMute} → ${newState.selfMute}`);
  if (oldState.selfDeaf !== newState.selfDeaf)     changes.push(`selfDeaf: ${oldState.selfDeaf} → ${newState.selfDeaf}`);

  const tag = `[${isFrelerr ? '⭐ FRELERR' : userId}]`;
  console.log(`\n${tag} VoiceStateUpdate:`);
  console.log(`  member present: ${!!oldState.member}`);
  console.log(`  oldChannelId: ${oldState.channelId}`);
  console.log(`  changes: ${changes.length ? changes.join(' | ') : '(nessuno)'}`);

  if (!isFrelerr) return;
  if (changes.length === 0) return;

  // Prova a fetchare audit log
  try {
    const guild = oldState.guild || newState.guild;
    await new Promise(r => setTimeout(r, 1200));

    // Testa MemberUpdate per mute/deaf
    if (oldState.serverMute !== newState.serverMute || oldState.serverDeaf !== newState.serverDeaf) {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 5 });
      console.log(`  [AuditLog MemberUpdate] entries: ${logs.entries.size}`);
      for (const [, e] of logs.entries) {
        const age = Date.now() - e.createdTimestamp;
        console.log(`    entry: executor=${e.executorId} target=${e.targetId} age=${age}ms changes=${JSON.stringify(e.changes)}`);
      }
    }

    // Testa MemberDisconnect per kick
    if (!newState.channelId && oldState.channelId) {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberDisconnect, limit: 5 });
      console.log(`  [AuditLog MemberDisconnect] entries: ${logs.entries.size}`);
      for (const [, e] of logs.entries) {
        const age = Date.now() - e.createdTimestamp;
        console.log(`    entry: executor=${e.executorId} target=${e.targetId} age=${age}ms`);
      }
    }
  } catch (err) {
    console.error('  [AuditLog ERROR]', err.message);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
