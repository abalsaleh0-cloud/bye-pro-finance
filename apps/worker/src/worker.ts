import { runJobs } from "./jobs/index.js";

const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 60000);

async function processDueNotifications(): Promise<void> {
  console.log(`[worker] notifications sweep ${new Date().toISOString()}`);
}

async function processDocumentJobs(): Promise<void> {
  console.log(`[worker] document queue sweep ${new Date().toISOString()}`);
}

async function runCycle(): Promise<void> {
  await runJobs([processDueNotifications, processDocumentJobs]);
}

await runCycle();
setInterval(() => void runCycle(), intervalMs);
