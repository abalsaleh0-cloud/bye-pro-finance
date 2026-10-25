# Free local financial assistant

The API route POST /api/v1/ai runs a built-in rule-based assistant using the authenticated user financial records. It does not call OpenAI, Gemini, Groq, or any external AI provider and requires no AI API key.

## Free mode

- No AI_API_KEY, OPENAI_API_KEY, AI_BASE_URL, or AI_MODEL is required.
- The assistant uses authenticated Supabase queries and preserves row-level security.
- It summarizes completed income and expenses separately by currency, highlights high spending relative to income, and lists active budgets.
- The assistant is read-only. Input is limited to 2,000 characters and each authenticated user is limited to 12 requests/minute (in-process, best-effort).
- The local assistant is rule-based, not a general-purpose large language model. It must not claim to answer questions beyond the financial data and rules it supports.

The service reads up to 200 transactions, 100 accounts, 100 budgets, and 500 categories. It sends no financial records to a third-party AI provider. All results are general information, not professional financial, investment, tax, or legal advice.
