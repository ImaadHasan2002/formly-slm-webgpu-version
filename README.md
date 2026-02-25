# Formly 

Formly is part of a project that includes a backend and a frontend. The frontend is a single-page application that includes the following pages:
- `Dashboard` (`/index.html`)
- `AI Form Builder` (`/builder.html`)
- `Analytics` (`/analytics.html`)

The builder dynamically generates interactive forms from prompts using a system-prompt-driven schema workflow and WebGPU-first Transformers.js inference.

## Run

```bash
cd /Users/imaadh/Downloads/formly-slm-webgpu-version
python main.py
```

Open:
- `http://127.0.0.1:8000/` (Dashboard)
- `http://127.0.0.1:8000/builder.html` (AI Builder)
- `http://127.0.0.1:8000/analytics.html` (Analytics)

## Architecture

### Pages
- `index.html`: Dashboard UI
- `builder.html`: AI form generation workspace + live preview
- `analytics.html`: Form performance and responses

### Shared CSS
- `assets/css/tokens.css`: design tokens (colors, radius, shadows)
- `assets/css/app.css`: shared layout and base components
- `assets/css/dashboard.css`: dashboard-only styles
- `assets/css/builder.css`: builder-only styles
- `assets/css/analytics.css`: analytics-only styles

### Shared JS Core
- `assets/js/core/config.js`: constants and default system prompt
- `assets/js/core/utils.js`: formatting and utility helpers
- `assets/js/core/storage.js`: local app state persistence and seeded data
- `assets/js/core/model-client.js`: Transformers.js runtime + JSON output parsing
- `assets/js/core/schema.js`: schema normalization and fallback generation
- `assets/js/core/form-renderer.js`: dynamic form preview rendering
- `assets/js/core/charts.js`: analytics line chart + device ring rendering

### Page Controllers
- `assets/js/pages/dashboard.js`
- `assets/js/pages/builder.js`
- `assets/js/pages/analytics.js`

## Notes

- WebGPU is used when available; otherwise WASM fallback is used.
- If model output is not valid JSON, Formly applies guided fallback schema generation to keep editing uninterrupted.

## Quick Resources

- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [Hugging Face Model Hub](https://huggingface.co/models?library=transformers.js)
- [Qwen2 Model Family](https://huggingface.co/Qwen)
- [Can I Use WebGPU](https://caniuse.com/webgpu)
