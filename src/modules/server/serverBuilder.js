const { ChannelType } = require("discord.js");

async function cloneChannel(channel, newName = null) {
  if (!channel || !channel.guild) throw new Error("Canale non valido per la clonazione");
  const name = newName || `${channel.name}-clone`;
  const cloned = await channel.clone({ name, reason: "Clonazione canale via ServerBuilder" });
  return cloned;
}

async function createCategoryWithChannels(guild, categoryName, textChannels = [], voiceChannels = []) {
  const category = await guild.channels.create({
    name: categoryName,
    type: ChannelType.GuildCategory,
    reason: "Creazione categoria strutturata"
  });

  const created = [];
  for (const name of textChannels) {
    const ch = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: category.id
    });
    created.push(ch);
  }

  for (const name of voiceChannels) {
    const vch = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: category.id
    });
    created.push(vch);
  }

  return { category, created };
}

function exportGuildLayout(guild) {
  const categories = [];
  const uncategorized = [];

  const allChannels = Array.from(guild.channels.cache.values());
  const catChannels = allChannels.filter(c => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);

  for (const cat of catChannels) {
    const children = allChannels
      .filter(c => c.parentId === cat.id)
      .sort((a, b) => a.position - b.position)
      .map(c => ({ name: c.name, type: c.type === ChannelType.GuildText ? "text" : "voice" }));
    categories.push({ name: cat.name, channels: children });
  }

  for (const c of allChannels.filter(c => !c.parentId && c.type !== ChannelType.GuildCategory)) {
    uncategorized.push({ name: c.name, type: c.type === ChannelType.GuildText ? "text" : "voice" });
  }

  return {
    guildName: guild.name,
    exportedAt: new Date().toISOString(),
    categories,
    uncategorized
  };
}

module.exports = {
  cloneChannel,
  createCategoryWithChannels,
  exportGuildLayout
};