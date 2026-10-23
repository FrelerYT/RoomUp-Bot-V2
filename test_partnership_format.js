const assert = require("assert");
const { executePublishPartnership } = require("./src/bot/partnershipEngine");

async function testPartnershipPublishFormat() {
  console.log("==================================================================");
  console.log("🧪 TEST: PARTNERSHIP PUBLISH FORMAT (PLAIN TEXT + INFO BOX)");
  console.log("==================================================================");

  const sentToChannel = [];
  const mockChannel = {
    id: "1550847042195038269",
    isTextBased: () => true,
    send: async (payload) => {
      sentToChannel.push(payload);
      return { id: "msg_" + Date.now() + "_" + Math.random(), channelId: mockChannel.id, ...payload };
    }
  };

  const mockGuild = {
    id: "1429445691452948524",
    name: "RoomUp!",
    channels: {
      cache: new Map([
        [mockChannel.id, mockChannel]
      ])
    },
    members: {
      fetch: async () => null
    }
  };

  const mockClient = {
    user: { id: "1543608170327445634", tag: "RoomUp!#9111" },
    guilds: {
      cache: new Map([
        [mockGuild.id, mockGuild]
      ])
    }
  };

  const mockSettings = {
    "1429445691452948524": {
      partnerships: {
        enabled: true,
        partnerChannelId: mockChannel.id,
        pingRole: "1550846931826122783" // @ಌ Ping partnership
      }
    }
  };

  const partnerDescription = [
    "⚙️ Sviluppo Custom",
    "Hai un'idea specifica? Contattaci e realizzeremo esattamente ciò che cerchi.",
    "------------------------------",
    "🔗 Link utili",
    "🔹 Entra nel Server Discord: https://discord.gg/ymVTVYeATT"
  ].join("\n");

  const res = await executePublishPartnership(
    mockClient,
    () => mockSettings,
    {
      originGuildId: "1429445691452948524",
      collaboratorId: "1007620938700959784",
      collaboratorTag: "lolshut",
      authorId: "SentinelAI",
      description: partnerDescription,
      originGuildName: "RoomUp!"
    }
  );

  console.log("  Partner number generated:", res.partnerNum);
  console.log("  Messages sent count:", sentToChannel.length);
  assert.strictEqual(sentToChannel.length, 2, "Must send exactly 2 messages: description and info box!");

  // 1. Verify Message 1 (Description)
  const msg1 = sentToChannel[0];
  console.log("\n  --- Message 1 (Description plain text) ---");
  console.log(msg1.content);
  assert.strictEqual(msg1.embeds, undefined, "Message 1 MUST NOT contain an embed!");
  assert.strictEqual(msg1.content, partnerDescription, "Message 1 must be the exact plain text description!");
  assert.deepStrictEqual(msg1.allowedMentions, { parse: [] }, "Message 1 must disable mentions to avoid unauthorized pings from partner text!");

  // 2. Verify Message 2 (Styled Info Embed with Old Info, No Rank)
  const msg2 = sentToChannel[1];
  console.log("\n  --- Message 2 (Styled Info Embed - Old Info in New Graphics) ---");
  console.log("  Content (Ping):", msg2.content);
  console.log("  Embed Description:\n" + msg2.embeds?.[0]?.data?.description);
  assert(Array.isArray(msg2.embeds) && msg2.embeds.length === 1, "Message 2 must contain an info embed!");
  const embedData = msg2.embeds[0].data || msg2.embeds[0];
  assert.strictEqual(msg2.content, "<@&1550846931826122783>", "Message 2 content must ping the partnership role!");
  assert.strictEqual(embedData.title, "🤝 Nuova Partnership!", "Embed title must be '🤝 Nuova Partnership!'");
  assert.strictEqual(embedData.color, parseInt("8A5CF6", 16), "Embed color must be purple #8A5CF6");
  assert(embedData.description.includes("Grazie <@"), "Must thank the staff member");
  assert(embedData.description.includes("├ **Autore:** <@1007620938700959784>"), "Must include Autore with branch");
  assert(embedData.description.includes("├ **Server:**"), "Must include Server with branch");
  assert(embedData.description.includes("├ **Staff:** <@1543608170327445634>"), "Must include Staff with branch");
  assert(embedData.description.includes("├ **Ping:** <@&1550846931826122783>"), "Must include Ping with branch");
  assert(embedData.description.includes(`└ **Partner:** #${res.partnerNum}`), "Must include Partner number with closing branch");
  assert(!embedData.description.includes("rank"), "Must NOT contain rank!");
  assert(!embedData.description.includes("Ora sei a"), "Must NOT contain partner counter!");
  assert(embedData.footer.text.includes("Collaborazione con"), "Footer must include collaboration text and date");

  console.log("\n✅ [PASS] Partnership published with old information in new graphics without rank!");
}

testPartnershipPublishFormat().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
