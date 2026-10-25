# Free local financial reasoning engine

The API route `POST /api/v1/ai` runs a deterministic, rule-based financial reasoning engine against the authenticated user's Supabase records. It does not call OpenAI, Gemini, Groq, or any external AI provider and requires no AI API key.

## Capabilities

- Intent routing for spending, income/cash-flow, budget, saving, category ranking, and help/capability questions in Arabic and English.
- Completed income and expense totals are kept separate by currency.
- Expense categories are ranked using recorded completed transactions, with amount and count per currency/category.
- Active budgets are summarized; saving suggestions are tied to the highest recorded spend category when available.
- Invalid or unavailable financial data returns a stable error instead of inventing a result.

## Free mode and limits

- No `AI_API_KEY`, `OPENAI_API_KEY`, `AI_BASE_URL`, or `AI_MODEL` is required.
- Queries use the authenticated user's Supabase client and preserve row-level security.
- The assistant is read-only. Input is limited to 2,000 characters and each authenticated user is limited to 12 requests/minute (in-process, best-effort).
- Reads up to 200 transactions, 100 accounts, 100 budgets, and 500 categories. Findings may not cover older records outside those limits.
- This is a local reasoning engine, not a general-purpose large language model. It must not pretend to understand arbitrary requests or claim abilities outside its implemented rules.
- Financial data is not sent to a third-party AI provider. Results are general information, not professional financial, investment, tax, or legal advice.

## Advanced model roadmap

A genuinely generative model would require either local inference on user-owned hardware or a hosted provider. Hosted providers can impose usage limits or fees, so this free-by-default implementation deliberately avoids external inference and secret keys. Do not add a paid provider or silently switch to one without explicit approval.