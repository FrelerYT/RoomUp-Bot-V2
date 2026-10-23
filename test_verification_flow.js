const assert = require("assert");
const path = require("path");
const fs = require("fs");

const { getGuildConfig } = require("./src/config/settingsManager");
const roleManager = require("./src/modules/server/roleManager");

async function runTests() {
  console.log("=== INIZIO TEST SUITE: SISTEMA VERIFICA & STICKY ROLES ===");

  const GUILD_ID = "1429445691452948524";
  const UTENTI_ROLE_ID = "1550846908011122688";
  const UNVERIFIED_ROLE_ID = "1551607664574865589";

  const cfg = getGuildConfig(GUILD_ID);
  assert.strictEqual(cfg.verification?.enabled, true, "Verifica deve essere abilitata");
  assert.strictEqual(cfg.verification?.verifiedRoleId, UTENTI_ROLE_ID, "verifiedRoleId deve essere @Utenti");
  assert.strictEqual(cfg.verification?.isolateMemberOnJoin, true, "isolateMemberOnJoin deve essere true per isolamento manuale membro");

  console.log("1. Configurazione verification in settings.json: OK");

  // Test StickyRoles exclusion on Leave
  const { Collection } = require("discord.js");
  const mockRoles = new Collection([
    [UTENTI_ROLE_ID, { id: UTENTI_ROLE_ID, name: "Utenti", managed: false }],
    [UNVERIFIED_ROLE_ID, { id: UNVERIFIED_ROLE_ID, name: "Non Verificato", managed: false }],
    ["1550846906895437824", { id: "1550846906895437824", name: "║ UTENTI ║", managed: false }],
    ["999999999999999999", { id: "999999999999999999", name: "CustomRole", managed: false }]
  ]);

  const mockMember = {
    id: "test_user_12345",
    guild: {
      id: GUILD_ID,
      roles: {
        cache: mockRoles
      }
    },
    user: { bot: false, tag: "test_user#0001" },
    roles: {
      cache: mockRoles,
      add: async () => {},
      remove: async () => {}
    }
  };

  await roleManager.handleMemberLeave(mockMember);
  const storage = roleManager.getRoleStorage();
  const savedRoles = storage.stickyRoles[GUILD_ID]?.[mockMember.id] || [];

  assert.strictEqual(savedRoles.includes(UTENTI_ROLE_ID), false, "Il ruolo @Utenti NON deve mai essere salvato in stickyRoles!");
  assert.strictEqual(savedRoles.some(r => mockRoles.get(r)?.name.includes("║")), false, "I ruoli divisori NON devono essere salvati in stickyRoles!");
  assert.strictEqual(savedRoles.includes("999999999999999999"), true, "I ruoli custom consentiti possono essere salvati se applicabili");

  console.log("2. Esclusione @Utenti e ruoli divisori da stickyRoles su leave: SUPERATO");

  // Test Join with stale roles
  let restored = [];
  const mockRejoiningMember = {
    id: "test_user_12345",
    guild: {
      id: GUILD_ID,
      roles: {
        cache: mockRoles
      }
    },
    user: { bot: false, tag: "test_user#0001" },
    roles: {
      cache: new Map(), // starts with no roles
      add: async (roles) => {
        restored.push(...(Array.isArray(roles) ? roles : [roles]));
      }
    }
  };

  await roleManager.handleMemberJoin(mockRejoiningMember);
  assert.strictEqual(restored.includes(UTENTI_ROLE_ID), false, "Il ruolo @Utenti NON deve essere ripristinato al join!");
  console.log("3. Prevenzione ripristino @Utenti al rientro: SUPERATO");

  // Clean test user
  delete storage.stickyRoles[GUILD_ID]["test_user_12345"];
  roleManager.saveRoleStorage(storage);

  console.log("\n✅ TUTTI I 3 TEST UNITARI SUPERATI AL 100%!");
}

runTests().catch(err => {
  console.error("TEST FALLITO:", err);
  process.exit(1);
});
