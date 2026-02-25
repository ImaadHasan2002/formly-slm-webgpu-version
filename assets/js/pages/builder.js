import {
    DEFAULT_DTYPE,
    DEFAULT_MAX_NEW_TOKENS,
    DEFAULT_MODEL,
    DEFAULT_SUGGESTIONS,
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_TEMPERATURE,
    WASM_FALLBACK_MODEL,
    WEBLLM_MODELS,
} from '../core/config.js';
import { renderFormPreview, renderSchemaJson } from '../core/form-renderer.js';
import { ModelClient, hasWebGPU } from '../core/model-client.js';
import {
    createStarterSchema,
    deriveDefaultSuggestions,
    heuristicPayload,
    normalizePayload,
    normalizeSchema,
} from '../core/schema.js';
import {
    cloneState,
    loadState,
    resolveActiveForm,
    setActiveFormId,
    upsertForm,
} from '../core/storage.js';
import { nowIso, relativeAgo, uid } from '../core/utils.js';

const elements = {
    activeFormName: document.querySelector('#active-form-name'),
    activeFormStatus: document.querySelector('#active-form-status'),
    saveForm: document.querySelector('#save-form'),
    publishForm: document.querySelector('#publish-form'),
    chatFeed: document.querySelector('#chat-feed'),
    promptForm: document.querySelector('#prompt-form'),
    promptInput: document.querySelector('#prompt-input'),
    generateBtn: document.querySelector('#generate-btn'),
    resetBtn: document.querySelector('#reset-btn'),
    chips: document.querySelector('#chips'),
    modelId: document.querySelector('#model-id'),
    dtypeLabel: document.querySelector('#dtype-label'),
    dtype: document.querySelector('#dtype'),
    maxTokens: document.querySelector('#max-tokens'),
    temperature: document.querySelector('#temperature'),
    systemPrompt: document.querySelector('#system-prompt'),
    statusLine: document.querySelector('#status-line'),
    deviceChip: document.querySelector('#device-chip'),
    modelChip: document.querySelector('#model-chip'),
    progress: document.querySelector('#download-progress'),
    refreshPreview: document.querySelector('#refresh-preview'),
    previewTitle: document.querySelector('#preview-title'),
    previewDescription: document.querySelector('#preview-description'),
    previewForm: document.querySelector('#preview-form'),
    previewSubmit: document.querySelector('#preview-submit'),
    schemaJson: document.querySelector('#schema-json'),
};

const modelClient = new ModelClient();
let appState = loadState();
let activeForm = resolveActiveForm(appState);

let builderState = {
    schema: normalizeSchema(activeForm?.schema || createStarterSchema()),
    suggestions: [...DEFAULT_SUGGESTIONS],
    messages: [],
    busy: false,
};

const useWebGPU = hasWebGPU();

boot();

function boot() {
    populateModelDropdown();

    elements.maxTokens.value = String(DEFAULT_MAX_NEW_TOKENS);
    elements.temperature.value = String(DEFAULT_TEMPERATURE);
    elements.systemPrompt.value = DEFAULT_SYSTEM_PROMPT;

    if (!activeForm) {
        activeForm = createDraftForm();
        persistForm();
    }

    setDeviceChip();
    setModelChip('Model idle', true);

    pushMessage(
        'assistant',
        'Hello! I am ready to build your form. Describe the form you need and I will generate fields and options automatically.'
    );

    builderState.suggestions = deriveDefaultSuggestions(builderState.schema);
    renderAll();
    wireEvents();

    const promptFromQuery = new URLSearchParams(window.location.search).get('prompt');
    if (promptFromQuery) {
        startNewDraft();
        pushMessage('user', promptFromQuery);
        runPrompt(promptFromQuery);
    }
}

function populateModelDropdown() {
    elements.modelId.innerHTML = '';

    if (useWebGPU) {
        WEBLLM_MODELS.forEach((model) => {
            const opt = document.createElement('option');
            opt.value = model.id;
            opt.textContent = model.label;
            elements.modelId.appendChild(opt);
        });
        elements.modelId.value = DEFAULT_MODEL;
        elements.dtypeLabel.hidden = true;
    } else {
        const opt = document.createElement('option');
        opt.value = WASM_FALLBACK_MODEL;
        opt.textContent = 'Qwen 2.5 0.5B (WASM fallback)';
        elements.modelId.appendChild(opt);
        elements.modelId.value = WASM_FALLBACK_MODEL;

        elements.dtypeLabel.hidden = false;
        elements.dtype.value = DEFAULT_DTYPE;
    }
}

function wireEvents() {
    elements.promptForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const prompt = elements.promptInput.value.trim();
        if (!prompt || builderState.busy) return;
        pushMessage('user', prompt);
        elements.promptInput.value = '';
        await runPrompt(prompt);
    });

    elements.resetBtn.addEventListener('click', () => {
        if (builderState.busy) return;
        startNewDraft();
        pushMessage('assistant', 'Created a fresh draft. Describe what you want in this new form.');
        setStatus('Draft reset.');
        renderAll();
    });

    elements.chips.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-prompt]');
        if (!button || builderState.busy) return;
        const prompt = button.dataset.prompt.trim();
        pushMessage('user', prompt);
        await runPrompt(prompt);
    });

    elements.saveForm.addEventListener('click', () => {
        persistForm('draft');
        setStatus(`Saved draft ${relativeAgo(activeForm.updatedAt)}.`);
    });

    elements.publishForm.addEventListener('click', () => {
        persistForm('live');
        setStatus('Form published. Analytics has been updated.');
    });

    elements.previewSubmit.addEventListener('click', () => {
        pushMessage(
            'assistant',
            `Preview submit is enabled. This form currently has ${builderState.schema.fields.length} fields.`
        );
    });

    elements.refreshPreview.addEventListener('click', () => {
        renderPreview();
        setStatus('Preview refreshed.');
    });
}

function startNewDraft() {
    activeForm = createDraftForm();
    builderState.schema = normalizeSchema(activeForm.schema);
    builderState.suggestions = [...DEFAULT_SUGGESTIONS];
    builderState.messages = [];
    setActiveFormId(activeForm.id);
    persistForm('draft');
    renderHeader();
}

async function runPrompt(userPrompt) {
    setBusy(true);
    setStatus('Generating schema update...');

    const typingBubble = showTypingBubble();

    try {
        const { payload, device } = await modelClient.generateSchema({
            userPrompt,
            currentSchema: builderState.schema,
            systemPrompt: elements.systemPrompt.value,
            modelId: elements.modelId.value,
            dtype: elements.dtype?.value || DEFAULT_DTYPE,
            maxNewTokens: Number(elements.maxTokens.value || DEFAULT_MAX_NEW_TOKENS),
            temperature: Number(elements.temperature.value || DEFAULT_TEMPERATURE),
            onStatus: (text) => setStatus(text),
            onProgress: (value) => {
                elements.progress.hidden = false;
                elements.progress.value = value;
            },
            onToken: (_delta, full) => {
                updateTypingBubble(typingBubble, `Generating... ${full.length} chars`);
            },
        });

        removeTypingBubble(typingBubble);
        setModelChip(elements.modelId.value, false);
        applyPayload(payload, false);
        setStatus(`Form updated from model output on ${device}.`);
    } catch (error) {
        removeTypingBubble(typingBubble);
        const fallback = heuristicPayload(userPrompt, builderState.schema);
        applyPayload(fallback, true);
        setStatus(`Used fallback generation: ${error.message}`);
    } finally {
        elements.progress.hidden = true;
        elements.progress.value = 0;
        setBusy(false);
    }
}

function applyPayload(payload, fallbackMode) {
    const normalized = normalizePayload(payload);
    builderState.schema = normalized.schema;
    builderState.suggestions = normalized.suggestions.length
        ? normalized.suggestions
        : deriveDefaultSuggestions(normalized.schema);

    persistForm(activeForm.status || 'draft');
    pushMessage('assistant', normalized.assistantMessage);

    if (fallbackMode) {
        pushMessage('assistant', 'The model response format was invalid, so I repaired it and kept the form editable.');
    }

    renderAll();
}

function renderAll() {
    renderHeader();
    renderMessages();
    renderChips();
    renderPreview();
}

function renderHeader() {
    elements.activeFormName.textContent = activeForm.title;
    elements.activeFormStatus.textContent = activeForm.status === 'live' ? 'Active' : 'Draft';
    elements.activeFormStatus.className = `badge ${activeForm.status === 'live' ? 'success' : 'warning'}`;
}

function renderMessages() {
    elements.chatFeed.innerHTML = '';
    builderState.messages.forEach((message) => {
        const bubble = document.createElement('div');
        bubble.className = `msg ${message.role}`;
        bubble.textContent = message.content;

        const meta = document.createElement('span');
        meta.className = 'msg-meta';
        meta.textContent = message.time;

        bubble.appendChild(meta);
        elements.chatFeed.appendChild(bubble);
    });

    elements.chatFeed.scrollTop = elements.chatFeed.scrollHeight;
}

function renderChips() {
    elements.chips.innerHTML = '';
    builderState.suggestions.forEach((promptText) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip-btn';
        button.dataset.prompt = promptText;
        button.textContent = promptText;
        elements.chips.appendChild(button);
    });
}

function renderPreview() {
    renderFormPreview({
        schema: builderState.schema,
        root: elements.previewForm,
        titleEl: elements.previewTitle,
        descriptionEl: elements.previewDescription,
        submitEl: elements.previewSubmit,
    });

    renderSchemaJson(elements.schemaJson, builderState.schema);
}

function persistForm(status = activeForm.status || 'draft') {
    const merged = {
        ...activeForm,
        title: builderState.schema.title,
        description: builderState.schema.description,
        schema: builderState.schema,
        status,
        updatedAt: nowIso(),
        completionRate: activeForm.completionRate || 0,
        avgMinutes: activeForm.avgMinutes || 0,
        totalResponses: activeForm.totalResponses || 0,
    };

    activeForm = merged;
    setActiveFormId(activeForm.id);

    const nextState = cloneState(appState);
    upsertForm(nextState, activeForm);
    appState = nextState;
}

function pushMessage(role, content) {
    builderState.messages.push({
        role,
        content,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    });
    renderMessages();
}

function setBusy(isBusy) {
    builderState.busy = isBusy;
    elements.generateBtn.disabled = isBusy;
    elements.resetBtn.disabled = isBusy;
    elements.promptInput.disabled = isBusy;
    elements.modelId.disabled = isBusy;
    if (elements.dtype) elements.dtype.disabled = isBusy;
    elements.maxTokens.disabled = isBusy;
    elements.temperature.disabled = isBusy;
    elements.systemPrompt.disabled = isBusy;
    elements.generateBtn.textContent = isBusy ? 'Generating...' : 'Generate';
}

function setStatus(text) {
    elements.statusLine.textContent = text;
}

function setDeviceChip() {
    elements.deviceChip.textContent = useWebGPU
        ? 'Runtime: WebLLM (WebGPU)'
        : 'Runtime: Transformers.js (WASM)';
}

function setModelChip(text, muted) {
    elements.modelChip.textContent = text;
    elements.modelChip.classList.toggle('muted', muted);
}

function showTypingBubble() {
    const bubble = document.createElement('div');
    bubble.className = 'msg assistant typing';
    bubble.textContent = 'Thinking...';
    elements.chatFeed.appendChild(bubble);
    elements.chatFeed.scrollTop = elements.chatFeed.scrollHeight;
    return bubble;
}

function updateTypingBubble(bubble, text) {
    if (bubble?.parentNode) {
        bubble.textContent = text;
        elements.chatFeed.scrollTop = elements.chatFeed.scrollHeight;
    }
}

function removeTypingBubble(bubble) {
    bubble?.remove();
}

function createDraftForm() {
    return {
        id: uid('form'),
        title: 'Untitled Form',
        description: 'Use AI prompts to generate this form.',
        status: 'draft',
        updatedAt: nowIso(),
        totalResponses: 0,
        completionRate: 0,
        avgMinutes: 0,
        schema: createStarterSchema(),
    };
}
