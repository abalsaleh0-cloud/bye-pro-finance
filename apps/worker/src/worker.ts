import { runJobs } from "./jobs/index.js";
import { processDocumentQueue } from "./jobs/documentProcessor.js";
import { processNotificationsBatch } from "./jobs/notifications.js";
import { startWorkerLoop, validateWorkerInterval } from "./scheduler.js";

const intervalMs = validateWorkerInterval(Number(process.env.WORKER_INTERVAL_MS ?? 60000));
const workerId = process.env.WORKER_ID?.trim() || `worker-${process.pid}-${crypto.randomUUID()}`;

async function processDueNotifications(): Promise<void> {
  const inserted = await processNotificationsBatch();
  console.info(JSON.stringify({
    event: "notification_batch_completed",
    inserted,
    timestamp: new Date().toISOString(),
  }));
}

async function processDocuments(): Promise<void> {
  const completed = await processDocumentQueue({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    WORKER_ID: workerId,
  });
  console.info(JSON.stringify({
    event: "document_processing_batch_completed",
    completed,
    timestamp: new Date().toISOString(),
  }));
}

async function runCycle(): Promise<void> {
  await runJobs([processDueNotifications, processDocuments]);
}

console.info(JSON.stringify({ event: "worker_started", workerId }));
const worker = startWorkerLoop(runCycle, intervalMs);

function shutdown(signal: string): void {
  console.log(`[worker] received ${signal}; stopping future cycles`);
  worker.stop();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
