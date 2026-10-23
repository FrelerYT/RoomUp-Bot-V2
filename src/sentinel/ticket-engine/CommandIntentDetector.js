/**
 * SENTINEL AI — COMMAND & INTENT DETECTOR
 * 
 * Pre-LLM Deterministic Intent Classifier.
 * Guarantees that critical directives (Takeover, Resume, Close, Reopen, Directives, Rules)
 * produce real state transitions and tool executions deterministically, without relying on LLM text generation.
 */

const INTENT_TYPES = {
  STAFF_TAKEOVER: "STAFF_TAKEOVER",
  AI_RESUME: "AI_RESUME",
  CLOSE_TICKET: "CLOSE_TICKET",
  REOPEN_TICKET: "REOPEN_TICKET",
  STAFF_DIRECTIVE: "STAFF_DIRECTIVE",
  STAFF_CORRECTION: "STAFF_CORRECTION",
  STAFF_TEACH_RULE: "STAFF_TEACH_RULE",
  STATUS_INQUIRY: "STATUS_INQUIRY",
  OFFICIAL_DESCRIPTION: "OFFICIAL_DESCRIPTION",
  USER_RESOLUTION: "USER_RESOLUTION",
  USER_NOT_RESOLVED: "USER_NOT_RESOLVED",
  USER_QUESTION_ANNOUNCEMENT: "USER_QUESTION_ANNOUNCEMENT",
  NORMAL_CONVERSATION: "NORMAL_CONVERSATION"
};

class CommandIntentDetector {
  /**
   * Cleans text and normalizes for pattern matching
   */
  normalizeText(content = "") {
    return (content || "")
      .toLowerCase()
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .replace(/[’']/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Detects deterministic intent from message content
   */
  detectIntent(content = "", context = {}) {
    const norm = this.normalizeText(content);
    if (!norm) return { type: INTENT_TYPES.NORMAL_CONVERSATION, raw: content };

    // 1. Reopen Ticket (Highest priority for ticket operations)
    if (/\b(riapri|riapri ticket|riapri il ticket|riaprite|reopen|!reopen|\/reopen)\b/i.test(norm)) {
      return {
        type: INTENT_TYPES.REOPEN_TICKET,
        confidence: 1.0,
        raw: content
      };
    }

    // 2. Staff Takeover ("faccio io", "ci penso io", "io sto gestendo il ticket", "lascia a me", "prendo io questo ticket", etc.)
    const takeoverPatterns = [
      /\bio sto gestendo il ticket\b/i,
      /\bsto gestendo il ticket\b/i,
      /\bio gestisco il ticket\b/i,
      /\bgestisco il ticket\b/i,
      /\b(?:io\s+)?sto gestendo\b/i,
      /\blo sto gestendo\b/i,
      /\blo gestisco io\b/i,
      /\bgestisco io\b/i,
      /\bquesto ticket lo gestisco io\b/i,
      /\bquesto lo gestisco io\b/i,
      /\bme lo gestisco io\b/i,
      /\bme ne sto occupando io\b/i,
      /\bsto seguendo io\b/i,
      /\blo seguo io\b/i,
      /\bci sono io\b/i,
      /\b(?:no\s+)?faccio io\b/i,
      /\b(?:no\s+)?ci penso io\b/i,
      /\bci penso me\b/i,
      /\blascia a me\b/i,
      /\blascia fare a me\b/i,
      /\blascia stare\b/i,
      /\bprendo io questo ticket\b/i,
      /\bprendo io il ticket\b/i,
      /\bprendo io questo\b/i,
      /\bprendo io\b/i,
      /\bprendo ticket\b/i,
      /\bprendo il ticket\b/i,
      /\bme ne occupo io\b/i,
      /\bfermati\b/i,
      /\bnon intervenire\b/i,
      /\bnon rispondere\b/i,
      /\bstai muto\b/i,
      /\bnon parlare\b/i,
      /\bsilenzio\b/i,
      /\bfaccio da solo\b/i,
      /\bfaccio da me\b/i,
      /\blascio stare\b/i,
      /\blascio io\b/i
    ];
    if (takeoverPatterns.some(p => p.test(norm))) {
      return {
        type: INTENT_TYPES.STAFF_TAKEOVER,
        confidence: 1.0,
        raw: content
      };
    }

    // 3. AI Resume / Handover ("continua tu", "vai tu", "pensaci tu", "puoi fare te", etc.)
    const resumePatterns = [
      /\bcontinua tu\b/i,
      /\bvai tu\b/i,
      /\bpensaci tu\b/i,
      /\briprendi tu\b/i,
      /\bpuoi continuare\b/i,
      /\bpuoi procedere\b/i,
      /\briprendi\b/i,
      /\bprocedi tu\b/i,
      /\bvai avanti tu\b/i,
      /\bprendi tu\b/i,
      /\bprendi ticket\b/i,
      /\bprendi il ticket\b/i,
      /\brispondi tu\b/i,
      /\baiutalo tu\b/i,
      /\bpuoi fare te\b/i,
      /\bpuoi fare tu\b/i,
      /\bfai tu\b/i,
      /\bfai te\b/i,
      /\blascia ticket\b/i,
      /\blascia il ticket\b/i,
      /\blascio ticket\b/i,
      /\blascio il ticket\b/i
    ];
    if (resumePatterns.some(p => p.test(norm))) {
      return {
        type: INTENT_TYPES.AI_RESUME,
        confidence: 1.0,
        raw: content
      };
    }

    // 4. Close Ticket ("chiudi il ticket", "chiudi ticket", "risolvi ticket", "!close", "/close")
    const closePatterns = [
      /\b(chiudi il ticket|chiudi ticket|chiudilo|chiudi questo ticket|chiudi questo|chiudiamo il ticket|chiudete il ticket|chiudete|chiudilo pure|chiudi pure|risolvi ticket|archivia ticket|!close|\/close)\b/i,
      /^chiudi$/i
    ];
    if (closePatterns.some(p => p.test(norm))) {
      return {
        type: INTENT_TYPES.CLOSE_TICKET,
        confidence: 1.0,
        raw: content
      };
    }

    // 5. Official Description Saving (Partnerships)
    if (/\b(questa [eè] la nostra descrizione|ecco la nostra descrizione|descrizione nostra|nostro annuncio|salva descrizione)\b/i.test(norm)) {
      return {
        type: INTENT_TYPES.OFFICIAL_DESCRIPTION,
        confidence: 1.0,
        raw: content
      };
    }

    // 6. Staff Teaching / Rule Learning ("Per questo tipo di problema chiediamo sempre...", "ricorda che...", "impara che...", "ricordati vedere sempre...")
    const rulePatterns = [
      /\b(per questo tipo di problema chiediamo sempre|quando succede questo problema chiediamo sempre|quando succede questo problema|regola per questo problema)\b/i,
      /\b(ricorda che|ricordati che|ricordati vedere sempre|ricorda di vedere sempre|ricordati di|ricorda di|ricordati sempre|ricorda sempre|ricordati|ricorda)\b/i,
      /\b(impara che|impara|tieni a mente che|tieni a mente|non dimenticare di|non dimenticare che|non dimenticare)\b/i,
      /\b(controlla sempre che|controlla sempre|verifica sempre che|verifica sempre|assicurati che|assicurati di|fai attenzione che|fai attenzione a|attento a)\b/i,
      /\b(non sia nsfw|contenuti brutti|contenuti un po brutti|contenuti inappropriati)\b/i,
      /\b(salva la regola|nuova regola|!learn|\/learn)\b/i
    ];
    if (rulePatterns.some(p => p.test(norm))) {
      return {
        type: INTENT_TYPES.STAFF_TEACH_RULE,
        confidence: 1.0,
        raw: content
      };
    }

    // 7. Staff Correction ("risposta sbagliata", "non era quello", "hai sbagliato", "no non si fa così")
    const correctionPatterns = [
      /\brisposta sbagliata\b/i,
      /\bnon era quello\b/i,
      /\bhai sbagliato\b/i,
      /\bno non si fa così\b/i,
      /\bcorrezione:\b/i
    ];
    if (correctionPatterns.some(p => p.test(norm))) {
      return {
        type: INTENT_TYPES.STAFF_CORRECTION,
        confidence: 0.98,
        raw: content
      };
    }

    // 8. Staff Directives to User ("chiedigli ...", "digli di ...", "spiegagli ...")
    const directivePatterns = [
      /^chiedigli\b/i,
      /^chiedi a\b/i,
      /^digli\b/i,
      /^dici a\b/i,
      /^fagli\b/i,
      /^spiegagli\b/i,
      /\bdevi chiedere a\b/i,
      /\bchiedi tu a\b/i
    ];
    if (directivePatterns.some(p => p.test(norm))) {
      return {
        type: INTENT_TYPES.STAFF_DIRECTIVE,
        confidence: 0.95,
        instruction: content,
        raw: content
      };
    }

    // 9. Status / Briefing Inquiry ("che succede", "cosa succede", "status", "a che punto siamo")
    const statusInquiryPatterns = [
      /\bche succede\b/i,
      /\bcosa succede\b/i,
      /\bcosa sta succedendo\b/i,
      /\bche sta succedendo\b/i,
      /\ba che punto siamo\b/i,
      /\bqual [eè] la situazione\b/i,
      /\bqual [eè] lo stato\b/i,
      /\bstatus\b/i,
      /\bstato ticket\b/i,
      /\briassunto\b/i,
      /\briassumi\b/i,
      /\bcosa manca\b/i,
      /\baggiornami\b/i,
      /\bspiegami\b/i
    ];
    if (statusInquiryPatterns.some(p => p.test(norm))) {
      return {
        type: INTENT_TYPES.STATUS_INQUIRY,
        confidence: 0.95,
        raw: content
      };
    }

    // 10. User Resolution Signals ("risolto", "funziona grazie", "a posto grazie")
    const resolutionSignals = [
      "risolto", "funziona grazie", "a posto grazie", "tutto risolto",
      "grazie mille funziona", "ho risolto", "risolto tutto", "grazie per l'aiuto"
    ];
    if (resolutionSignals.some(s => norm.includes(s))) {
      return {
        type: INTENT_TYPES.USER_RESOLUTION,
        confidence: 0.96,
        raw: content
      };
    }

    // 11. User Not Resolved Signals
    const notResolvedSignals = [
      "non funziona", "ancora errore", "non va", "stesso problema", "non riesco ancora"
    ];
    if (notResolvedSignals.some(s => norm.includes(s))) {
      return {
        type: INTENT_TYPES.USER_NOT_RESOLVED,
        confidence: 0.95,
        raw: content
      };
    }

    // 12. User Question Announcement ("ho una domanda", "posso farti una domanda", "un dubbio")
    if (/\b(domand[ae]|dkamnd[ae]|chiedere|chiarimento|dubbio|posso|ascolta|dimmi|help|aiuto|info)\b/i.test(norm) &&
        !/\b(risolto|chiudi|funziona|staff|canale|invito|screenshot|errore|problema|bug|ban)\b/i.test(norm)) {
      return {
        type: INTENT_TYPES.USER_QUESTION_ANNOUNCEMENT,
        confidence: 0.95,
        raw: content
      };
    }

    return {
      type: INTENT_TYPES.NORMAL_CONVERSATION,
      confidence: 0.70,
      raw: content
    };
  }

  /**
   * Deterministic directive translation to 2nd-person user query
   * Guarantees zero leakage of "Lo staff mi ha detto di chiederti".
   */
  formatDirectiveDeterministically(instruction = "") {
    const raw = (instruction || "").trim();
    let cleaned = raw.replace(/[.!?]+$/, "").trim();

    // Normalize variations of asking the user
    cleaned = cleaned
      .replace(/^(?:puoi\s+)?(?:chiedergli|chiedi\s+all'utente|chiedi\s+a\s+lui|chiedi\s+a\s+lei)\s+/i, "chiedigli ")
      .replace(/^(?:puoi\s+)?(?:dirgli|digli\s+all'utente|di'\s+all'utente|dici\s+all'utente)\s+/i, "digli ")
      .trim();

    // "chiedigli uno screen completo" / "chiedigli uno screenshot a schermo intero"
    if (/^chiedigli\s+(?:uno|uno\s+|un\s+|lo\s+)?(screen|screenshot)\s+(completo|a schermo intero)/i.test(cleaned)) {
      return "Riusciresti a inviarmi uno screenshot a schermo intero?";
    }
    // "chiedigli uno screen" / "chiedigli uno screenshot"
    if (/^chiedigli\s+(uno|una|un|lo|la|i|gli|le)\s+(screen|screenshot|foto|immagine|prova)/i.test(cleaned)) {
      const match = cleaned.replace(/^chiedigli\s+(uno|una|un|lo|la|i|gli|le)\s+/i, "");
      const art = /^(?:screen|screenshot)\b/i.test(match) ? "uno" : "un";
      return `Riusciresti a inviarmi ${art} ${match}?`;
    }
    // "chiedigli se ..."
    if (/^chiedigli\s+se\s+/i.test(cleaned)) {
      const rest = cleaned.replace(/^chiedigli\s+se\s+/i, "");
      return `Puoi dirmi se ${rest}?`;
    }
    // "chiedigli di ..."
    if (/^chiedigli\s+di\s+/i.test(cleaned)) {
      const rest = cleaned.replace(/^chiedigli\s+di\s+/i, "");
      return `Riusciresti a ${rest}?`;
    }
    // "chiedigli ..."
    if (/^chiedigli\s+/i.test(cleaned)) {
      const rest = cleaned.replace(/^chiedigli\s+/i, "");
      return `Puoi fornirmi ${rest}?`;
    }
    // "digli di ..."
    if (/^digli\s+di\s+/i.test(cleaned)) {
      const rest = cleaned.replace(/^digli\s+di\s+/i, "");
      return `Ti chiediamo di ${rest}.`;
    }
    // "fagli ..."
    if (/^fagli\s+/i.test(cleaned)) {
      const rest = cleaned.replace(/^fagli\s+/i, "");
      return `Riusciresti a ${rest}?`;
    }
    // "spiegagli ..."
    if (/^spiegagli\s+che\s+/i.test(cleaned)) {
      const rest = cleaned.replace(/^spiegagli\s+che\s+/i, "");
      return `Ti informo che ${rest}.`;
    }

    return raw;
  }
}

const defaultCommandIntentDetector = new CommandIntentDetector();
module.exports = {
  CommandIntentDetector,
  defaultCommandIntentDetector,
  INTENT_TYPES
};
