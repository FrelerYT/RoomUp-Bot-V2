/**
 * SENTINEL AI — ESCALATION ENGINE
 * 
 * Manages human handoff when:
 * - Problem is not understood or low confidence (< 0.50)
 * - Proposed action exceeds allowed risk
 * - User disputes decision
 * - Contradictory information detected
 * - Novel / unseen case detected
 * - User explicitly requests staff
 * 
 * Generates structured escalation dossier and notifies configured staff roles.
 */

const { defaultMemoryEngine } = require("../memory-engine/MemoryEngine");

class EscalationEngine {
  constructor(memoryEngine = defaultMemoryEngine) {
    this.memoryEngine = memoryEngine;
  }

  /**
   * Generates standard human-readable handoff summary (Point 20)
   */
  formatHandoffSummary({ username, problem, verifiedFacts = [], currentResult = "", neededAction = "" }) {
    const factsList = verifiedFacts.length > 0
      ? verifiedFacts.map(f => `- ${f}`).join("\n")
      : "- Nessuna verifica preliminare completata";

    return [
      "UTENTE:",
      username || "Utente",
      "",
      "PROBLEMA:",
      problem || "Non specificato",
      "",
      "GIÀ VERIFICATO:",
      factsList,
      "",
      "RISULTATO:",
      currentResult || "Incertezza / Caso che richiede controllo manuale",
      "",
      "NECESSARIO:",
      neededAction || "Controllo manuale dello staff."
    ].join("\n");
  }

  /**
   * Triggers an escalation in a ticket channel
   */
  async escalateTicket({ channel, user, session, reason = "", guildConfig = {}, client = null }) {
    if (!channel) return null;

    const guildId = session?.guildId || channel.guild?.id;
    const ticketId = session?.ticketId || channel.id;

    // Update ticket state to ESCALATED
    if (guildId) {
      this.memoryEngine.updateTicketMemory(guildId, ticketId, {
        currentState: "ESCALATED",
        mode: "ESCALATED"
      });
    }

    const summary = this.formatHandoffSummary({
      username: user?.username || "Utente",
      problem: session?.problem || reason,
      verifiedFacts: session?.knownFacts || [],
      currentResult: reason || "Confidenza insufficiente per procedere in autonomia",
      neededAction: "Intervento operatore umano per completare la procedura."
    });

    // Determine staff roles to ping
    const staffRoleIds = guildConfig?.tickets?.panels?.[0]?.categories?.[0]?.staffRoleIds || guildConfig?.staffRoles || [];
    const pings = staffRoleIds.map(id => `<@&${id}>`).join(" ");

    const finalContent = pings ? `${pings}\n\n${summary}` : summary;
    const sent = await channel.send(finalContent).catch(() => null);

    return {
      success: true,
      summary,
      messageId: sent?.id
    };
  }
}

const defaultEscalationEngine = new EscalationEngine();
module.exports = {
  EscalationEngine,
  defaultEscalationEngine
};
