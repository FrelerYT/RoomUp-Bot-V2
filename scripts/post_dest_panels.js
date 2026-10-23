require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const dump = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));
  const sourceMsgs = JSON.parse(fs.readFileSync(path.join(__dirname, "source_messages.json"), "utf8"));
  const dest = dump.dest;

  // 1. Post Verification Panel in ☑️・verifica
  const verifyCh = dest.channels.find(c => c.name === "☑️・verifica");
  if (verifyCh) {
    const vMsg = sourceMsgs["☑️・verifica"]?.[0];
    if (vMsg) {
      console.log("Posting Verification Panel to Dest ☑️・verifica...");
      const payload = {
        embeds: vMsg.embeds.map(e => ({
          title: e.title,
          description: e.description,
          color: e.color,
          image: e.image ? { url: e.image.url } : undefined,
          thumbnail: e.thumbnail ? { url: e.thumbnail.url } : undefined,
          footer: e.footer ? { text: e.footer.text } : undefined
        })),
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                custom_id: "roomup_verify_start",
                style: 2,
                label: "Clicca qui per verificarti"
              }
            ]
          }
        ]
      };
      await rest.post(Routes.channelMessages(verifyCh.id), { body: payload });
      console.log("✅ Verification Panel posted!");
    }
  }

  // 2. Post Rules in 📃・regole
  const rulesCh = dest.channels.find(c => c.name === "📃・regole");
  if (rulesCh) {
    const rMsg = sourceMsgs["📃・regole"]?.[0];
    if (rMsg) {
      console.log("Posting Rules Embeds to Dest 📃・regole...");
      const payload = {
        embeds: rMsg.embeds.map(e => ({
          title: e.title,
          description: e.description,
          color: e.color,
          thumbnail: e.thumbnail ? { url: e.thumbnail.url } : undefined,
          footer: e.footer ? { text: e.footer.text, icon_url: e.footer.icon_url } : undefined
        }))
      };
      await rest.post(Routes.channelMessages(rulesCh.id), { body: payload });
      console.log("✅ Rules Embeds posted!");
    }
  }

  // 3. Post Ticket Panel in 🎫・ticket
  const ticketCh = dest.channels.find(c => c.name === "🎫・ticket");
  if (ticketCh) {
    const tMsg = sourceMsgs["🎫・ticket"]?.[0];
    if (tMsg) {
      console.log("Posting Ticket Panel to Dest 🎫・ticket...");
      const payload = {
        embeds: tMsg.embeds.map(e => ({
          title: e.title,
          description: e.description,
          color: e.color,
          image: e.image ? { url: e.image.url } : undefined,
          thumbnail: e.thumbnail ? { url: e.thumbnail.url } : undefined,
          footer: e.footer ? { text: e.footer.text } : undefined
        })),
        components: [
          {
            type: 1,
            components: [
              {
                type: 3,
                custom_id: "ticket_select_panel_support",
                placeholder: "Seleziona una categoria di ticket...",
                min_values: 1,
                max_values: 1,
                options: [
                  {
                    label: "Supporto generale",
                    value: "general",
                    description: "Domande, bug, shop e segnalazioni.",
                    emoji: { name: "🛠️" }
                  },
                  {
                    label: "Partnership",
                    value: "partnership",
                    description: "Richiedi una partnership con il server.",
                    emoji: { name: "🤝" }
                  },
                  {
                    label: "Candidature Staff",
                    value: "staff_app",
                    description: "Candidati come Staff su Discord, Minecraft o entrambi.",
                    emoji: { name: "📄" }
                  },
                  {
                    label: "Candidatura Content Creator o Media",
                    value: "media_app",
                    description: "Candidati come Media o Content Creator.",
                    emoji: { name: "🎥" }
                  }
                ]
              }
            ]
          }
        ]
      };
      await rest.post(Routes.channelMessages(ticketCh.id), { body: payload });
      console.log("✅ Ticket Panel posted!");
    }
  }

  // 4. Post Unban Appeal Panel in 🧧・unban
  const unbanCh = dest.channels.find(c => c.name === "🧧・unban");
  if (unbanCh) {
    const uMsg = sourceMsgs["🧧・unban"]?.[0];
    if (uMsg) {
      console.log("Posting Unban Appeal Panel to Dest 🧧・unban...");
      const payload = {
        embeds: uMsg.embeds.map(e => ({
          title: e.title,
          description: e.description,
          color: e.color,
          image: e.image ? { url: e.image.url } : undefined,
          thumbnail: e.thumbnail ? { url: e.thumbnail.url } : undefined,
          footer: e.footer ? { text: e.footer.text } : undefined
        })),
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                custom_id: "unban_appeal_start",
                style: 2,
                label: "Invia Ricorso"
              }
            ]
          }
        ]
      };
      await rest.post(Routes.channelMessages(unbanCh.id), { body: payload });
      console.log("✅ Unban Appeal Panel posted!");
    }
  }

  console.log("🎉 All panels posted successfully to Dest Guild!");
}

main().catch(console.error);
