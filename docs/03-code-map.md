# 3. Code map

⬅️ [How AI generation works](02-how-generation-works.md) · Next ➡️ [Schema & data](04-schema-and-data.md)

---

## Folder layout

```
formly-slm-webgpu-version/
├── main.py                  # Local static file server (dev only)
├── index.html               # Dashboard page
├── builder.html             # AI Builder page
├── analytics.html           # Analytics page
└── assets/
    ├── css/
    │   ├── tokens.css       # Design tokens: colors, radius, shadows
    │   ├── app.css          # Shared layout + base components
    │   ├── dashboard.css    # Dashboard-only styles
    │   ├── builder.css      # Builder-only styles
    │   └── analytics.css    # Analytics-only styles
    └── js/
        ├── core/            # Shared logic (no page-specific DOM)
        │   ├── config.js
        │   ├── model-client.js
        │   ├── schema.js
        │   ├── form-renderer.js
        │   ├── storage.js
        │   ├── charts.js
        │   └── utils.js
        └── pages/           # One controller per HTML page
            ├── dashboard.js
            ├── builder.js
            └── analytics.js
```

**Rule of thumb:** `pages/` holds the *wiring* (buttons, events, DOM), while `core/` holds the *logic* (AI, schema, storage). It's like Python's split between a CLI entry point and the library it calls.

## What each core file does

| File | Size | Job | Main exports |
|---|---|---|---|
| `config.js` | ~60 lines | All constants in one place | `WEBLLM_MODELS`, `DEFAULT_MODEL`, `DEFAULT_SYSTEM_PROMPT`, `SUPPORTED_TYPES` |
| `model-client.js` | ~370 | Loads the AI runtime, runs generation, extracts and repairs JSON | `ModelClient`, `hasWebGPU`, `parseJsonFromText` |
| `schema.js` | ~625 | Cleans up model output; template-based fallback | `normalizePayload`, `normalizeSchema`, `heuristicPayload`, `createStarterSchema` |
| `form-renderer.js` | ~135 | Turns a schema into real HTML inputs | `renderFormPreview`, `renderSchemaJson` |
| `storage.js` | ~265 | Reads and writes localStorage; seeds demo data | `loadState`, `upsertForm`, `resolveActiveForm` |
| `charts.js` | ~70 | Hand-drawn SVG line chart + CSS device ring | `renderLineChart`, `applyDeviceRing` |
| `utils.js` | ~90 | Small helpers (formatting, slugify, ids, escaping) | `uid`, `slugify`, `nowIso`, `relativeAgo` |

## "I want to change X, where do I go?"

| I want to… | Edit |
|---|---|
| Add or remove a model from the dropdown | `WEBLLM_MODELS` in `core/config.js` (IDs must be [WebLLM prebuilt models](https://github.com/mlc-ai/web-llm)) |
| Change the default model / tokens / temperature | `DEFAULT_*` constants in `core/config.js` |
| Change how the AI is instructed | `DEFAULT_SYSTEM_PROMPT` in `core/config.js` |
| Add a new field type (e.g. `file`) | `SUPPORTED_TYPES` in `config.js` → `TYPE_ALIASES` in `schema.js` → `createFieldNode` in `form-renderer.js` → mention it in the system prompt |
| Improve auto-generated options (e.g. for "country") | `inferOptions` in `core/schema.js` |
| Add a new fallback template (e.g. "bug report") | `FORM_TEMPLATES` in `core/schema.js` |
| Fix JSON parsing for a new kind of bad output | `extractJsonCandidate` / `repairJson` in `core/model-client.js` |
| Change the seeded demo forms / responses | `createSeedForms` / `createSeedResponses` in `core/storage.js` |
| Change colors or theme | `assets/css/tokens.css` |
| Change Builder buttons or chat behaviour | `pages/builder.js` |

## How the pieces call each other (Builder)

```
builder.js
 ├─ ModelClient.generateSchema()          (model-client.js)
 │    ├─ runWebLLM()  or  runTransformers()
 │    └─ parseJsonFromText()
 ├─ normalizePayload() / heuristicPayload()  (schema.js)
 ├─ renderFormPreview() / renderSchemaJson() (form-renderer.js)
 └─ upsertForm() / setActiveFormId()         (storage.js)
```
