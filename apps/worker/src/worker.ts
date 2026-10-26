import { runJobs } from "./jobs/index.js";
import { startWorkerLoop, validateWorkerInterval } from "./scheduler.js";

const intervalMs = validateWorkerInterval(Number(process.env.WORKER_INTERVAL_MS ?? 60000));

async function processDueNotifications(): Promise<void> {
  console.log(`[worker] notifications sweep ${new Date().toISOString()}`);
}

async function processDocumentJobs(): Promise<void> {
  console.log(`[worker] document queue sweep ${new Date().toISOString()}`);
}

async function runCycle(): Promise<void> {
  await runJobs([processDueNotifications, processDocumentJobs]);
}

const worker = startWorkerLoop(runCycle, intervalMs);

function shutdown(signal: string): void {
  console.log(`[worker] received ${signal}; stopping future cycles`);
  worker.stop();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
