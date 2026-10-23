/**
 * SENTINEL AI — ACTION EXECUTOR
 * 
 * Coordinates:
 * 1. Action Guard (10 Pre-flight Checks)
 * 2. Tool Engine Execution
 * 3. Action Verifier (Post-flight Verification)
 * 4. Anti-Loop & Circuit Breaker (Max 5 actions per cycle, max 2 retries)
 * 5. Memory update
 */

const { defaultActionGuard } = require("../action-guard/ActionGuard");
const { defaultToolEngine } = require("../tool-engine/ToolEngine");
const { defaultActionVerifier } = require("../action-verifier/ActionVerifier");
const { defaultMemoryEngine } = require("../memory-engine/MemoryEngine");

class ActionExecutor {
  constructor(toolEngine = defaultToolEngine, actionGuard = defaultActionGuard, actionVerifier = defaultActionVerifier) {
    this.toolEngine = toolEngine;
    this.actionGuard = actionGuard;
    this.actionVerifier = actionVerifier;
  }

  /**
   * Executes a planned action sequence safely
   */
  async executePlan(plan, context = {}) {
    const {
      guildId,
      channelId,
      userId,
      guildConfig = {},
      cycleKey = `cycle_${Date.now()}`,
      maxActionsPerCycle = 5,
      maxRetries = 2,
      dryRun = false,
      discordClient = null
    } = context;

    const results = [];
    let executedInCycle = 0;

    try {
      for (const step of plan) {
        if (executedInCycle >= maxActionsPerCycle) {
          results.push({
            toolName: step.toolName,
            success: false,
            error: `Circuit breaker: max actions per cycle (${maxActionsPerCycle}) exceeded.`
          });
          break;
        }

        // 1. Guard Check
        const guardResult = await this.actionGuard.check({
          guildId,
          channelId,
          toolName: step.toolName,
          params: step.params,
          targetMember: context.targetMember,
          botMember: context.botMember,
          guildConfig,
          cycleKey,
          maxActionsPerCycle
        });

        if (!guardResult.allowed) {
          results.push({
            toolName: step.toolName,
            success: false,
            blockedByGuard: true,
            checkpoint: guardResult.checkpoint,
            error: guardResult.reason,
            requiresStaff: guardResult.requiresStaff
          });
          // If critical step is blocked, abort plan
          if (step.critical) break;
          continue;
        }

        // 2. Execution with Controlled Retries
        let execResult = null;
        let verifyResult = null;
        let attempts = 0;

        while (attempts <= maxRetries) {
          attempts++;
          execResult = await this.toolEngine.executeTool(step.toolName, step.params, {
            guildId,
            channelId,
            userId,
            dryRun,
            ...context
          });

          // 3. Post-execution Verification
          verifyResult = await this.actionVerifier.verify({
            toolName: step.toolName,
            executionResult: execResult,
            params: step.params,
            discordClient,
            guildId
          });

          if (verifyResult.verified) {
            break;
          }

          if (!verifyResult.retryable || attempts > maxRetries) {
            break;
          }
        }

        // Record in guard idempotency cache if successful
        if (verifyResult?.verified) {
          const targetId = step.params.targetId || step.params.userId || step.params.channelId || channelId || "";
          this.actionGuard.recordExecution(guildId, step.toolName, targetId, step.params);
        }

        executedInCycle++;
        results.push({
          toolName: step.toolName,
          params: step.params,
          success: Boolean(verifyResult?.verified),
          verified: Boolean(verifyResult?.verified),
          data: execResult?.data,
          error: verifyResult?.verified ? null : (verifyResult?.reason || execResult?.error),
          simulated: Boolean(execResult?.simulated),
          attempts
        });

        // Update structured ticket memory if ticketId or channelId is active
        if (channelId && guildId) {
          try {
            defaultMemoryEngine.updateTicketMemory(guildId, channelId, current => {
              const actions = current.actionsPerformed || [];
              actions.push({
                toolName: step.toolName,
                params: step.params,
                success: Boolean(verifyResult?.verified),
                timestamp: new Date().toISOString()
              });
              return { actionsPerformed: actions };
            });
          } catch (e) {}
        }

        if (!verifyResult?.verified && step.critical) {
          break;
        }
      }
    } finally {
      this.actionGuard.resetLoopCounter(cycleKey);
    }

    return results;
  }
}

const defaultActionExecutor = new ActionExecutor();
module.exports = {
  ActionExecutor,
  defaultActionExecutor
};
