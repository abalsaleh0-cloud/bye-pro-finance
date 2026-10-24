const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 60000);

async function runCycle() {
  console.log(`[worker] cycle started ${new Date().toISOString()}`);
  // Background jobs will be registered here: reminders, notifications, imports and AI/OCR jobs.
}

await runCycle();
setInterval(() => void runCycle(), intervalMs);
