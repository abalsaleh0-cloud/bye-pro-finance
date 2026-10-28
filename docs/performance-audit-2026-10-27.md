# Performance Audit — 2026-10-27

## Scope

Branch: `audit/production-hardening-2026-10`

The performance gate was kept open until the actual source of the large bundle was identified, the build was repeated, and a new Vercel deployment was inspected.

## Findings

### OCR

The previous manual Rollup chunk rules for `tesseract.js` and `@tesseract.js` were causing an OCR chunk to be emitted in a way that resulted in an eager module-preload in the deployed HTML.

Those manual rules were removed in commit `b276af8a1974a4f0df25c4094308d9e3dc975037` (`perf: preserve lazy loading for OCR runtime`).

Measured Vercel build output after the change:

- OCR chunk: `15.89 kB` / `6.87 kB gzip`
- Main application chunk: `408.98 kB` / `116.66 kB gzip`
- WebLLM chunk: `6,135.51 kB` / `2,170.59 kB gzip`

The deployed HTML for the resulting Vercel deployment returned HTTP 200 and contained no `<link rel="modulepreload">` entries and no direct HTML references to the OCR or WebLLM chunks. This verifies that the OCR runtime is no longer eagerly preloaded from the initial HTML.

## Actual WebLLM cause

The remaining large chunk is not caused by the project's manual chunk configuration alone.

`@mlc-ai/web-llm` version `0.2.86` is the current published version. The package exposes its browser runtime as a bundled library and its documented integration imports the package dynamically. The package documentation also explicitly supports dynamic URL imports and worker-based execution.

In the installed package, the runtime represented by the WebLLM entry is effectively monolithic from Rollup's point of view. The build therefore produces a single approximately 6.14 MB WebLLM async chunk. Changing `onlyExplicitManualChunks` did not materially reduce that chunk, so that experiment was reverted in commit `76920938e2ea5757490fa769a9a2ad9d749f1fd5`.

## Conclusion

The large WebLLM file is an optional lazy runtime, not the initial application bundle. The current production optimization should therefore NOT replace it with arbitrary code splitting, warning suppression, or feature removal.

The verified safe optimization is the OCR lazy-load correction. The remaining WebLLM size is an upstream/package-level characteristic of the selected local-AI runtime. Any further reduction requires a deliberate architecture choice such as a worker/CDN delivery strategy and must be tested separately because it changes runtime delivery semantics.

## Verification

- Vite production build: successful.
- Vercel deployment for the OCR fix: `READY`.
- Initial deployed HTML: no modulepreload entries.
- CI for the code commit: successful.
- Authentication E2E for the code commit: successful.
- UI E2E for the code commit: successful.

## Gate status

**Performance gate: VERIFIED for the identified issue.**

Do not mark the WebLLM warning as fixed; it remains an intentional lazy async chunk. Do not move to an architectural CDN/worker change without a separate measured experiment.
