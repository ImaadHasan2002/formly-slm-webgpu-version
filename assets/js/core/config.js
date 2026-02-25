export const STORAGE_KEY = 'formly_prod_state_v1';
export const ACTIVE_FORM_KEY = 'formly_active_form_id';

export const WEBLLM_MODELS = [
    { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 1.5B (default)' },
    { id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', label: 'Llama 3.2 1B (fast)' },
    { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Phi 3.5 Mini (best JSON)' },
    { id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC', label: 'SmolLM2 1.7B' },
    { id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Gemma 2 2B' },
    { id: 'TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC', label: 'TinyLlama 1.1B (smallest)' },
    { id: 'stablelm-2-zephyr-1_6b-q4f16_1-MLC', label: 'StableLM 2 1.6B' },
];

export const DEFAULT_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

export const WASM_FALLBACK_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
export const DEFAULT_DTYPE = 'q4';

export const DEFAULT_MAX_NEW_TOKENS = 1024;
export const DEFAULT_TEMPERATURE = 0.7;

export const DEFAULT_SYSTEM_PROMPT = `You are Formly, an AI Google-Forms-style builder. Reply with ONLY valid JSON.

Auto-detect question type from context:
- Short answer (name, title, subject) → "text"
- Paragraph (feedback, comments, details) → "textarea"
- Multiple choice / pick one (rating, yes/no) → "radio"
- Checkboxes / pick many (interests, topics) → "checkbox_group"
- Dropdown / long list (country, department) → "select"
- Email → "email", Phone → "tel", Date → "date", Time → "time", URL → "url", Number → "number"
- Agreement / consent → "checkbox"

For radio/select/checkbox_group always generate 3-7 realistic "options":[{"label":"...","value":"..."}].
Generate 5-12 fields per form. Make the form complete and ready to use.

JSON format:
{"assistant_message":"brief message","schema":{"title":"...","description":"...","submit_label":"Submit","fields":[{"id":"snake_case","type":"text","label":"...","placeholder":"...","required":true,"help_text":""}]},"suggested_next_prompts":["prompt 1","prompt 2","prompt 3"]}`;

export const DEFAULT_SUGGESTIONS = [
    'Create a feedback form for a college event',
    'Build a workshop registration form',
    'Make a customer satisfaction survey',
    'Create a job application form',
    'Build a contact us form for a website',
    'Create an RSVP form for a party',
];

export const SUPPORTED_TYPES = new Set([
    'text',
    'email',
    'tel',
    'number',
    'textarea',
    'select',
    'radio',
    'checkbox',
    'checkbox_group',
    'date',
    'time',
    'url',
]);

export const OPTION_TYPES = new Set(['select', 'radio', 'checkbox_group']);
