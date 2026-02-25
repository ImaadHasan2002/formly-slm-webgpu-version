import {
    DEFAULT_DTYPE,
    DEFAULT_MAX_NEW_TOKENS,
    DEFAULT_MODEL,
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_TEMPERATURE,
    WASM_FALLBACK_MODEL,
} from './config.js';
import { clamp } from './utils.js';

export function hasWebGPU() {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export class ModelClient {
    constructor() {
        this.webllmEngine = null;
        this.webllmModelId = '';

        this.tjsPipelineFn = null;
        this.tjsEnv = null;
        this.tjsGenerator = null;
        this.tjsModelId = '';
        this.tjsDtype = '';
    }

    async generateSchema({
        userPrompt,
        currentSchema,
        systemPrompt = DEFAULT_SYSTEM_PROMPT,
        modelId = DEFAULT_MODEL,
        dtype = DEFAULT_DTYPE,
        maxNewTokens = DEFAULT_MAX_NEW_TOKENS,
        temperature = DEFAULT_TEMPERATURE,
        onStatus,
        onProgress,
        onToken,
    }) {
        const messages = composeMessages({ userPrompt, currentSchema, systemPrompt });

        if (hasWebGPU()) {
            return this.runWebLLM({
                messages, modelId, maxNewTokens, temperature,
                onStatus, onProgress, onToken,
            });
        }

        return this.runTransformers({
            messages,
            modelId: WASM_FALLBACK_MODEL,
            dtype,
            maxNewTokens,
            temperature,
            onStatus,
            onProgress,
        });
    }

    async runWebLLM({
        messages, modelId, maxNewTokens, temperature,
        onStatus, onProgress, onToken,
    }) {
        const engine = await this.ensureWebLLM({ modelId, onStatus, onProgress });

        onStatus?.('Running generation on WebGPU...');

        const response = await engine.chat.completions.create({
            messages,
            temperature: Number(temperature || DEFAULT_TEMPERATURE),
            max_tokens: Number(maxNewTokens || DEFAULT_MAX_NEW_TOKENS),
            stream: true,
        });

        let text = '';
        for await (const chunk of response) {
            const delta = chunk.choices?.[0]?.delta?.content ?? '';
            text += delta;
            onToken?.(delta, text);
        }

        const json = parseJsonFromText(text);
        return { payload: json, device: 'webgpu' };
    }

    async runTransformers({
        messages, modelId, dtype, maxNewTokens, temperature,
        onStatus, onProgress,
    }) {
        const generator = await this.ensureTransformers({
            modelId, dtype, onStatus, onProgress,
        });

        onStatus?.('Running generation on WASM (no WebGPU)...');

        const result = await generator(messages, {
            max_new_tokens: Number(maxNewTokens || DEFAULT_MAX_NEW_TOKENS),
            temperature: Number(temperature || DEFAULT_TEMPERATURE),
            do_sample: Number(temperature || DEFAULT_TEMPERATURE) > 0,
            top_p: 0.92,
            repetition_penalty: 1.08,
            return_full_text: false,
        });

        const text = extractGeneratedText(result);
        const json = parseJsonFromText(text);
        return { payload: json, device: 'wasm' };
    }

    async ensureWebLLM({ modelId, onStatus, onProgress }) {
        if (this.webllmEngine && this.webllmModelId === modelId) {
            return this.webllmEngine;
        }

        onStatus?.(`Loading ${modelId} via WebLLM...`);

        const webllm = await loadWebLLM();

        this.webllmEngine = await webllm.CreateMLCEngine(modelId, {
            initProgressCallback: (info) => {
                if (info?.text) onStatus?.(info.text);
                if (typeof info?.progress === 'number') {
                    const pct = info.progress <= 1
                        ? info.progress * 100
                        : info.progress;
                    onProgress?.(clamp(pct, 0, 100));
                }
            },
        });

        this.webllmModelId = modelId;
        onStatus?.('Model ready.');
        return this.webllmEngine;
    }

    async ensureTransformers({ modelId, dtype, onStatus, onProgress }) {
        if (!this.tjsPipelineFn) {
            onStatus?.('Loading Transformers.js runtime...');
            const transformers = await loadTransformers();
            this.tjsPipelineFn = transformers.pipeline;
            this.tjsEnv = transformers.env;

            if (this.tjsEnv && 'allowLocalModels' in this.tjsEnv) {
                this.tjsEnv.allowLocalModels = false;
            }
        }

        const cached =
            this.tjsGenerator &&
            this.tjsModelId === modelId &&
            this.tjsDtype === dtype;

        if (cached) return this.tjsGenerator;

        onStatus?.(`Loading ${modelId} (${dtype}) on WASM...`);

        this.tjsGenerator = await this.tjsPipelineFn('text-generation', modelId, {
            device: 'wasm',
            dtype,
            progress_callback: (info) => {
                if (info?.status) onStatus?.(`Loading model: ${info.status}`);
                if (typeof info?.progress === 'number') {
                    const pct = info.progress <= 1
                        ? info.progress * 100
                        : info.progress;
                    onProgress?.(clamp(pct, 0, 100));
                }
            },
        });

        this.tjsModelId = modelId;
        this.tjsDtype = dtype;
        onStatus?.('Model ready.');
        return this.tjsGenerator;
    }
}

function composeMessages({ userPrompt, currentSchema, systemPrompt }) {
    const userContent = [
        'User request: ' + userPrompt,
        '',
        'Current schema:',
        JSON.stringify(currentSchema, null, 2),
    ].join('\n');

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
    ];
}

async function loadWebLLM() {
    const url = 'https://esm.run/@mlc-ai/web-llm';
    try {
        const mod = await import(/* webpackIgnore: true */ url);
        if (typeof mod.CreateMLCEngine === 'function') return mod;
    } catch { /* fall through */ }
    throw new Error('Failed to load WebLLM runtime from CDN.');
}

export async function loadTransformers() {
    const candidates = [
        'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/+esm',
        'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm',
    ];

    let lastError = null;
    for (const url of candidates) {
        try {
            const mod = await import(/* webpackIgnore: true */ url);
            if (typeof mod.pipeline === 'function') return mod;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Unable to load Transformers.js runtime.');
}

// ---------------------------------------------------------------------------
// JSON extraction & repair (handles common SLM output issues)
// ---------------------------------------------------------------------------

export function parseJsonFromText(text) {
    const candidate = extractJsonCandidate(text);

    const attempts = [candidate, repairJson(candidate)];
    for (const attempt of attempts) {
        try {
            return JSON.parse(attempt);
        } catch {
            /* try next */
        }
    }

    throw new Error('Model output is not valid JSON.');
}

function extractJsonCandidate(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
        throw new Error('Model returned an empty response.');
    }

    const fencedMatches = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    if (fencedMatches.length > 0) {
        return fencedMatches[fencedMatches.length - 1][1].trim();
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return trimmed;
    }

    const objects = extractJsonObjects(trimmed);
    if (objects.length > 0) {
        return objects[objects.length - 1];
    }

    const braceStart = trimmed.indexOf('{');
    if (braceStart >= 0) {
        return closeOpenJson(trimmed.slice(braceStart));
    }

    throw new Error('No JSON object found in model output.');
}

function closeOpenJson(text) {
    let depth = 0;
    let bracketDepth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') { inString = true; continue; }
        if (ch === '{') depth++;
        if (ch === '}') depth--;
        if (ch === '[') bracketDepth++;
        if (ch === ']') bracketDepth--;
    }

    let result = text;
    while (bracketDepth > 0) { result += ']'; bracketDepth--; }
    while (depth > 0) { result += '}'; depth--; }
    return result;
}

function repairJson(text) {
    let s = text;
    s = s.replace(/,\s*([\]}])/g, '$1');
    s = s.replace(/'/g, '"');
    s = s.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
    // eslint-disable-next-line no-control-regex
    s = s.replace(/[\x00-\x1f]/g, (ch) => {
        if (ch === '\n' || ch === '\r' || ch === '\t') return ch;
        return '';
    });
    return closeOpenJson(s);
}

function extractJsonObjects(text) {
    const objects = [];
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inString) {
            if (escaped) { escaped = false; continue; }
            if (char === '\\') { escaped = true; continue; }
            if (char === '"') inString = false;
            continue;
        }

        if (char === '"') { inString = true; continue; }

        if (char === '{') {
            if (depth === 0) start = i;
            depth++;
            continue;
        }

        if (char === '}') {
            if (depth > 0) {
                depth--;
                if (depth === 0 && start >= 0) {
                    objects.push(text.slice(start, i + 1));
                    start = -1;
                }
            }
        }
    }

    return objects;
}

function extractGeneratedText(result) {
    if (Array.isArray(result) && result.length > 0) {
        const first = result[0];

        if (Array.isArray(first?.generated_text)) {
            const turn = first.generated_text.findLast(
                (msg) => msg.role === 'assistant'
            );
            if (turn?.content) return turn.content;
        }

        if (typeof first?.generated_text === 'string') return first.generated_text;
        if (typeof first?.text === 'string') return first.text;
    }

    if (Array.isArray(result?.generated_text)) {
        const turn = result.generated_text.findLast(
            (msg) => msg.role === 'assistant'
        );
        if (turn?.content) return turn.content;
    }

    if (typeof result?.generated_text === 'string') return result.generated_text;
    if (typeof result === 'string') return result;

    return '';
}
