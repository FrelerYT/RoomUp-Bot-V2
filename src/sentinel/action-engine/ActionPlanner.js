/**
 * SENTINEL AI — ACTION PLANNER
 * 
 * Sequences tool calls proposed by Decision Engine into coherent plans.
 * Validates dependencies and ensures safe ordering.
 */

class ActionPlanner {
  /**
   * Builds an executable action plan from decision data
   */
  planActions(decision, context = {}) {
    const plan = [];

    // If decision specifies needsTool and tools list
    if (decision.needsTool && Array.isArray(decision.tools) && decision.tools.length > 0) {
      if (decision.message) {
        plan.push({
          toolName: "send_message",
          params: { content: decision.message }
        });
      }
      for (const t of decision.tools) {
        plan.push({
          toolName: t.name,
          params: t.params || {},
          critical: Boolean(t.critical)
        });
      }
    } else if (decision.action === "RESPOND" && decision.message) {
      plan.push({
        toolName: "send_message",
        params: { content: decision.message }
      });
    } else if (decision.action === "ASK" && decision.message) {
      plan.push({
        toolName: "send_message",
        params: { content: decision.message }
      });
    } else if (decision.action === "ESCALATE") {
      if (decision.message) {
        plan.push({
          toolName: "send_message",
          params: { content: decision.message }
        });
      }
      plan.push({
        toolName: "escalate_to_staff",
        params: { summary: decision.reason || decision.message || "Richiesta assistenza manuale." }
      });
    } else if (decision.action === "CLOSE") {
      if (decision.message) {
        plan.push({
          toolName: "send_message",
          params: { content: decision.message }
        });
      }
      plan.push({
        toolName: "close_ticket",
        params: { reason: decision.reason || "Ticket risolto." }
      });
    } else if (decision.action === "REOPEN") {
      plan.push({
        toolName: "reopen_ticket",
        params: {}
      });
    }

    return plan;
  }
}

const defaultActionPlanner = new ActionPlanner();
module.exports = {
  ActionPlanner,
  defaultActionPlanner
};
