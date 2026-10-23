/**
 * SENTINEL AI — TOOL ENGINE
 * 
 * 28+ Granular Tools with Discord abstraction.
 * All actions are validated through schemas and executed through adapters.
 * Never executes raw Discord mutations directly from AI reasoning.
 */

const { defaultKnowledgeEngine } = require("../knowledge-engine/KnowledgeEngine");
const { defaultMemoryEngine } = require("../memory-engine/MemoryEngine");

class ToolEngine {
  constructor(discordClient = null) {
    this.client = discordClient;
  }

  setClient(client) {
    this.client = client;
  }

  async executeTool(toolName, params = {}, context = {}) {
    const { guildId, channelId, userId, dryRun = false } = context;

    if (dryRun) {
      return {
        success: true,
        simulated: true,
        toolName,
        params,
        details: `[Dry Run] Would execute ${toolName} with params ${JSON.stringify(params)}`
      };
    }

    const handler = this[toolName];
    if (typeof handler !== "function") {
      return { success: false, error: `Tool ${toolName} not implemented in ToolEngine.` };
    }

    try {
      return await handler.call(this, params, { guildId, channelId, userId, ...context });
    } catch (err) {
      console.error(`[Sentinel:ToolEngine] Error executing ${toolName}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  // 1. send_message
  async send_message(params, ctx) {
    const channelId = params.channelId || ctx.channelId;
    const guildId = params.guildId || ctx.guildId;

    if (guildId && channelId) {
      const freshSession = defaultMemoryEngine.getTicketMemory(guildId, channelId);
      if (freshSession) {
        if (freshSession.currentState === "CLOSED") {
          return { success: false, error: "Cannot send message: Ticket is CLOSED." };
        }
        if ((freshSession.mode === "AI_PASSIVE" || freshSession.mode === "STAFF_ACTIVE" || freshSession.currentState === "STAFF_TAKEOVER") && !params.allowInPassive && !params.isStaffInitiated) {
          return { success: false, error: "Cannot send message: Ticket is in STAFF_TAKEOVER / AI_PASSIVE mode." };
        }
      }
    }

    const channel = this.client?.channels?.cache?.get(channelId) || await this.client?.channels?.fetch?.(channelId).catch(() => null);
    if (!channel) return { success: false, error: `Channel ${channelId} not found.` };

    const payload = {};
    if (params.content) payload.content = String(params.content);
    if (params.embeds) payload.embeds = params.embeds;

    const msg = await channel.send(payload);
    return { success: true, data: { id: msg.id, channelId: msg.channelId, content: msg.content } };
  }

  // 2. reply_message
  async reply_message(params, ctx) {
    const channelId = params.channelId || ctx.channelId;
    const guildId = params.guildId || ctx.guildId;

    if (guildId && channelId) {
      const freshSession = defaultMemoryEngine.getTicketMemory(guildId, channelId);
      if (freshSession) {
        if (freshSession.currentState === "CLOSED") {
          return { success: false, error: "Cannot reply: Ticket is CLOSED." };
        }
        if ((freshSession.mode === "AI_PASSIVE" || freshSession.mode === "STAFF_ACTIVE" || freshSession.currentState === "STAFF_TAKEOVER") && !params.allowInPassive && !params.isStaffInitiated) {
          return { success: false, error: "Cannot reply: Ticket is in STAFF_TAKEOVER / AI_PASSIVE mode." };
        }
      }
    }

    const channel = this.client?.channels?.cache?.get(channelId) || await this.client?.channels?.fetch?.(channelId).catch(() => null);
    if (!channel) return { success: false, error: `Channel ${channelId} not found.` };

    const messageId = params.messageId || ctx.messageId;
    const targetMsg = messageId ? await channel.messages?.fetch?.(messageId).catch(() => null) : null;

    const payload = { content: String(params.content || "") };
    if (params.embeds) payload.embeds = params.embeds;

    const sent = targetMsg ? await targetMsg.reply(payload) : await channel.send(payload);
    return { success: true, data: { id: sent.id, channelId: sent.channelId, content: sent.content } };
  }

  // 3. edit_message
  async edit_message(params, ctx) {
    const channelId = params.channelId || ctx.channelId;
    const channel = this.client?.channels?.cache?.get(channelId);
    if (!channel) return { success: false, error: "Channel not found" };

    const msg = await channel.messages?.fetch?.(params.messageId).catch(() => null);
    if (!msg) return { success: false, error: "Message not found" };

    const updated = await msg.edit(params.content);
    return { success: true, data: { id: updated.id } };
  }

  // 4. delete_message
  async delete_message(params, ctx) {
    const channelId = params.channelId || ctx.channelId;
    const channel = this.client?.channels?.cache?.get(channelId) || await this.client?.channels?.fetch?.(channelId).catch(() => null);
    if (!channel) return { success: false, error: "Channel not found" };

    const msg = await channel.messages?.fetch?.(params.messageId).catch(() => null);
    if (!msg) return { success: false, error: "Message not found" };

    await msg.delete().catch(() => null);
    return { success: true, data: { messageId: params.messageId } };
  }

  // 5. create_ticket
  async create_ticket(params, ctx) {
    // Delegates to ticketEngine or simulates
    return {
      success: true,
      data: { ticketId: "tkt_" + Date.now(), category: params.category || "general" }
    };
  }

  // 6. close_ticket
  async close_ticket(params, ctx) {
    const channelId = params.channelId || ctx.channelId;
    const guildId = params.guildId || ctx.guildId;
    const reason = params.reason || "Risolto con Sentinel AI";
    const closedBy = params.closedBy || ctx.userId || "Staff";
    const channel = this.client?.channels?.cache?.get(channelId) || await this.client?.channels?.fetch?.(channelId).catch(() => null);

    const isTicketChannel = Boolean(
      (channel && (channel.name?.startsWith("ticket-") || channel.topic?.includes("ticket"))) ||
      (guildId && channelId && defaultMemoryEngine.getTicketMemory(guildId, channelId)) ||
      params.isTicket || ctx.isTicket
    );

    if (!isTicketChannel && channel) {
      return { success: false, error: "Refusing to close non-ticket channel." };
    }

    // Cancel all in-flight AI tasks for this ticket immediately
    if (guildId && channelId) {
      try {
        const { defaultTicketConcurrencyManager } = require("../concurrency/TicketConcurrencyManager");
        defaultTicketConcurrencyManager.cancelPendingForTicket(guildId, channelId, "Ticket closed");
      } catch (e) {}
    }

    if (channel) {
      await channel.send(`🔒 **Ticket chiuso:** ${reason}`).catch(() => null);

      // Perform real Discord API channel closing/deletion
      if (typeof channel.delete === "function") {
        const isImmediate = Boolean(params.immediate || ctx.isTest || ctx.dryRun);
        if (isImmediate) {
          await channel.delete(`Chiusura ticket da Sentinel AI: ${reason}`).catch(() => null);
        } else {
          setTimeout(async () => {
            await channel.delete(`Chiusura ticket da Sentinel AI: ${reason}`).catch(() => null);
          }, 3000);
        }
      }
    }

    if (guildId && channelId) {
      defaultMemoryEngine.updateTicketMemory(guildId, channelId, {
        currentState: "CLOSED",
        mode: "RESOLVED",
        closedAt: new Date().toISOString(),
        resolution: reason
      });
      defaultMemoryEngine.updateGuildMemory(guildId, cur => {
        const stats = cur.statistics || { totalTickets: 0, resolvedTickets: 0, escalatedTickets: 0, staffInterventions: 0 };
        stats.resolvedTickets = (stats.resolvedTickets || 0) + 1;
        return { ...cur, statistics: stats };
      });
    }

    return { success: true, data: { channelId, status: "closed", reason, closedBy } };
  }

  // 7. reopen_ticket
  async reopen_ticket(params, ctx) {
    const channelId = params.channelId || ctx.channelId;
    const guildId = params.guildId || ctx.guildId;
    const reopenedBy = params.reopenedBy || ctx.userId || "Staff";
    const channel = this.client?.channels?.cache?.get(channelId) || await this.client?.channels?.fetch?.(channelId).catch(() => null);

    if (channel) {
      await channel.send(`🔓 **Ticket riaperto dallo staff** (${reopenedBy}). Sentinel è nuovamente attivo.`).catch(() => null);
    }

    if (guildId && channelId) {
      defaultMemoryEngine.updateTicketMemory(guildId, channelId, {
        currentState: "REOPENED",
        mode: "AI_ACTIVE",
        resolution: null,
        reopenedAt: new Date().toISOString()
      });
    }

    return { success: true, data: { channelId, status: "reopened", reopenedBy } };
  }

  // 8. rename_ticket
  async rename_ticket(params, ctx) {
    const channelId = params.channelId || ctx.channelId;
    const newName = String(params.newName || "").toLowerCase().replace(/\s+/g, "-");
    const channel = this.client?.channels?.cache?.get(channelId) || await this.client?.channels?.fetch?.(channelId).catch(() => null);
    if (!channel) return { success: false, error: "Channel not found" };

    await channel.setName(newName);
    return { success: true, data: { channelId, newName } };
  }

  // 9. move_ticket
  async move_ticket(params, ctx) {
    const channelId = params.channelId || ctx.channelId;
    const channel = this.client?.channels?.cache?.get(channelId) || await this.client?.channels?.fetch?.(channelId).catch(() => null);
    if (!channel) return { success: false, error: "Channel not found" };
    if (params.categoryId) {
      await channel.setParent(params.categoryId).catch(() => null);
    }
    return { success: true, data: { channelId, categoryId: params.categoryId } };
  }

  // 10. add_user_to_ticket
  async add_user_to_ticket(params, ctx) {
    const channelId = params.channelId || ctx.channelId;
    const channel = this.client?.channels?.cache?.get(channelId) || await this.client?.channels?.fetch?.(channelId).catch(() => null);
    if (!channel) return { success: false, error: "Channel not found" };

    await channel.permissionOverwrites?.edit?.(params.userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });
    return { success: true, data: { channelId, userId: params.userId } };
  }

  // 11. remove_user_from_ticket
  async remove_user_from_ticket(params, ctx) {
    const channelId = params.channelId || ctx.channelId;
    const channel = this.client?.channels?.cache?.get(channelId) || await this.client?.channels?.fetch?.(channelId).catch(() => null);
    if (!channel) return { success: false, error: "Channel not found" };

    await channel.permissionOverwrites?.delete?.(params.userId);
    return { success: true, data: { channelId, userId: params.userId } };
  }

  // 12. add_role
  async add_role(params, ctx) {
    const guild = this.client?.guilds?.cache?.get(ctx.guildId) || await this.client?.guilds?.fetch?.(ctx.guildId).catch(() => null);
    const member = await guild?.members?.fetch?.(params.userId).catch(() => null);
    if (!member) return { success: false, error: "Member not found" };

    await member.roles.add(params.roleId);
    return { success: true, data: { userId: params.userId, roleId: params.roleId } };
  }

  // 13. remove_role
  async remove_role(params, ctx) {
    const guild = this.client?.guilds?.cache?.get(ctx.guildId) || await this.client?.guilds?.fetch?.(ctx.guildId).catch(() => null);
    const member = await guild?.members?.fetch?.(params.userId).catch(() => null);
    if (!member) return { success: false, error: "Member not found" };

    await member.roles.remove(params.roleId);
    return { success: true, data: { userId: params.userId, roleId: params.roleId } };
  }

  // 14. timeout_user
  async timeout_user(params, ctx) {
    const guild = this.client?.guilds?.cache?.get(ctx.guildId) || await this.client?.guilds?.fetch?.(ctx.guildId).catch(() => null);
    const member = await guild?.members?.fetch?.(params.userId).catch(() => null);
    if (!member) return { success: false, error: "Member not found" };

    const durationMs = (params.durationMinutes || 10) * 60 * 1000;
    const reason = params.reason || "Sanzione automatica Sentinel AI";
    await member.timeout(durationMs, reason);
    return { success: true, data: { userId: params.userId, durationMinutes: params.durationMinutes, reason } };
  }

  // 15. warn_user
  async warn_user(params, ctx) {
    const { userId, reason } = params;
    defaultMemoryEngine.updateUserProfile(ctx.guildId, userId, prof => ({
      warnings: (prof.warnings || 0) + 1,
      notes: [...(prof.notes || []), `Warn: ${reason || "Avvertimento"} (${new Date().toISOString()})`]
    }));
    return { success: true, data: { userId, reason } };
  }

  // 16. get_user
  async get_user(params) {
    const user = await this.client?.users?.fetch?.(params.userId).catch(() => null);
    if (!user) return { success: false, error: "User not found" };
    return { success: true, data: { id: user.id, username: user.username, tag: user.tag } };
  }

  // 17. get_member
  async get_member(params, ctx) {
    const guild = this.client?.guilds?.cache?.get(ctx.guildId);
    const member = await guild?.members?.fetch?.(params.userId).catch(() => null);
    if (!member) return { success: false, error: "Member not found" };
    return {
      success: true,
      data: {
        id: member.id,
        nickname: member.nickname,
        roles: member.roles?.cache?.map(r => r.name) || [],
        joinedAt: member.joinedAt
      }
    };
  }

  // 18. get_roles
  async get_roles(params, ctx) {
    const guild = this.client?.guilds?.cache?.get(ctx.guildId);
    const roles = guild?.roles?.cache?.map(r => ({ id: r.id, name: r.name, position: r.position })) || [];
    return { success: true, data: roles };
  }

  // 19. get_channel
  async get_channel(params) {
    const channel = this.client?.channels?.cache?.get(params.channelId);
    if (!channel) return { success: false, error: "Channel not found" };
    return { success: true, data: { id: channel.id, name: channel.name, type: channel.type } };
  }

  // 20. search_messages
  async search_messages(params, ctx) {
    const channelId = params.channelId || ctx.channelId;
    const channel = this.client?.channels?.cache?.get(channelId);
    if (!channel) return { success: false, error: "Channel not found" };

    const limit = Math.min(params.limit || 20, 50);
    const messages = await channel.messages?.fetch?.({ limit }).catch(() => null);
    const list = messages ? Array.from(messages.values()).map(m => ({
      id: m.id,
      author: m.author.username,
      content: m.content,
      createdAt: m.createdAt
    })) : [];
    return { success: true, data: list };
  }

  // 21. get_ticket_history
  async get_ticket_history(params, ctx) {
    const session = defaultMemoryEngine.getTicketMemory(ctx.guildId, params.ticketId || ctx.channelId);
    return { success: true, data: session?.conversationHistory || [] };
  }

  // 22. get_transcript
  async get_transcript(params, ctx) {
    const history = await this.get_ticket_history(params, ctx);
    const lines = (history.data || []).map(h => `[${h.role}]: ${h.text}`).join("\n");
    return { success: true, data: { transcript: lines } };
  }

  // 23. create_thread
  async create_thread(params, ctx) {
    const channel = this.client?.channels?.cache?.get(ctx.channelId);
    if (!channel?.threads) return { success: false, error: "Channel does not support threads" };

    const thread = await channel.threads.create({
      name: params.name || "Discussione",
      autoArchiveDuration: 60
    });
    return { success: true, data: { threadId: thread.id, name: thread.name } };
  }

  // 24. send_dm
  async send_dm(params) {
    const user = await this.client?.users?.fetch?.(params.userId).catch(() => null);
    if (!user) return { success: false, error: "User not found" };

    const dm = await user.send(params.content);
    return { success: true, data: { dmId: dm.id, userId: user.id } };
  }

  // 25. analyze_image
  async analyze_image(params) {
    return {
      success: true,
      data: { analyzed: true, url: params.imageUrl, detectedText: params.detectedText || "" }
    };
  }

  // 26. search_knowledge
  async search_knowledge(params, ctx) {
    const results = defaultKnowledgeEngine.search(ctx.guildId, params.query, {
      category: params.category,
      limit: params.limit || 3
    });
    return { success: true, data: results };
  }

  // 27. save_memory / update_memory
  async save_memory(params, ctx) {
    defaultMemoryEngine.updateTicketMemory(ctx.guildId, params.ticketId || ctx.channelId, params.memoryPatch || {});
    return { success: true, data: { saved: true } };
  }

  async update_memory(params, ctx) {
    return this.save_memory(params, ctx);
  }

  // 28. escalate_to_staff & create_staff_alert
  async escalate_to_staff(params, ctx) {
    const channelId = params.channelId || ctx.channelId;
    const channel = this.client?.channels?.cache?.get(channelId);
    const summary = params.summary || "Richiesta assistenza manuale dello staff.";

    if (channel) {
      await channel.send(`⚠️ **Escalation allo Staff:**\n${summary}`).catch(() => null);
    }
    return { success: true, data: { escalated: true, summary } };
  }

  async create_staff_alert(params, ctx) {
    return this.escalate_to_staff(params, ctx);
  }

  // 29. kick_user
  async kick_user(params, ctx) {
    const guild = this.client?.guilds?.cache?.get(ctx.guildId) || await this.client?.guilds?.fetch?.(ctx.guildId).catch(() => null);
    const member = await guild?.members?.fetch?.(params.userId).catch(() => null);
    if (!member) return { success: false, error: "Member not found" };

    const reason = params.reason || "Espulsione automatica Sentinel AI";
    await member.kick(reason);
    return { success: true, data: { userId: params.userId, reason } };
  }

  // 30. ban_user
  async ban_user(params, ctx) {
    const guild = this.client?.guilds?.cache?.get(ctx.guildId) || await this.client?.guilds?.fetch?.(ctx.guildId).catch(() => null);
    if (!guild) return { success: false, error: "Guild not found" };

    const reason = params.reason || "Ban automatico Sentinel AI";
    const deleteMessageSeconds = (params.deleteMessageDays || 1) * 86400;
    await guild.bans.create(params.userId, { reason, deleteMessageSeconds });
    return { success: true, data: { userId: params.userId, reason } };
  }

  // 31. unban_user
  async unban_user(params, ctx) {
    const guild = this.client?.guilds?.cache?.get(ctx.guildId) || await this.client?.guilds?.fetch?.(ctx.guildId).catch(() => null);
    if (!guild) return { success: false, error: "Guild not found" };

    const reason = params.reason || "Revoca ban Sentinel AI";
    await guild.bans.remove(params.userId, reason);
    return { success: true, data: { userId: params.userId, reason } };
  }

  // 32. add_goal
  async add_goal(params, ctx) {
    const goal = defaultMemoryEngine.addGoal(ctx.guildId, {
      title: params.title,
      details: params.details || "",
      createdBy: params.createdBy || ctx.userId || "Sentinel"
    });
    return { success: true, data: goal };
  }

  // 33. get_goals
  async get_goals(params, ctx) {
    const goals = defaultMemoryEngine.getGoals(ctx.guildId, params.status || "all");
    return { success: true, data: goals };
  }

  // 34. complete_goal
  async complete_goal(params, ctx) {
    const goal = defaultMemoryEngine.completeGoal(ctx.guildId, params.titleOrId || params.title || params.id);
    if (!goal) return { success: false, error: "Goal not found" };
    return { success: true, data: goal };
  }

  // 35. remove_goal
  async remove_goal(params, ctx) {
    const removed = defaultMemoryEngine.removeGoal(ctx.guildId, params.titleOrId || params.title || params.id);
    if (!removed) return { success: false, error: "Goal not found" };
    return { success: true, data: removed };
  }

  // 36. add_learned_rule
  async add_learned_rule(params, ctx) {
    const rule = defaultMemoryEngine.addLearnedRule(ctx.guildId, {
      rule: params.rule,
      category: params.category || "GENERAL",
      author: params.author || ctx.userId || "Sentinel",
      source: params.source || "tool"
    });
    return { success: true, data: rule };
  }

  // 37. set_boost_mode
  async set_boost_mode(params, ctx) {
    const boost = defaultMemoryEngine.setBoostMode(ctx.guildId, {
      mode: params.mode || "deep_reasoning",
      setBy: params.setBy || ctx.userId || "Sentinel",
      durationMinutes: params.durationMinutes || 120
    });
    return { success: true, data: boost };
  }

  // 38. start_grill_session
  async start_grill_session(params, ctx) {
    const session = defaultMemoryEngine.startGrillSession(ctx.guildId, ctx.channelId, ctx.userId, {
      topic: params.topic || "Strategia e Operatività",
      initialQuestion: params.initialQuestion || null
    });
    return { success: true, data: session };
  }
}

const defaultToolEngine = new ToolEngine();
module.exports = {
  ToolEngine,
  defaultToolEngine
};
