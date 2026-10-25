# Financial AI assistant

The API route `POST /api/v1/ai` uses an OpenAI-compatible Chat Completions endpoint. It reads financial context through the authenticated user's Supabase client, so row-level security remains in effect.

## Server environment

- `AI_API_KEY` (or `OPENAI_API_KEY`): secret provider key. Never expose this as a `VITE_*` variable.
- `AI_BASE_URL` (optional): HTTPS base URL, default `https://api.openai.com/v1`.
- `AI_MODEL` (optional): model name, default `gpt-4o-mini`.

The assistant is read-only. Input is limited to 2,000 characters, generated output to 700 tokens, provider timeout to 20 seconds, and an in-process per-user limit of 12 requests/minute. The in-process limiter is a best-effort safeguard only: before production, add a shared/distributed limiter if running multiple serverless instances. The service sends up to 200 recent transaction records and up to 100 account labels to the configured provider; do not use a provider without an acceptable data-processing/privacy policy.

If provider credentials are absent, the route returns `503 AI_PROVIDER_NOT_CONFIGURED` rather than fabricating an answer.
