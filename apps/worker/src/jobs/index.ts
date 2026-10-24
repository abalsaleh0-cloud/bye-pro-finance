export type WorkerJob = () => Promise<void>;

export async function runJobs(jobs: WorkerJob[]): Promise<void> {
  for (const job of jobs) {
    try {
      await job();
    } catch (error) {
      console.error("[worker] job failed", error);
    }
  }
}
