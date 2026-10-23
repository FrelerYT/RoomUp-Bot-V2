const { readJsonSafe, writeJsonSafe } = require("./storage");
const { eventBus } = require("./eventBus");

let schedulerInterval = null;

function loadJobs() {
  return readJsonSafe("scheduler", []);
}

function saveJobs(jobs) {
  writeJsonSafe("scheduler", jobs);
}

function scheduleJob(type, executeAt, payload) {
  const jobs = loadJobs();
  const job = {
    id: "job_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    type,
    executeAt: typeof executeAt === "number" ? executeAt : new Date(executeAt).getTime(),
    payload,
    createdAt: Date.now()
  };
  jobs.push(job);
  saveJobs(jobs);
  return job;
}

function cancelJob(jobId) {
  const jobs = loadJobs();
  const filtered = jobs.filter(j => j.id !== jobId);
  saveJobs(filtered);
  return filtered.length !== jobs.length;
}

async function processScheduledJobs() {
  const now = Date.now();
  const jobs = loadJobs();
  const dueJobs = jobs.filter(j => j.executeAt <= now);

  if (dueJobs.length === 0) return;

  const remaining = jobs.filter(j => j.executeAt > now);
  saveJobs(remaining);

  for (const job of dueJobs) {
    try {
      await eventBus.emitAsync("scheduler.job", job);
      await eventBus.emitAsync(`scheduler.job.${job.type}`, job.payload);
    } catch (err) {
      console.error(`[Scheduler Error] Job ${job.id} (${job.type}) failed:`, err.message);
    }
  }
}

function initScheduler() {
  if (schedulerInterval) clearInterval(schedulerInterval);
  // Process immediately on boot to handle offline elapsed jobs
  processScheduledJobs();
  schedulerInterval = setInterval(processScheduledJobs, 5000);
  console.log("[Scheduler] ⏰ Scheduler centrale persistente attivo!");
}

module.exports = { initScheduler, scheduleJob, cancelJob, loadJobs };
