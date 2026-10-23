// Server-Sent Events (SSE) Manager for Live Dashboard updates
const clients = new Map(); // guildId -> Set of res objects

function registerSseClient(guildId, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  res.write(`data: ${JSON.stringify({ type: "connected", guildId, timestamp: Date.now() })}\n\n`);

  if (!clients.has(guildId)) clients.set(guildId, new Set());
  clients.get(guildId).add(res);

  res.on("close", () => {
    if (clients.has(guildId)) {
      clients.get(guildId).delete(res);
      if (clients.get(guildId).size === 0) clients.delete(guildId);
    }
  });
}

function broadcastToGuild(guildId, eventType, data = {}) {
  const guildClients = clients.get(guildId);
  if (!guildClients || guildClients.size === 0) return;

  const payload = JSON.stringify({ type: eventType, data, timestamp: Date.now() });
  for (const res of guildClients) {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch {}
  }
}

module.exports = {
  registerSseClient,
  broadcastToGuild,
  subscribeGuildEvents: registerSseClient,
  broadcastRealtimeEvent: broadcastToGuild
};
