export type AiTask = "assistant" | "financial-insights" | "document-extraction";

export type AiRequest = { task: AiTask; input: string };

export function validateAiRequest(request: AiRequest): AiRequest {
  if (!request.input.trim()) throw new Error("AI input is required");
  return request;
}
