/**
 * SENTINEL AI — MODEL ROUTER
 * 
 * - Multi-Key Rotation across GEMINI_KEY_1..20 and GEMINI_API_KEY
 * - Task Routing: FAST_MODEL, VISION_MODEL, REASONING_MODEL, EMERGENCY_MODEL
 * - Dynamic Quota & Rate-Limit recovery (HTTP 429, RESOURCE_EXHAUSTED)
 * - Anti-Hallucination output parser & JSON sanitization
 * - Fallback cascade to ensure zero crashes
 */

require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const DEFAULT_MODELS = {
  FAST_MODEL: "gemini-3.6-flash",
  VISION_MODEL: "gemini-3.6-flash",
  REASONING_MODEL: "gemini-3.6-flash",
  EMERGENCY_MODEL: "gemini-3.6-flash"
};

class ModelRouter {
  constructor() {
    this.keys = [];
    this.currentKeyIdx = 0;
    this.genAiInstances = [];
    this.keyQuotaCooldowns = new Map(); // keyIndex -> cooldownUntil timestamp
    this.initialized = false;
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      rotatedCount: 0,
      fallbackCalls: 0,
      errors: 0
    };
    this.initKeys();
  }

  initKeys() {
    const keys = [];
    for (let i = 1; i <= 20; i++) {
      const k = process.env[`GEMINI_KEY_${i}`];
      if (k && k.trim()) keys.push(k.trim());
    }
    if (keys.length === 0 && process.env.GEMINI_API_KEY) {
      keys.push(process.env.GEMINI_API_KEY.trim());
    }

    this.keys = keys;
    this.genAiInstances = keys.map(k => new GoogleGenerativeAI(k));
    this.initialized = keys.length > 0;
    if (this.initialized) {
      console.log(`[Sentinel:ModelRouter] Initialized with ${keys.length} API keys and task routing.`);
    } else {
      console.warn(`[Sentinel:ModelRouter] No Gemini API keys found in environment.`);
    }
  }

  getAvailableKeyIndex() {
    if (this.keys.length === 0) return -1;
    const now = Date.now();
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentKeyIdx + i) % this.keys.length;
      const cooldown = this.keyQuotaCooldowns.get(idx) || 0;
      if (now >= cooldown) {
        this.currentKeyIdx = idx;
        return idx;
      }
    }
    // If all are in cooldown, pick the one with the earliest cooldown expiry
    let earliestIdx = 0;
    let earliestTime = Infinity;
    for (let i = 0; i < this.keys.length; i++) {
      const t = this.keyQuotaCooldowns.get(i) || 0;
      if (t < earliestTime) {
        earliestTime = t;
        earliestIdx = i;
      }
    }
    this.currentKeyIdx = earliestIdx;
    return earliestIdx;
  }

  markKeyQuotaExhausted(idx, cooldownMs = 20000) {
    const until = Date.now() + cooldownMs;
    this.keyQuotaCooldowns.set(idx, until);
    this.stats.rotatedCount++;
    console.warn(`[Sentinel:ModelRouter] Key index ${idx + 1} quota reached. Cooling down for ${cooldownMs / 1000}s.`);
    this.currentKeyIdx = (this.currentKeyIdx + 1) % (this.keys.length || 1);
  }

  getModelInstance(keyIdx, modelName) {
    if (!this.genAiInstances[keyIdx]) return null;
    return this.genAiInstances[keyIdx].getGenerativeModel({ model: modelName });
  }

  resolveModelName(task = "FAST_MODEL", guildConfig = {}) {
    if (guildConfig?.ai?.model) return guildConfig.ai.model;
    return DEFAULT_MODELS[task] || DEFAULT_MODELS.FAST_MODEL;
  }

  /**
   * Main completion call with multi-key rotation and model fallback
   */
  async generateText({ prompt, task = "FAST_MODEL", guildConfig = {}, systemInstruction = null, temperature = 0.3 }) {
    this.stats.totalCalls++;
    if (!this.initialized || this.keys.length === 0) {
      return { success: false, text: null, error: "No Gemini keys configured", model: null, keyIndex: -1 };
    }

    const primaryModelName = this.resolveModelName(task, guildConfig);
    const candidateModels = [primaryModelName];
    if (primaryModelName !== DEFAULT_MODELS.EMERGENCY_MODEL) {
      candidateModels.push(DEFAULT_MODELS.EMERGENCY_MODEL);
    }

    let lastError = null;
    const maxAttempts = Math.min(this.keys.length * 2, 8);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const keyIdx = this.getAvailableKeyIndex();
      if (keyIdx === -1) break;

      const modelName = candidateModels[attempt >= this.keys.length ? 1 : 0] || primaryModelName;

      try {
        const model = this.getModelInstance(keyIdx, modelName);
        if (!model) throw new Error("Could not instantiate model");

        const contents = [];
        if (systemInstruction) {
          contents.push({ role: "user", parts: [{ text: `SYSTEM DIRECTIVE (HIGH PRIORITY):\n${systemInstruction}\n---\nTASK:\n${prompt}` }] });
        } else {
          contents.push({ role: "user", parts: [{ text: prompt }] });
        }

        const result = await model.generateContent({
          contents,
          generationConfig: {
            temperature: typeof temperature === "number" ? temperature : 0.3,
            maxOutputTokens: guildConfig?.ai?.maxTokens || 1200
          }
        });

        const text = result?.response?.text()?.trim() || "";
        this.stats.successfulCalls++;
        return {
          success: true,
          text,
          model: modelName,
          keyIndex: keyIdx,
          durationMs: 0
        };
      } catch (err) {
        lastError = err;
        const msg = (err.message || "").toLowerCase();
        const isQuota = (err.status === 429) || msg.includes("quota") || msg.includes("resource_exhausted") || msg.includes("rate limit");
        if (isQuota) {
          let retryMs = 20000;
          const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)s/i) || msg.match(/retrydelay["':\s]+(\d+)s/i);
          if (retryMatch) {
            retryMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000;
          }
          this.markKeyQuotaExhausted(keyIdx, retryMs);
        } else if (msg.includes("not found") || msg.includes("unsupported")) {
          // If model name is unrecognized, fallback immediately
          console.warn(`[Sentinel:ModelRouter] Model ${modelName} unsupported, falling back to ${DEFAULT_MODELS.EMERGENCY_MODEL}`);
          candidateModels[0] = DEFAULT_MODELS.EMERGENCY_MODEL;
          this.currentKeyIdx = (keyIdx + 1) % (this.keys.length || 1);
        } else {
          // Server error (503 High Demand, 500, ETIMEDOUT, etc.) - rotate key with temporary 15s cooldown
          console.warn(`[Sentinel:ModelRouter] Key ${keyIdx + 1} temporary error (${err.status || err.message}). Rotating to next key.`);
          this.keyQuotaCooldowns.set(keyIdx, Date.now() + 15000);
          this.currentKeyIdx = (keyIdx + 1) % (this.keys.length || 1);
          this.stats.rotatedCount++;
        }
      }
    }

    this.stats.errors++;
    return {
      success: false,
      text: null,
      error: lastError ? lastError.message : "All Gemini keys exhausted",
      model: primaryModelName,
      keyIndex: this.currentKeyIdx
    };
  }

  /**
   * Multimodal vision analysis with image buffer / inline data and multi-key fallback
   */
  async generateVision({ prompt, imageBuffer, mimeType = "image/png", guildConfig = {} }) {
    this.stats.totalCalls++;
    if (!this.initialized || this.keys.length === 0) {
      return { success: false, text: null, error: "No Gemini keys configured" };
    }

    const primaryModelName = this.resolveModelName("VISION_MODEL", guildConfig);
    const candidateModels = [primaryModelName];
    if (primaryModelName !== DEFAULT_MODELS.EMERGENCY_MODEL) {
      candidateModels.push(DEFAULT_MODELS.EMERGENCY_MODEL);
    }

    let lastError = null;
    const maxAttempts = Math.min(this.keys.length * 2, 6);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const keyIdx = this.getAvailableKeyIndex();
      if (keyIdx === -1) break;

      const modelName = candidateModels[attempt >= this.keys.length ? 1 : 0] || primaryModelName;

      try {
        const model = this.getModelInstance(keyIdx, modelName);
        if (!model) throw new Error("Could not instantiate vision model");

        const imagePart = {
          inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType
          }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const text = result?.response?.text()?.trim() || "";
        this.stats.successfulCalls++;
        return {
          success: true,
          text,
          model: modelName,
          keyIndex: keyIdx
        };
      } catch (err) {
        lastError = err;
        this.stats.errors++;
        const msg = (err.message || "").toLowerCase();
        const isQuota = (err.status === 429) || msg.includes("quota") || msg.includes("resource_exhausted");
        if (isQuota) {
          this.markKeyQuotaExhausted(keyIdx);
        } else {
          console.warn(`[Sentinel:ModelRouter] Vision error on key ${keyIdx + 1} (${err.status || err.message}). Rotating key.`);
          this.keyQuotaCooldowns.set(keyIdx, Date.now() + 15000);
          this.currentKeyIdx = (keyIdx + 1) % (this.keys.length || 1);
          this.stats.rotatedCount++;
        }
      }
    }

    return {
      success: false,
      text: null,
      error: lastError ? lastError.message : "Vision keys exhausted"
    };
  }

  /**
   * Robust JSON extraction with cleaning of Markdown code fences
   */
  extractJson(text) {
    if (!text || typeof text !== "string") return null;
    let cleaned = text.trim();

    // Strip code block fences ```json ... ``` or ``` ... ```
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // Attempt substring extraction between first { and last }
      const firstOpen = cleaned.indexOf("{");
      const lastClose = cleaned.lastIndexOf("}");
      if (firstOpen !== -1 && lastClose > firstOpen) {
        try {
          const slice = cleaned.slice(firstOpen, lastClose + 1);
          return JSON.parse(slice);
        } catch (e2) {}
      }
    }
    return null;
  }

  getStats() {
    return {
      ...this.stats,
      totalKeys: this.keys.length,
      currentKeyIndex: this.currentKeyIdx,
      activeKeysCount: this.keys.length - this.keyQuotaCooldowns.size
    };
  }
}

const defaultModelRouter = new ModelRouter();
module.exports = {
  ModelRouter,
  defaultModelRouter,
  DEFAULT_MODELS
};
