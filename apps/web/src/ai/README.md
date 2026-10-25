# Browser-local generative model

The Financial Assistant offers two modes:

- **Basic assistant** (POST /api/v1/ai): deterministic financial calculations and rule-based intent routing on the app API. No AI provider key is needed.
- **On-device model** (askOnDevice): optional open-weight Qwen2.5-0.5B-Instruct model through @mlc-ai/web-llm 0.2.86 and WebGPU. Inference happens in the user's browser, not on Vercel.

## Privacy and data boundaries

- The browser builds a small, sanitized context: currency totals, record counts, a limited set of budget names/amounts, and at most 30 recent completed transaction dates/types/amounts/currencies.
- Transaction descriptions, account names, identifiers, credentials, and raw receipt contents are not included in the model prompt.
- The prompt/context are passed to the local WebLLM engine. They are not sent to a hosted inference API.
- Model files are downloaded on first use from the configured WebLLM model asset sources and cached by the browser. The download is large (hundreds of MB may be required); it is not a zero-data-download feature.
- Use requires a secure context and a browser/device with WebGPU. Unsupported devices can continue using the basic assistant.

## Limitations

- This is an opt-in experimental local model, not a claim of ChatGPT-level performance. The selected 0.5B model has limited capacity and may produce incorrect explanations.
- Financial calculations should be grounded in the app's deterministic summaries, not model-generated arithmetic. Treat output as educational guidance and verify any decision.
- The model cannot initiate transfers or write financial records.
- No paid inference service or API key is configured.

## Model source

Model catalog ID: Qwen2.5-0.5B-Instruct-q4f16_1-MLC, resolved through the WebLLM prebuilt model catalog. Check the model card and license before changing the selected model.
