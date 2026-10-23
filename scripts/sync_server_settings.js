require("dotenv").config();
const { REST, Routes } = require("discord.js");
const https = require("https");

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
  });
}

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const sourceId = "1429445691452948524";
  const destId = "965378975675322438";

  console.log("Fetching source guild...");
  const sGuild = await rest.get(Routes.guild(sourceId));
  console.log("Source guild fetched:", sGuild.name);

  // Fetch icon
  let iconDataUri = null;
  if (sGuild.icon) {
    const isGif = sGuild.icon.startsWith("a_");
    const ext = isGif ? "gif" : "png";
    const iconUrl = `https://cdn.discordapp.com/icons/${sourceId}/${sGuild.icon}.${ext}?size=1024`;
    console.log("Downloading icon from:", iconUrl);
    try {
      const buf = await fetchBuffer(iconUrl);
      const mime = isGif ? "image/gif" : "image/png";
      iconDataUri = `data:${mime};base64,${buf.toString("base64")}`;
      console.log(`Downloaded icon (${buf.length} bytes)`);
    } catch (e) {
      console.warn("Could not download icon:", e.message);
    }
  }

  // Fetch splash
  let splashDataUri = null;
  if (sGuild.splash) {
    const splashUrl = `https://cdn.discordapp.com/splashes/${sourceId}/${sGuild.splash}.png?size=1024`;
    console.log("Downloading splash from:", splashUrl);
    try {
      const buf = await fetchBuffer(splashUrl);
      splashDataUri = `data:image/png;base64,${buf.toString("base64")}`;
      console.log(`Downloaded splash (${buf.length} bytes)`);
    } catch (e) {
      console.warn("Could not download splash:", e.message);
    }
  }

  // Find destination rules and staff channels
  const dChannels = await rest.get(Routes.guildChannels(destId));
  const rulesCh = dChannels.find(c => c.name === "📃・regole");
  const staffCh = dChannels.find(c => c.name === "🔰・staff");

  console.log(`Dest rules channel: ${rulesCh ? rulesCh.id : "NOT FOUND"}`);
  console.log(`Dest staff updates channel: ${staffCh ? staffCh.id : "NOT FOUND"}`);

  const patchPayload = {
    name: "RoomUp! 2",
    description: sGuild.description,
    verification_level: sGuild.verification_level,
    default_message_notifications: sGuild.default_message_notifications,
    explicit_content_filter: sGuild.explicit_content_filter,
    afk_timeout: sGuild.afk_timeout,
    afk_channel_id: sGuild.afk_channel_id || null,
    system_channel_id: null,
    system_channel_flags: sGuild.system_channel_flags,
    premium_progress_bar_enabled: false,
    preferred_locale: sGuild.preferred_locale || "it"
  };

  if (rulesCh) patchPayload.rules_channel_id = rulesCh.id;
  if (staffCh) patchPayload.public_updates_channel_id = staffCh.id;
  if (iconDataUri) patchPayload.icon = iconDataUri;
  if (splashDataUri) patchPayload.splash = splashDataUri;

  console.log("Applying PATCH to dest guild...");
  try {
    const updated = await rest.patch(Routes.guild(destId), { body: patchPayload });
    console.log("✅ Dest guild settings updated successfully!");
    console.log("Updated name:", updated.name);
    console.log("Updated description:", updated.description);
    console.log("Updated rules_channel_id:", updated.rules_channel_id);
    console.log("Updated public_updates_channel_id:", updated.public_updates_channel_id);
    console.log("Updated system_channel_id:", updated.system_channel_id);
  } catch (err) {
    console.error("❌ Error updating dest guild:", err);
  }
}

main().catch(err => {
  console.error("Fatal:", err);
});
