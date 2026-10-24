/**
 * SENTINEL AUTONOMOUS STAFF SYSTEM — UNIFIED SUITE ENTRY
 * 
 * Modular exports for all Sentinel autonomous systems:
 * - Core Pipeline
 * - Event Engine
 * - Context Engine
 * - Decision Engine
 * - Action Engine (Planner & Executor)
 * - Action Guard (10 Pre-flight Checks)
 * - Action Verifier (Post-flight Checks)
 * - Tool Engine (28+ Tools)
 * - Policy Engine
 * - Risk Engine
 * - Memory Engine (Multi-Tenant Isolated)
 * - Knowledge Engine (Versioned & Source-Aware)
 * - Learning Engine (Live Learning & Feedback)
 * - Ticket Engine (Full Lifecycle & Staff Takeover)
 * - Moderation Engine (Autonomous Multi-Factor)
 * - Vision Engine (OCR, UI Detection, Validation)
 * - Escalation Engine (Structured Handoff)
 * - Proactive Scheduler
 * - Audit Logger & Debug Mode
 * - Metrics & Health Collector
 * - Simulation Suite & Canary / Dry-Run
 * - AI Model Router (Gemini 3.6 Flash Multi-Key Rotation)
 */

const { SentinelCore, defaultSentinelCore } = require("./core/SentinelCore");
const { EventEngine, defaultEventEngine, EVENT_TYPES } = require("./event-engine/EventEngine");
const { ContextEngine, defaultContextEngine } = require("./context-engine/ContextEngine");
const { DecisionEngine, defaultDecisionEngine, DECISION_ACTIONS } = require("./decision-engine/DecisionEngine");
const { ActionPlanner, defaultActionPlanner } = require("./action-engine/ActionPlanner");
const { ActionExecutor, defaultActionExecutor } = require("./action-engine/ActionExecutor");
const { ActionGuard, defaultActionGuard } = require("./action-guard/ActionGuard");
const { ActionVerifier, defaultActionVerifier } = require("./action-verifier/ActionVerifier");
const { ToolEngine, defaultToolEngine } = require("./tool-engine/ToolEngine");
const { PolicyEngine, defaultPolicyEngine, AUTONOMY_LEVELS, CONTEXT_BOUNDARIES } = require("./policy-engine/PolicyEngine");
const { RiskEngine, defaultRiskEngine, RISK_LEVELS } = require("./risk-engine/RiskEngine");
const { MemoryEngine, defaultMemoryEngine } = require("./memory-engine/MemoryEngine");
const { KnowledgeEngine, defaultKnowledgeEngine, KNOWLEDGE_CATEGORIES } = require("./knowledge-engine/KnowledgeEngine");
const { LearningEngine, defaultLearningEngine, LEARNING_TYPES, APPROVAL_MODES, FEEDBACK_ACTIONS } = require("./learning-engine/LearningEngine");
const { SentinelTicketEngine, defaultSentinelTicketEngine, TICKET_CATEGORIES, TICKET_STATES, OPERATIONAL_MODES } = require("./ticket-engine/SentinelTicketEngine");
const { AutonomousModerationEngine, defaultAutonomousModerationEngine, MOD_VIOLATIONS } = require("./moderation-engine/AutonomousModerationEngine");
const { VisionEngine, defaultVisionEngine } = require("./vision-engine/VisionEngine");
const { EscalationEngine, defaultEscalationEngine } = require("./escalation-engine/EscalationEngine");
const { SentinelScheduler, defaultSentinelScheduler } = require("./scheduler/SentinelScheduler");
const { AuditLogger, defaultAuditLogger } = require("./audit/AuditLogger");
const { MetricsCollector, defaultMetricsCollector } = require("./metrics/MetricsCollector");
const { SimulationSuite, defaultSimulationSuite } = require("./simulation/SimulationSuite");
const { ModelRouter, defaultModelRouter, DEFAULT_MODELS } = require("./ai/ModelRouter");
const { TicketConcurrencyManager, defaultTicketConcurrencyManager } = require("./concurrency/TicketConcurrencyManager");
const { CommandIntentDetector, defaultCommandIntentDetector, INTENT_TYPES } = require("./ticket-engine/CommandIntentDetector");
const { StaffCandidateEngine, defaultStaffCandidateEngine, SS_FORENSICS_KNOWLEDGE, ROOMUP_SMP_KNOWLEDGE, DISCORD_MOD_KNOWLEDGE, EXAM_QUESTIONS } = require("./staff-engine/StaffCandidateEngine");

function initSentinel(client) {
  defaultSentinelCore.setDiscordClient(client);
  console.log("[Sentinel] 🛡️ Sentinel Autonomous Staff System fully initialized and bound to Discord Gateway!");
  return defaultSentinelCore;
}

module.exports = {
  initSentinel,
  SentinelCore,
  defaultSentinelCore,
  EventEngine,
  defaultEventEngine,
  EVENT_TYPES,
  ContextEngine,
  defaultContextEngine,
  DecisionEngine,
  defaultDecisionEngine,
  DECISION_ACTIONS,
  ActionPlanner,
  defaultActionPlanner,
  ActionExecutor,
  defaultActionExecutor,
  ActionGuard,
  defaultActionGuard,
  ActionVerifier,
  defaultActionVerifier,
  ToolEngine,
  defaultToolEngine,
  PolicyEngine,
  defaultPolicyEngine,
  AUTONOMY_LEVELS,
  CONTEXT_BOUNDARIES,
  RiskEngine,
  defaultRiskEngine,
  RISK_LEVELS,
  MemoryEngine,
  defaultMemoryEngine,
  KnowledgeEngine,
  defaultKnowledgeEngine,
  KNOWLEDGE_CATEGORIES,
  LearningEngine,
  defaultLearningEngine,
  LEARNING_TYPES,
  APPROVAL_MODES,
  FEEDBACK_ACTIONS,
  SentinelTicketEngine,
  defaultSentinelTicketEngine,
  TICKET_CATEGORIES,
  TICKET_STATES,
  OPERATIONAL_MODES,
  AutonomousModerationEngine,
  defaultAutonomousModerationEngine,
  MOD_VIOLATIONS,
  VisionEngine,
  defaultVisionEngine,
  EscalationEngine,
  defaultEscalationEngine,
  SentinelScheduler,
  defaultSentinelScheduler,
  AuditLogger,
  defaultAuditLogger,
  MetricsCollector,
  defaultMetricsCollector,
  SimulationSuite,
  defaultSimulationSuite,
  ModelRouter,
  defaultModelRouter,
  DEFAULT_MODELS,
  TicketConcurrencyManager,
  defaultTicketConcurrencyManager,
  CommandIntentDetector,
  defaultCommandIntentDetector,
  INTENT_TYPES,
  StaffCandidateEngine,
  defaultStaffCandidateEngine,
  SS_FORENSICS_KNOWLEDGE,
  ROOMUP_SMP_KNOWLEDGE,
  DISCORD_MOD_KNOWLEDGE,
  EXAM_QUESTIONS
};
