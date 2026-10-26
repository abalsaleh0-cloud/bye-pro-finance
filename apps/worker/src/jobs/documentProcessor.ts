export type DocumentWorkerEnvironment = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  WORKER_ID?: string;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type QueueJob = {
  id: string;
  document_id: string;
  user_id: string;
  job_type: string;
  attempt_count: number;
};

type DocumentRecord = {
  id: string;
  user_id: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  metadata: Record<string, unknown> | null;
};

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const CLAIM_LIMIT = 10;
const LEASE_SECONDS = 300;

function requireEnvironment(env: DocumentWorkerEnvironment): { baseUrl: string; serviceKey: string; workerId: string } {
  const baseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const workerId = env.WORKER_ID?.trim() || `document-worker-${process.pid}-${crypto.randomUUID()}`;

  if (!baseUrl || !serviceKey) {
    throw new Error("Document worker requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("Document worker requires an HTTPS Supabase URL");
  }

  return { baseUrl, serviceKey, workerId };
}

async function rpc<T>(
  baseUrl: string,
  serviceKey: string,
  name: string,
  body: Record<string, unknown>,
  fetcher: FetchLike,
): Promise<T> {
  const response = await fetcher(new URL(`/rest/v1/rpc/${name}`, baseUrl), {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Document queue RPC ${name} failed with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function getDocument(
  baseUrl: string,
  serviceKey: string,
  documentId: string,
  fetcher: FetchLike,
): Promise<DocumentRecord | null> {
  const url = new URL("/rest/v1/documents", baseUrl);
  url.searchParams.set("id", `eq.${documentId}`);
  url.searchParams.set("select", "id,user_id,file_name,mime_type,file_size,storage_path,metadata");
  url.searchParams.set("limit", "1");

  const response = await fetcher(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Document lookup failed with HTTP ${response.status}`);
  }

  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0];
  if (!row || typeof row !== "object") throw new Error("Document lookup returned invalid data");
  return row as DocumentRecord;
}

async function updateMetadata(
  baseUrl: string,
  serviceKey: string,
  documentId: string,
  metadata: Record<string, unknown>,
  fetcher: FetchLike,
): Promise<void> {
  const url = new URL("/rest/v1/documents", baseUrl);
  url.searchParams.set("id", `eq.${documentId}`);
  const response = await fetcher(url, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ metadata }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Document metadata update failed with HTTP ${response.status}`);
  }
}

async function failJob(
  baseUrl: string,
  serviceKey: string,
  job: QueueJob,
  code: string,
  message: string,
  retry: boolean,
  fetcher: FetchLike,
): Promise<void> {
  await rpc<boolean>(baseUrl, serviceKey, "fail_document_processing_job", {
    p_job_id: job.id,
    p_worker_id: process.env.WORKER_ID?.trim() || "",
    p_error_code: code.slice(0, 100),
    p_error_message: message.slice(0, 1000),
    p_retry: retry,
  }, fetcher);
}

async function processJob(
  baseUrl: string,
  serviceKey: string,
  workerId: string,
  job: QueueJob,
  fetcher: FetchLike,
): Promise<void> {
  const document = await getDocument(baseUrl, serviceKey, job.document_id, fetcher);

  if (!document) {
    await rpc<boolean>(baseUrl, serviceKey, "fail_document_processing_job", {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_error_code: "DOCUMENT_NOT_FOUND",
      p_error_message: "The queued document row no longer exists",
      p_retry: false,
    }, fetcher);
    return;
  }

  if (document.user_id !== job.user_id) {
    await rpc<boolean>(baseUrl, serviceKey, "fail_document_processing_job", {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_error_code: "OWNER_MISMATCH",
      p_error_message: "Queued job owner does not match document owner",
      p_retry: false,
    }, fetcher);
    return;
  }

  if (!document.file_name || !document.mime_type || !document.storage_path) {
    await rpc<boolean>(baseUrl, serviceKey, "fail_document_processing_job", {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_error_code: "INVALID_DOCUMENT_METADATA",
      p_error_message: "Document is missing required file metadata",
      p_retry: false,
    }, fetcher);
    return;
  }

  if (document.file_size == null || !Number.isSafeInteger(document.file_size) || document.file_size < 0 || document.file_size > MAX_DOCUMENT_BYTES) {
    await rpc<boolean>(baseUrl, serviceKey, "fail_document_processing_job", {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_error_code: "DOCUMENT_SIZE_INVALID",
      p_error_message: "Document size is outside the supported 20 MiB limit",
      p_retry: false,
    }, fetcher);
    return;
  }

  const existingMetadata = document.metadata && typeof document.metadata === "object" ? document.metadata : {};
  await updateMetadata(baseUrl, serviceKey, document.id, {
    ...existingMetadata,
    processing: {
      status: "metadata_extracted",
      job_type: job.job_type,
      attempt: job.attempt_count,
      processed_at: new Date().toISOString(),
      file: {
        name: document.file_name,
        mime_type: document.mime_type,
        size_bytes: document.file_size,
        storage_path: document.storage_path,
      },
    },
  }, fetcher);

  const completed = await rpc<boolean>(baseUrl, serviceKey, "complete_document_processing_job", {
    p_job_id: job.id,
    p_worker_id: workerId,
  }, fetcher);

  if (completed !== true) {
    throw new Error("Document queue completion was not acknowledged");
  }
}

export async function processDocumentQueue(
  env: DocumentWorkerEnvironment = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    WORKER_ID: process.env.WORKER_ID,
  },
  fetcher: FetchLike = fetch,
): Promise<number> {
  const { baseUrl, serviceKey, workerId } = requireEnvironment(env);

  await rpc<number>(baseUrl, serviceKey, "requeue_expired_document_processing_jobs", {
    p_limit: 100,
  }, fetcher);

  const jobs = await rpc<QueueJob[]>(baseUrl, serviceKey, "claim_document_processing_jobs", {
    p_worker_id: workerId,
    p_limit: CLAIM_LIMIT,
    p_lease_seconds: LEASE_SECONDS,
  }, fetcher);

  if (!Array.isArray(jobs)) {
    throw new Error("Document queue claim returned invalid data");
  }

  let completed = 0;
  for (const job of jobs) {
    try {
      await processJob(baseUrl, serviceKey, workerId, job, fetcher);
      completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Document processing failed";
      try {
        await rpc<boolean>(baseUrl, serviceKey, "fail_document_processing_job", {
          p_job_id: job.id,
          p_worker_id: workerId,
          p_error_code: "PROCESSING_FAILED",
          p_error_message: message,
          p_retry: true,
        }, fetcher);
      } catch {
        console.error("[worker] failed to record document processing failure", { jobId: job.id });
      }
      console.error("[worker] document processing failed", { jobId: job.id, error: message });
    }
  }

  return completed;
}
