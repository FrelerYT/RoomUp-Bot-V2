const assert = require("assert");
const { EventEmitter } = require("events");
const { initVoiceEngine, activeRooms } = require("./src/bot/voiceEngine");

async function testVoiceEngine() {
  console.log("=== TEST SUITE: VOICE ENGINE (STANZE VOCALI TEMPORANEE & CONTROLLI) ===");

  const mockClient = new EventEmitter();
  const mockSettings = {
    "1429445691452948524": {
      voice: {
        enabled: true,
        generatorChannelId: "1550847041243054100",
        hubChannelId: "1550847041243054100",
        categoryId: "1550847018094698657",
        channelNameTemplate: "🔒・Stanza di {username}",
        userLimit: 0,
        autoDeleteOnEmpty: true
      }
    }
  };

  initVoiceEngine(mockClient, () => mockSettings);

  let createdChannel = null;
  let sentMessages = [];
  let movedToChannel = null;

  const mockGuild = {
    id: "1429445691452948524",
    roles: { everyone: { id: "1429445691452948524" } },
    channels: {
      create: async (data) => {
        createdChannel = {
          id: "temp_voice_99999",
          name: data.name,
          type: data.type,
          parentId: data.parent,
          userLimit: data.userLimit,
          members: new Map(),
          permissionOverwrites: {
            edit: async (target, perms) => {}
          },
          setName: async (name) => { createdChannel.name = name; },
          setUserLimit: async (limit) => { createdChannel.userLimit = limit; },
          send: async (payload) => {
            sentMessages.push(payload);
            return { id: "msg_123" };
          },
          delete: async () => { createdChannel.deleted = true; }
        };
        return createdChannel;
      }
    }
  };

  const mockMember = {
    id: "user_111",
    user: { id: "user_111", username: "Frè", bot: false },
    voice: { channel: null }
  };

  // 1. Simulate joining the generator channel
  console.log("1. Test Join nel canale Crea Privata (1550847041243054100)...");
  await mockClient.emit("voiceStateUpdate", 
    { channelId: null, member: mockMember, guild: mockGuild },
    {
      channelId: "1550847041243054100",
      member: mockMember,
      guild: mockGuild,
      setChannel: async (ch) => {
        movedToChannel = ch;
        mockMember.voice.channel = ch;
        ch.members.set(mockMember.id, mockMember);
      }
    }
  );
  await new Promise(r => setTimeout(r, 100));

  assert.ok(createdChannel, "Il canale temporaneo deve essere stato creato!");
  assert.strictEqual(createdChannel.name, "🔒・Stanza di Frè", "Il nome del canale deve rispettare il template!");
  assert.strictEqual(createdChannel.parentId, "1550847018094698657", "La categoria deve essere impostata correttamente!");
  assert.strictEqual(movedToChannel?.id, "temp_voice_99999", "Il membro deve essere stato spostato nella stanza creata!");
  assert.strictEqual(sentMessages.length, 1, "Il pannello di controllo interattivo deve essere stato inviato!");
  
  const panel = sentMessages[0];
  assert.ok(panel.embeds?.length > 0, "Deve contenere l'embed del pannello di controllo!");
  assert.strictEqual(panel.components?.length, 2, "Devono essere presenti 2 righe di pulsanti!");
  console.log("   ✅ Canale creato, membro spostato e pannello controlli inviato!");

  // 2. Test button interactions
  console.log("2. Test Interazioni Pulsanti (Lock, Rename, Limit)...");
  let replyMsg = null;
  const mockInteractionLock = {
    isButton: () => true,
    isModalSubmit: () => false,
    isStringSelectMenu: () => false,
    customId: "v2room_lock",
    user: { id: "user_111" },
    member: mockMember,
    guild: mockGuild,
    reply: async (p) => { replyMsg = p; }
  };

  await mockClient.emit("interactionCreate", mockInteractionLock);
  await new Promise(r => setTimeout(r, 50));
  assert.ok(replyMsg?.content?.includes("bloccata"), "Il comando lock deve confermare il blocco!");
  console.log("   ✅ v2room_lock funzionante!");

  // Rename modal submit
  let renameReply = null;
  const mockModalSubmit = {
    isButton: () => false,
    isModalSubmit: () => true,
    isStringSelectMenu: () => false,
    customId: "v2room_name_modal",
    user: { id: "user_111" },
    member: mockMember,
    guild: mockGuild,
    fields: {
      getTextInputValue: (key) => key === "name_val" ? "Stanza VIP Frè" : ""
    },
    reply: async (p) => { renameReply = p; }
  };

  await mockClient.emit("interactionCreate", mockModalSubmit);
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(createdChannel.name, "Stanza VIP Frè", "Il nome della stanza deve essere aggiornato!");
  assert.ok(renameReply?.content?.includes("Stanza VIP Frè"), "La risposta deve confermare il nuovo nome!");
  console.log("   ✅ v2room_name_modal funzionante!");

  // 3. Test leaving the temporary channel
  console.log("3. Test Uscita dal canale temporaneo ed auto-eliminazione...");
  createdChannel.members.delete(mockMember.id);
  await mockClient.emit("voiceStateUpdate",
    { channelId: "temp_voice_99999", channel: createdChannel, member: mockMember, guild: mockGuild },
    { channelId: null, member: mockMember, guild: mockGuild }
  );
  await new Promise(r => setTimeout(r, 50));

  assert.strictEqual(createdChannel.deleted, true, "La stanza vuota deve essere eliminata automaticamente!");
  assert.strictEqual(activeRooms.has("temp_voice_99999"), false, "La stanza deve essere rimossa da activeRooms!");
  console.log("   ✅ Auto-delete stanza vuota funzionante!");

  console.log("\n🎉 TUTTI I TEST DEL SISTEMA VOCALE SUPERATI CON SUCCESSO!");
}

testVoiceEngine().catch(err => {
  console.error("❌ TEST FALLITO:", err);
  process.exit(1);
});
