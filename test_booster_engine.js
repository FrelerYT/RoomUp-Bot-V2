const assert = require("assert");
const { EventEmitter } = require("events");
const { initBoosterEngine, handleBoostEvent, syncAllGuildBoosters } = require("./src/bot/boosterEngine");

async function testBoosterEngine() {
  console.log("=== TEST BOOSTER ENGINE ===");

  const assignedRoles = [];
  const removedRoles = [];
  let sentAnnouncement = null;

  const fakeRole1 = { id: "965420993155858442", name: "Booster", managed: true };
  const fakeRole2 = { id: "1554969583432245330", name: "SUPPORTER", managed: false };

  const fakeGuild = {
    id: "965378975675322438",
    name: "RoomUp! 2",
    premiumSubscriptionCount: 3,
    roles: {
      cache: new Map([
        [fakeRole1.id, fakeRole1],
        [fakeRole2.id, fakeRole2]
      ]),
      fetch: async (id) => (id === fakeRole1.id ? fakeRole1 : fakeRole2)
    },
    channels: {
      cache: new Map([
        ["1554969742803083396", {
          id: "1554969742803083396",
          name: "💎・boosts",
          isTextBased: () => true,
          send: async (payload) => {
            sentAnnouncement = payload;
            return { id: "msg_123" };
          }
        }]
      ])
    }
  };

  const fakeMember = {
    id: "user_456",
    displayName: "TestUser",
    user: {
      id: "user_456",
      tag: "TestUser#0001",
      username: "TestUser",
      displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
    },
    guild: fakeGuild,
    roles: {
      cache: new Map(),
      add: async (roleId) => {
        assignedRoles.push(roleId);
      },
      remove: async (roleId) => {
        removedRoles.push(roleId);
      }
    }
  };

  const config = {
    enabled: true,
    boosterRoleId: "965420993155858442",
    extraRoleIds: ["1554969583432245330"],
    boostChannelId: "1554969742803083396",
    announcementEnabled: true,
    boostMessage: "Grazie {user} per il boost a {guild}!",
    embedTitle: "💎 TEST BOOST!",
    embedColor: "#f37be1",
    removeExtraRolesOnUnboost: true
  };

  // Test 1: handleBoostEvent
  console.log("Test 1: handleBoostEvent adds non-managed extra role and sends NO messages to boost channel...");
  await handleBoostEvent(fakeMember, config);
  assert(assignedRoles.includes("1554969583432245330"), "Must assign role 1554969583432245330");
  assert(!assignedRoles.includes("965420993155858442"), "Must NOT attempt to assign managed role via API");
  assert(sentAnnouncement === null, "Must NOT send any announcement message to boost channel");
  console.log("✅ Test 1 Passed!");

  // Test 2: Full event simulation with mock client
  console.log("Test 2: Event simulation via initBoosterEngine...");
  const mockClient = new EventEmitter();
  mockClient.isReady = () => true;
  mockClient.guilds = { cache: new Map([[fakeGuild.id, fakeGuild]]) };

  initBoosterEngine(mockClient);

  const oldMember = {
    ...fakeMember,
    premiumSince: null,
    roles: { cache: new Map() }
  };
  const newMember = {
    ...fakeMember,
    premiumSince: new Date(),
    roles: { cache: new Map([["965420993155858442", fakeRole1]]) }
  };

  let eventTriggered = false;
  newMember.roles.add = async (roleId) => {
    if (roleId === "1554969583432245330") eventTriggered = true;
  };

  mockClient.emit("guildMemberUpdate", oldMember, newMember);
  await new Promise(r => setTimeout(r, 100));

  assert(eventTriggered, "guildMemberUpdate must trigger adding role 1554969583432245330");
  console.log("✅ Test 2 Passed!");

  console.log("ALL BOOSTER ENGINE TESTS PASSED SUCCESSFULLY! 🚀");
}

testBoosterEngine().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
