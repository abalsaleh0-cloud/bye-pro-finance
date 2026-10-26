import { describe, expect, it } from "vitest";
import { processDocumentQueue } from "./documentProcessor.js";

type Call = { url: string; init?: RequestInit };

function response(body: unknown, status = 200): Response {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("processDocumentQueue", () => {
  it("fails closed when worker credentials are missing", async () => {
    await expect(processDocumentQueue({})).rejects.toThrow(/requires SUPABASE_URL/);
  });

  it("claims, validates, records metadata, and completes a document job", async () => {
    const calls: Call[] = [];
    const job = {
      id: "job-1",
      document_id: "doc-1",
      user_id: "user-1",
      job_type: "extract_metadata",
      attempt_count: 1,
    };
    const document = {
      id: "doc-1",
      user_id: "user-1",
      file_name: "receipt.pdf",
      mime_type: "application/pdf",
      file_size: 1024,
      storage_path: "user-1/receipt.pdf",
      metadata: { source: "upload" },
    };

    const fetcher = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/rpc/requeue_expired_document_processing_jobs")) return response(0);
      if (url.includes("/rpc/claim_document_processing_jobs")) return response([job]);
      if (url.includes("/rest/v1/documents") && init?.method === undefined) return response([document]);
      if (url.includes("/rest/v1/documents") && init?.method === "PATCH") return response(null, 204);
      if (url.includes("/rpc/complete_document_processing_job")) return response(true);
      throw new Error(`Unexpected request: ${url}`);
    };

    await expect(processDocumentQueue({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
      WORKER_ID: "worker-test",
    }, fetcher)).resolves.toBe(1);

    const patch = calls.find((call) => call.init?.method === "PATCH");
    expect(patch).toBeDefined();
    expect(String(patch?.init?.body)).toContain("metadata_extracted");
    expect(String(patch?.init?.body)).toContain("receipt.pdf");

    const claim = calls.find((call) => call.url.includes("/rpc/claim_document_processing_jobs"));
    expect(String(claim?.init?.body)).toContain("worker-test");
  });

  it("fails permanently for an owner mismatch", async () => {
    const calls: Call[] = [];
    const fetcher = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/rpc/requeue_expired_document_processing_jobs")) return response(0);
      if (url.includes("/rpc/claim_document_processing_jobs")) return response([{
        id: "job-2",
        document_id: "doc-2",
        user_id: "user-1",
        job_type: "extract_metadata",
        attempt_count: 1,
      }]);
      if (url.includes("/rest/v1/documents")) return response([{
        id: "doc-2",
        user_id: "user-2",
        file_name: "receipt.pdf",
        mime_type: "application/pdf",
        file_size: 100,
        storage_path: "user-2/receipt.pdf",
        metadata: null,
      }]);
      if (url.includes("/rpc/fail_document_processing_job")) return response(true);
      throw new Error(`Unexpected request: ${url}`);
    };

    await expect(processDocumentQueue({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
      WORKER_ID: "worker-test",
    }, fetcher)).resolves.toBe(0);

    const failure = calls.find((call) => call.url.includes("/rpc/fail_document_processing_job"));
    expect(String(failure?.init?.body)).toContain("OWNER_MISMATCH");
    expect(String(failure?.init?.body)).toContain("false");
  });
});
