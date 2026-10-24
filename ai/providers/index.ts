export type AiProvider = "openai" | "gemini" | "local";
export type AiProviderConfig = { provider: AiProvider; model: string };
