const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require("discord.js");
const { readJsonSafe, writeJsonSafe } = require("../../core/storage");
const eventBus = require("../../core/eventBus");

function getFormsStorage() {
  return readJsonSafe("forms", {
    templates: [
      {
        id: "staff_app",
        title: "Candidatura Staff RoomUp!",
        description: "Compila il questionario per candidarti come Moderatore o Helper.",
        fields: [
          { customId: "age", label: "Quanti anni hai?", style: "SHORT", required: true },
          { customId: "experience", label: "Esperienze passate come moderatore:", style: "PARAGRAPH", required: true },
          { customId: "why", label: "Perché dovremmo scegliere te?", style: "PARAGRAPH", required: true }
        ]
      },
      {
        id: "unban_appeal",
        title: "Richiesta di Sban / Ricorso",
        description: "Modulo ufficiale per richiedere la revisione di una sanzione.",
        fields: [
          { customId: "case_id", label: "ID Sanzione o Data Ban:", style: "SHORT", required: false },
          { customId: "reason", label: "Perché ritieni ingiusta la sanzione?", style: "PARAGRAPH", required: true },
          { customId: "commitment", label: "Cosa farai per non ripetere l'errore?", style: "PARAGRAPH", required: true }
        ]
      }
    ],
    submissions: []
  });
}

function saveFormsStorage(data) {
  return writeJsonSafe("forms", data, true, "FormBuilder");
}

function buildModalForForm(formId) {
  const storage = getFormsStorage();
  const tmpl = storage.templates.find(t => t.id === formId);
  if (!tmpl) return null;

  const modal = new ModalBuilder()
    .setCustomId(`form_submit_${formId}`)
    .setTitle(tmpl.title.slice(0, 45));

  for (const f of tmpl.fields) {
    const input = new TextInputBuilder()
      .setCustomId(f.customId)
      .setLabel(f.label.slice(0, 45))
      .setStyle(f.style === "SHORT" ? TextInputStyle.Short : TextInputStyle.Paragraph)
      .setRequired(f.required !== false);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

function handleFormSubmission(formId, guildId, user, fieldsData) {
  const storage = getFormsStorage();
  const tmpl = storage.templates.find(t => t.id === formId);

  const sub = {
    id: "sub_" + Date.now(),
    formId,
    formTitle: tmpl ? tmpl.title : formId,
    guildId,
    userId: user.id,
    userTag: user.tag || user.username,
    answers: fieldsData,
    status: "PENDING",
    createdAt: new Date().toISOString()
  };

  storage.submissions.unshift(sub);
  saveFormsStorage(storage);

  eventBus.emit("forms.submitted", { guildId, submission: sub });
  return sub;
}

module.exports = {
  getFormsStorage,
  saveFormsStorage,
  buildModalForForm,
  handleFormSubmission
};