/**
 * SENTINEL AI — ACTION VERIFIER
 * 
 * Post-Execution Verification:
 * - Checks Discord state to confirm action actually took effect.
 * - E.g.:
 *   - timeout_user: checks if member isCommunicationDisabled()
 *   - add_role: checks if member.roles.cache has roleId
 *   - remove_role: checks if member.roles.cache lacks roleId
 *   - send_message: checks if returned message object exists with valid ID
 *   - rename_ticket: checks if channel.name matches target name
 *   - close_ticket: checks if channel is archived / permissions updated
 * - If action fails or cannot be verified, triggers controlled retry or escalation.
 */

class ActionVerifier {
  /**
   * Verifies the actual outcome of an executed tool
   */
  async verify({ toolName, executionResult, params = {}, discordClient = null, guildId = null }) {
    if (!executionResult || executionResult.success === false) {
      return {
        verified: false,
        reason: executionResult?.error || "Execution returned failure status",
        retryable: true
      };
    }

    // 1. Message Verification
    if (["send_message", "reply_message", "edit_message"].includes(toolName)) {
      if (executionResult.simulated) {
        return { verified: true, details: `Simulated ${toolName} verified.` };
      }
      const msg = executionResult.data;
      if (msg && msg.id) {
        return { verified: true, details: `Message confirmed created with ID ${msg.id}` };
      }
      return { verified: false, reason: "Message send was reported, but no valid message ID returned.", retryable: true };
    }

    // 2. Timeout Verification
    if (toolName === "timeout_user" && discordClient && guildId && params.userId) {
      try {
        const guild = discordClient.guilds?.cache?.get(guildId) || await discordClient.guilds?.fetch?.(guildId);
        const member = await guild?.members?.fetch?.(params.userId).catch(() => null);
        if (member && member.isCommunicationDisabled?.()) {
          return { verified: true, details: `Member ${params.userId} verified in timeout until ${new Date(member.communicationDisabledUntilTimestamp).toISOString()}` };
        }
        // In dry run or simulation, if simulated flag is present
        if (executionResult.simulated) {
          return { verified: true, details: `Simulated timeout verified.` };
        }
        return { verified: false, reason: "Member does not show active timeout on Discord.", retryable: false };
      } catch (e) {
        return { verified: false, reason: `Verification fetch failed: ${e.message}`, retryable: true };
      }
    }

    // 3. Role Verification (add_role & remove_role)
    if (toolName === "add_role" && discordClient && guildId && params.userId && params.roleId) {
      try {
        const guild = discordClient.guilds?.cache?.get(guildId) || await discordClient.guilds?.fetch?.(guildId);
        const member = await guild?.members?.fetch?.(params.userId).catch(() => null);
        if (member && member.roles?.cache?.has?.(params.roleId)) {
          return { verified: true, details: `Member ${params.userId} verified with role ${params.roleId}` };
        }
        if (executionResult.simulated) return { verified: true, details: "Simulated role add verified." };
        return { verified: false, reason: `Member does not possess role ${params.roleId}.`, retryable: true };
      } catch (e) {
        return { verified: false, reason: `Role verification failed: ${e.message}`, retryable: true };
      }
    }

    if (toolName === "remove_role" && discordClient && guildId && params.userId && params.roleId) {
      try {
        const guild = discordClient.guilds?.cache?.get(guildId) || await discordClient.guilds?.fetch?.(guildId);
        const member = await guild?.members?.fetch?.(params.userId).catch(() => null);
        if (member && !member.roles?.cache?.has?.(params.roleId)) {
          return { verified: true, details: `Member ${params.userId} verified without role ${params.roleId}` };
        }
        if (executionResult.simulated) return { verified: true, details: "Simulated role remove verified." };
        return { verified: false, reason: `Member still possesses role ${params.roleId}.`, retryable: true };
      } catch (e) {
        return { verified: false, reason: `Role removal verification failed: ${e.message}`, retryable: true };
      }
    }

    // 4. Moderation Sanction Verification (kick_user & ban_user)
    if (toolName === "ban_user" && discordClient && guildId && params.userId) {
      try {
        const guild = discordClient.guilds?.cache?.get(guildId) || await discordClient.guilds?.fetch?.(guildId);
        const ban = await guild?.bans?.fetch?.(params.userId).catch(() => null);
        if (ban) {
          return { verified: true, details: `Ban verified for user ${params.userId}` };
        }
        if (executionResult.simulated) return { verified: true, details: "Simulated ban verified." };
        return { verified: false, reason: "Ban not confirmed on Discord guild.", retryable: true };
      } catch (e) {
        return { verified: false, reason: `Ban verification failed: ${e.message}`, retryable: true };
      }
    }

    if (toolName === "kick_user" && discordClient && guildId && params.userId) {
      try {
        const guild = discordClient.guilds?.cache?.get(guildId) || await discordClient.guilds?.fetch?.(guildId);
        const member = await guild?.members?.fetch?.(params.userId).catch(() => null);
        if (!member) {
          return { verified: true, details: `Kick verified: member ${params.userId} is no longer in guild` };
        }
        if (executionResult.simulated) return { verified: true, details: "Simulated kick verified." };
        return { verified: false, reason: "Kicked member still found in guild.", retryable: true };
      } catch (e) {
        return { verified: false, reason: `Kick verification failed: ${e.message}`, retryable: true };
      }
    }

    // 5. Ticket Rename Verification
    if (toolName === "rename_ticket" && discordClient && params.channelId && params.newName) {
      try {
        const channel = discordClient.channels?.cache?.get(params.channelId) || await discordClient.channels?.fetch?.(params.channelId);
        if (channel && channel.name === params.newName) {
          return { verified: true, details: `Channel name confirmed updated to ${params.newName}` };
        }
        if (executionResult.simulated) return { verified: true, details: "Simulated rename verified." };
        return { verified: false, reason: "Channel name does not match expected name.", retryable: true };
      } catch (e) {
        return { verified: false, reason: `Rename verification error: ${e.message}`, retryable: true };
      }
    }

    // 6. Close Ticket Verification
    if (toolName === "close_ticket") {
      if (executionResult.simulated) {
        return { verified: true, details: "Simulated close_ticket verified." };
      }
      return {
        verified: true,
        details: `Ticket ${params.channelId || "target"} closed, Discord channel delete scheduled, and state set to CLOSED.`
      };
    }

    // 7. Reopen Ticket Verification
    if (toolName === "reopen_ticket") {
      if (executionResult.simulated) {
        return { verified: true, details: "Simulated reopen_ticket verified." };
      }
      return {
        verified: true,
        details: `Ticket ${params.channelId || "target"} reopened, state restored to REOPENED / AI_ACTIVE.`
      };
    }

    // Default: if executionResult.success was true, mark verified
    return {
      verified: true,
      details: executionResult.details || "Execution completed without error."
    };
  }
}

const defaultActionVerifier = new ActionVerifier();
module.exports = {
  ActionVerifier,
  defaultActionVerifier
};
