# 5. FAQ & troubleshooting

⬅️ [Schema & data](04-schema-and-data.md) · 🏠 [README](../README.md)

---

## Quick fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Runtime chip says **"Transformers.js (WASM)"** | Your browser has no WebGPU | Use a recent Chrome or Edge. On Linux you may need to enable `chrome://flags/#enable-unsafe-webgpu`. Check [caniuse.com/webgpu](https://caniuse.com/webgpu). |
| First generation takes minutes | The model is downloading (0.5–1.5 GB) | Wait for the progress bar. Later runs use the browser cache. |
| *"Used fallback generation: …"* in the status line | The model failed to load or returned unusable JSON | Read the error text after the colon. Try a smaller temperature (0.3–0.5), a higher max tokens value, or the *Phi 3.5 Mini* model. |
| *"Failed to load WebLLM runtime from CDN"* | Offline, or the CDN is blocked | Check your network. Formly still works using template fallback. |
| Page is blank or modules fail to load | You opened the HTML via `file://` | Always serve it: `python main.py`. ES modules don't load from `file://`. |
| My forms disappeared | Different origin or cleared storage | Use the same URL (`127.0.0.1` ≠ `localhost`). See [where data lives](04-schema-and-data.md#where-data-lives-localstorage). |
| Form came out too short or generic | The fallback template was used, or the model is small | Write more specific prompts, e.g. *"add 3 questions about catering"*. Follow-up prompts edit the current form. |

## FAQ

**Does any data leave my machine?**
No. Only the model weights and libraries are *downloaded* (from Hugging Face / CDNs). Prompts and forms stay in your browser.

**Do I need to `pip install` anything?**
No. `main.py` uses only the Python standard library. `requirements.txt` is empty on purpose, because it exists for Netlify.

**How do I deploy it?**
Upload the folder to any static host (Netlify, GitHub Pages, Vercel, S3). There's no build step. `main.py` isn't needed in production.

**Why does it sometimes ignore my previous form and start fresh?**
This is fallback mode only. Prompts with *create / new / build / make / generate* reset the form, while other prompts add to it. When the model works, it decides based on the current schema it receives.

**Can I make the model behave differently without coding?**
Yes. Open the Builder settings and edit the **System prompt** text box. For example, you can add *"Always include a consent checkbox at the end."* The change lasts until the page reloads. To make it permanent, edit `DEFAULT_SYSTEM_PROMPT` in `assets/js/core/config.js`.

**Are the analytics real?**
Not yet. They are seeded sample data, and the trend badges are hard-coded. See [what's real vs. demo](01-overview.md#whats-real-vs-demo-data).
