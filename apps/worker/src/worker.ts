import { runJobs } from "./jobs/index.js";
import { processNotificationsBatch } from "./jobs/notifications.js";
import { startWorkerLoop, validateWorkerInterval } from "./scheduler.js";

const intervalMs = validateWorkerInterval(Number(process.env.WORKER_INTERVAL_MS ?? 60000));

async function processDueNotifications(): Promise<void> {
  const inserted = await processNotificationsBatch();
  console.info(JSON.stringify({
    event: "notification_batch_completed",
    inserted,
    timestamp: new Date().toISOString(),
  }));
}

async function runCycle(): Promise<void> {
  await runJobs([processDueNotifications]);
}

console.info("[worker] document processing is disabled until a durable document queue is configured");
const worker = startWorkerLoop(runCycle, intervalMs);

function shutdown(signal: string): void {
  console.log(`[worker] received ${signal}; stopping future cycles`);
  worker.stop();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
