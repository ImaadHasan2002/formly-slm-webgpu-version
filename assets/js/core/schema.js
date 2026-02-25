import { DEFAULT_SUGGESTIONS, OPTION_TYPES, SUPPORTED_TYPES } from './config.js';
import { deepClone, pickString, slugify, toTitleCase, truncate } from './utils.js';

// ---------------------------------------------------------------------------
// Starter / empty form
// ---------------------------------------------------------------------------

export function createStarterSchema() {
    return {
        title: 'Untitled Form',
        description: 'Use the AI builder to generate your first draft.',
        submitLabel: 'Submit',
        fields: [
            {
                id: 'full_name',
                type: 'text',
                label: 'Full Name',
                placeholder: 'Jane Doe',
                required: true,
                helpText: '',
                options: [],
            },
            {
                id: 'email',
                type: 'email',
                label: 'Email',
                placeholder: 'name@example.com',
                required: true,
                helpText: '',
                options: [],
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// Normalize model output into a consistent shape
// ---------------------------------------------------------------------------

export function normalizePayload(payload) {
    const assistantMessage =
        typeof payload?.assistant_message === 'string' && payload.assistant_message.trim()
            ? payload.assistant_message.trim()
            : 'I updated the form schema based on your request.';

    const rawSchema = payload?.schema || payload?.form || payload?.form_schema || {};
    const schema = normalizeSchema(rawSchema);

    const rawSuggestions = payload?.suggested_next_prompts || payload?.suggestions || [];
    const suggestions = normalizeSuggestions(rawSuggestions);

    return { assistantMessage, schema, suggestions };
}

export function normalizeSchema(rawSchema) {
    const title = pickString(rawSchema?.title, rawSchema?.form_title, rawSchema?.name) || 'Generated Form';
    const description =
        pickString(rawSchema?.description, rawSchema?.form_description) ||
        'Please complete the form below.';
    const submitLabel =
        pickString(rawSchema?.submit_label, rawSchema?.submitLabel, rawSchema?.cta) || 'Submit';

    const fieldList = Array.isArray(rawSchema?.fields) ? rawSchema.fields : [];
    const seenIds = new Set();

    const fields = fieldList
        .map((field, index) => normalizeField(field, index, seenIds))
        .filter(Boolean);

    if (!fields.length) {
        fields.push(...createStarterSchema().fields);
    }

    return { title, description, submitLabel, fields };
}

function normalizeField(rawField, index, seenIds) {
    if (!rawField || typeof rawField !== 'object') return null;

    const label = pickString(rawField.label, rawField.name, rawField.title) || `Field ${index + 1}`;
    const idBase = pickString(rawField.id, rawField.key) || slugify(label) || `field_${index + 1}`;
    const id = uniqueId(idBase, seenIds);

    const type = canonicalFieldType(rawField.type, label);
    const required = Boolean(rawField.required);
    const placeholder = pickString(rawField.placeholder, rawField.hint) || defaultPlaceholder(type, label);
    const helpText = pickString(rawField.help_text, rawField.helpText, rawField.description) || '';

    let options = normalizeOptions(rawField.options ?? rawField.choices ?? rawField.values);
    if (OPTION_TYPES.has(type) && options.length === 0) {
        options = inferOptions(label);
    }

    return { id, type, label, placeholder, required, helpText, options };
}

// ---------------------------------------------------------------------------
// Google-Forms-style type detection
// ---------------------------------------------------------------------------

const TYPE_ALIASES = {
    short_text: 'text',
    short_answer: 'text',
    shortanswer: 'text',
    long_text: 'textarea',
    long_answer: 'textarea',
    longanswer: 'textarea',
    paragraph: 'textarea',
    dropdown: 'select',
    drop_down: 'select',
    multiple_choice: 'radio',
    multiplechoice: 'radio',
    single_choice: 'radio',
    single_select: 'radio',
    checkboxes: 'checkbox_group',
    multi_select: 'checkbox_group',
    multiselect: 'checkbox_group',
    checkboxgroup: 'checkbox_group',
    checkbox_list: 'checkbox_group',
    phone: 'tel',
    phone_number: 'tel',
    mobile: 'tel',
    rating: 'radio',
    scale: 'radio',
    linear_scale: 'radio',
    yes_no: 'radio',
    yesno: 'radio',
    boolean: 'radio',
    agreement: 'checkbox',
    consent: 'checkbox',
    date_picker: 'date',
    time_picker: 'time',
    website: 'url',
    link: 'url',
    file_upload: 'text',
};

function canonicalFieldType(rawType, label) {
    const normalized = String(rawType || '').toLowerCase().trim().replace(/[\s-]+/g, '_');

    const mapped = TYPE_ALIASES[normalized] || normalized;
    if (SUPPORTED_TYPES.has(mapped)) return mapped;

    const lower = label.toLowerCase();
    if (lower.includes('email')) return 'email';
    if (lower.includes('phone') || lower.includes('mobile') || lower.includes('contact number')) return 'tel';
    if (lower.includes('date') || lower.includes('dob') || lower.includes('birth')) return 'date';
    if (lower.includes('time') || lower.includes('slot')) return 'time';
    if (lower.includes('url') || lower.includes('website') || lower.includes('portfolio') || lower.includes('linkedin')) return 'url';
    if (/rating|satisfaction|score|scale/.test(lower)) return 'radio';
    if (/age|amount|quantity|number of|how many|budget/.test(lower)) return 'number';
    if (/agree|consent|acknowledge|accept|terms|waiver/.test(lower)) return 'checkbox';
    if (/feedback|comment|message|detail|describe|explain|suggestion|reason|additional|tell us|paragraph|essay/.test(lower)) return 'textarea';
    if (/prefer|favourite|favorite|which one|choose one/.test(lower)) return 'radio';
    if (/select all|check all|interests|topics|skills|languages|which of/.test(lower)) return 'checkbox_group';
    if (/department|country|state|city|year|semester|category|gender/.test(lower)) return 'select';

    return 'text';
}

// ---------------------------------------------------------------------------
// Options normalization & inference
// ---------------------------------------------------------------------------

function normalizeOptions(rawOptions) {
    if (!rawOptions) return [];

    const source = Array.isArray(rawOptions)
        ? rawOptions
        : typeof rawOptions === 'string'
            ? rawOptions.split(',')
            : [];

    const options = [];

    for (const item of source) {
        if (typeof item === 'string') {
            const label = item.trim();
            if (!label) continue;
            options.push({ label, value: slugify(label) || label.toLowerCase() });
            continue;
        }

        if (item && typeof item === 'object') {
            const label = pickString(item.label, item.name, item.text);
            const value = pickString(item.value) || (label ? slugify(label) : '');
            if (!label || !value) continue;
            options.push({ label, value });
        }
    }

    return options;
}

export function inferOptions(label) {
    const lower = String(label || '').toLowerCase();

    if (/rating|satisfaction|score/.test(lower)) {
        return [
            { label: 'Excellent', value: 'excellent' },
            { label: 'Good', value: 'good' },
            { label: 'Average', value: 'average' },
            { label: 'Poor', value: 'poor' },
            { label: 'Very Poor', value: 'very_poor' },
        ];
    }

    if (/yes.?no|attend|participate|rsvp|interested|willing|available/.test(lower)) {
        return [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
            { label: 'Maybe', value: 'maybe' },
        ];
    }

    if (/recommend|likely|nps/.test(lower)) {
        return [
            { label: 'Very Likely', value: 'very_likely' },
            { label: 'Likely', value: 'likely' },
            { label: 'Neutral', value: 'neutral' },
            { label: 'Unlikely', value: 'unlikely' },
            { label: 'Very Unlikely', value: 'very_unlikely' },
        ];
    }

    if (/experience|skill|proficiency/.test(lower)) {
        return [
            { label: 'Beginner', value: 'beginner' },
            { label: 'Intermediate', value: 'intermediate' },
            { label: 'Advanced', value: 'advanced' },
        ];
    }

    if (/priority|urgency/.test(lower)) {
        return [
            { label: 'Low', value: 'low' },
            { label: 'Medium', value: 'medium' },
            { label: 'High', value: 'high' },
        ];
    }

    if (/department|team/.test(lower)) {
        return [
            { label: 'Engineering', value: 'engineering' },
            { label: 'Marketing', value: 'marketing' },
            { label: 'Operations', value: 'operations' },
            { label: 'Sales', value: 'sales' },
            { label: 'Human Resources', value: 'hr' },
        ];
    }

    if (/gender/.test(lower)) {
        return [
            { label: 'Male', value: 'male' },
            { label: 'Female', value: 'female' },
            { label: 'Non-binary', value: 'non_binary' },
            { label: 'Prefer not to say', value: 'prefer_not_to_say' },
        ];
    }

    if (/age|age.?group/.test(lower)) {
        return [
            { label: 'Under 18', value: 'under_18' },
            { label: '18-24', value: '18_24' },
            { label: '25-34', value: '25_34' },
            { label: '35-44', value: '35_44' },
            { label: '45+', value: '45_plus' },
        ];
    }

    if (/year|academic/.test(lower)) {
        return [
            { label: '1st Year', value: '1st_year' },
            { label: '2nd Year', value: '2nd_year' },
            { label: '3rd Year', value: '3rd_year' },
            { label: '4th Year', value: '4th_year' },
            { label: 'Postgraduate', value: 'postgraduate' },
        ];
    }

    if (/session|slot|time|schedule/.test(lower)) {
        return [
            { label: 'Morning (9-12)', value: 'morning' },
            { label: 'Afternoon (12-5)', value: 'afternoon' },
            { label: 'Evening (5-8)', value: 'evening' },
        ];
    }

    if (/diet|food|meal/.test(lower)) {
        return [
            { label: 'Vegetarian', value: 'vegetarian' },
            { label: 'Vegan', value: 'vegan' },
            { label: 'Non-Vegetarian', value: 'non_vegetarian' },
            { label: 'Gluten-Free', value: 'gluten_free' },
            { label: 'No Restrictions', value: 'none' },
        ];
    }

    if (/hear|how did you|source|referral/.test(lower)) {
        return [
            { label: 'Social Media', value: 'social_media' },
            { label: 'Friend / Colleague', value: 'friend' },
            { label: 'Google Search', value: 'google' },
            { label: 'Email Newsletter', value: 'newsletter' },
            { label: 'Other', value: 'other' },
        ];
    }

    if (/size|company/.test(lower)) {
        return [
            { label: '1-10', value: '1_10' },
            { label: '11-50', value: '11_50' },
            { label: '51-200', value: '51_200' },
            { label: '201+', value: '201_plus' },
        ];
    }

    if (/t.?shirt|shirt.?size|size/.test(lower)) {
        return [
            { label: 'S', value: 's' },
            { label: 'M', value: 'm' },
            { label: 'L', value: 'l' },
            { label: 'XL', value: 'xl' },
            { label: 'XXL', value: 'xxl' },
        ];
    }

    return [
        { label: 'Option A', value: 'option_a' },
        { label: 'Option B', value: 'option_b' },
        { label: 'Option C', value: 'option_c' },
    ];
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

export function normalizeSuggestions(rawSuggestions) {
    if (!Array.isArray(rawSuggestions)) return [];

    const unique = new Set();
    const list = [];

    for (const item of rawSuggestions) {
        if (typeof item !== 'string') continue;
        const value = item.trim();
        if (!value || unique.has(value)) continue;
        unique.add(value);
        list.push(value);
    }

    return list.slice(0, 8);
}

export function deriveDefaultSuggestions(schema) {
    if (!schema?.title) return [...DEFAULT_SUGGESTIONS];

    const t = schema.title;
    return [
        `Add a rating question to ${t}`,
        'Add helper text to every field',
        'Make one field optional for better completion rate',
        'Add a "How did you hear about us?" question',
        `Add a comments section to ${t}`,
    ];
}

// ---------------------------------------------------------------------------
// Heuristic / fallback form generation (template-based)
// ---------------------------------------------------------------------------

export function heuristicPayload(userPrompt, currentSchema) {
    const lower = String(userPrompt || '').toLowerCase();
    const shouldReset = /(create|new form|build|make|generate)/.test(lower) || !currentSchema;
    const base = shouldReset ? createStarterSchema() : deepClone(currentSchema);

    base.title = inferTitle(userPrompt, base.title);
    base.description = inferDescription(userPrompt, base.title);
    base.submitLabel = inferSubmitLabel(base.title);

    if (shouldReset) {
        base.fields = [];
    }

    const template = detectTemplate(lower);
    const templateFields = template
        ? template.fields
        : inferFieldsFromPrompt(lower);

    const existing = new Set(base.fields.map((f) => f.id));
    templateFields.forEach((field) => {
        if (!existing.has(field.id)) {
            base.fields.push(field);
            existing.add(field.id);
        }
    });

    if (!base.fields.length) {
        base.fields = createStarterSchema().fields;
    }

    return {
        assistant_message:
            'I generated a complete form based on your request. You can refine it with follow-up prompts.',
        schema: base,
        suggested_next_prompts: deriveDefaultSuggestions(base),
    };
}

// ---------------------------------------------------------------------------
// Template detection — produces a full field set for common form categories
// ---------------------------------------------------------------------------

const FORM_TEMPLATES = [
    {
        pattern: /feedback|review|opinion/,
        fields: [
            field('full_name', 'text', 'Full Name', 'Jane Doe', true),
            field('email', 'email', 'Email Address', 'name@example.com', true),
            field('overall_rating', 'radio', 'Overall Rating', '', true, 'rating'),
            field('best_part', 'checkbox_group', 'What did you enjoy most?', '', false, 'enjoy'),
            field('improvement', 'textarea', 'Suggestions for Improvement', 'Tell us what we could do better', false),
            field('recommend', 'radio', 'Would you recommend this to others?', '', false, 'recommend'),
            field('additional_comments', 'textarea', 'Additional Comments', 'Any other thoughts?', false),
        ],
    },
    {
        pattern: /register|registration|sign.?up|enroll|enrolment|workshop|bootcamp|seminar|conference|hackathon/,
        fields: [
            field('full_name', 'text', 'Full Name', 'Jane Doe', true),
            field('email', 'email', 'Email Address', 'name@example.com', true),
            field('phone', 'tel', 'Phone Number', '+1 555 000 0000', false),
            field('organization', 'text', 'Organization / College', 'Your organization name', false),
            field('year_or_role', 'select', 'Year / Role', '', false, 'year'),
            field('session_preference', 'select', 'Preferred Session', '', false, 'session'),
            field('dietary_restrictions', 'checkbox_group', 'Dietary Restrictions', '', false, 'diet'),
            field('tshirt_size', 'select', 'T-Shirt Size', '', false, 'tshirt'),
            field('special_requirements', 'textarea', 'Special Requirements', 'Accessibility needs, allergies, etc.', false),
            field('consent', 'checkbox', 'I agree to the terms and conditions', '', true),
        ],
    },
    {
        pattern: /survey|poll|questionnaire/,
        fields: [
            field('full_name', 'text', 'Full Name', 'Jane Doe', false),
            field('email', 'email', 'Email Address', 'name@example.com', false),
            field('age_group', 'select', 'Age Group', '', false, 'age'),
            field('gender', 'select', 'Gender', '', false, 'gender'),
            field('satisfaction', 'radio', 'Overall Satisfaction', '', true, 'rating'),
            field('most_useful', 'checkbox_group', 'Most Useful Aspects', '', false, 'enjoy'),
            field('recommend_likelihood', 'radio', 'How likely are you to recommend us?', '', false, 'recommend'),
            field('heard_about_us', 'select', 'How did you hear about us?', '', false, 'hear'),
            field('open_feedback', 'textarea', 'Any other feedback?', 'Share your thoughts', false),
        ],
    },
    {
        pattern: /contact|reach.?out|get.?in.?touch|inquiry|enquiry/,
        fields: [
            field('full_name', 'text', 'Full Name', 'Jane Doe', true),
            field('email', 'email', 'Email Address', 'name@example.com', true),
            field('phone', 'tel', 'Phone Number', '+1 555 000 0000', false),
            field('subject', 'text', 'Subject', 'What is this about?', true),
            field('message', 'textarea', 'Message', 'Write your message here', true),
        ],
    },
    {
        pattern: /apply|application|job|hiring|career|recruit/,
        fields: [
            field('full_name', 'text', 'Full Name', 'Jane Doe', true),
            field('email', 'email', 'Email Address', 'name@example.com', true),
            field('phone', 'tel', 'Phone Number', '+1 555 000 0000', true),
            field('position', 'text', 'Position Applied For', 'e.g. Software Engineer', true),
            field('experience_level', 'radio', 'Experience Level', '', true, 'experience'),
            field('portfolio_url', 'url', 'Portfolio / LinkedIn', 'https://linkedin.com/in/...', false),
            field('start_date', 'date', 'Earliest Start Date', '', false),
            field('cover_letter', 'textarea', 'Why are you a good fit?', 'Tell us about yourself', true),
            field('consent', 'checkbox', 'I confirm the information is accurate', '', true),
        ],
    },
    {
        pattern: /rsvp|invite|invitation|party|gathering|meetup|event/,
        fields: [
            field('full_name', 'text', 'Full Name', 'Jane Doe', true),
            field('email', 'email', 'Email Address', 'name@example.com', true),
            field('attending', 'radio', 'Will you be attending?', '', true, 'yes_no'),
            field('guests', 'number', 'Number of Guests', '0', false, '', 'Including yourself'),
            field('dietary_restrictions', 'checkbox_group', 'Dietary Preferences', '', false, 'diet'),
            field('message', 'textarea', 'Message to Host', 'Any notes or questions?', false),
        ],
    },
    {
        pattern: /order|purchase|request|booking|reservation|appointment/,
        fields: [
            field('full_name', 'text', 'Full Name', 'Jane Doe', true),
            field('email', 'email', 'Email Address', 'name@example.com', true),
            field('phone', 'tel', 'Phone Number', '+1 555 000 0000', true),
            field('preferred_date', 'date', 'Preferred Date', '', true),
            field('preferred_time', 'time', 'Preferred Time', '', false),
            field('details', 'textarea', 'Additional Details', 'Describe what you need', false),
            field('consent', 'checkbox', 'I agree to the cancellation policy', '', true),
        ],
    },
];

function detectTemplate(lowerPrompt) {
    for (const tmpl of FORM_TEMPLATES) {
        if (tmpl.pattern.test(lowerPrompt)) return tmpl;
    }
    return null;
}

function field(id, type, label, placeholder, required, optionHint = '', helpText = '') {
    const options = OPTION_TYPES.has(type) ? inferOptions(optionHint || label) : [];
    return { id, type, label, placeholder, required, helpText, options };
}

// ---------------------------------------------------------------------------
// Keyword-based field inference (fallback when no template matches)
// ---------------------------------------------------------------------------

function inferFieldsFromPrompt(lowerPrompt) {
    const fields = [];
    const add = (cond, ...args) => { if (cond) fields.push(field(...args)); };

    add(/name/.test(lowerPrompt),
        'full_name', 'text', 'Full Name', 'Jane Doe', true);
    add(/email/.test(lowerPrompt),
        'email', 'email', 'Email Address', 'name@example.com', true);
    add(/phone|mobile|contact number/.test(lowerPrompt),
        'phone', 'tel', 'Phone Number', '+1 555 000 0000', false);
    add(/date|when|schedule/.test(lowerPrompt),
        'date', 'date', 'Date', '', false);
    add(/time|slot/.test(lowerPrompt),
        'preferred_time', 'time', 'Preferred Time', '', false);
    add(/rating|satisfaction|score/.test(lowerPrompt),
        'rating', 'radio', 'Rating', '', true, 'rating');
    add(/experience|skill/.test(lowerPrompt),
        'experience_level', 'radio', 'Experience Level', '', false, 'experience');
    add(/department|team/.test(lowerPrompt),
        'department', 'select', 'Department', '', false, 'department');
    add(/session|availability/.test(lowerPrompt),
        'session', 'select', 'Preferred Session', '', false, 'session');
    add(/age/.test(lowerPrompt),
        'age_group', 'select', 'Age Group', '', false, 'age');
    add(/gender/.test(lowerPrompt),
        'gender', 'select', 'Gender', '', false, 'gender');
    add(/diet|food|meal/.test(lowerPrompt),
        'dietary_restrictions', 'checkbox_group', 'Dietary Restrictions', '', false, 'diet');
    add(/hear|referral|source/.test(lowerPrompt),
        'heard_about_us', 'select', 'How did you hear about us?', '', false, 'hear');
    add(/website|portfolio|url|link/.test(lowerPrompt),
        'website', 'url', 'Website / Portfolio', 'https://example.com', false);
    add(/comment|feedback|message|notes|suggestion/.test(lowerPrompt),
        'comments', 'textarea', 'Comments', 'Share your thoughts', false);
    add(/consent|waiver|agree|terms|accept/.test(lowerPrompt),
        'consent', 'checkbox', 'I agree to the terms and conditions', '', true);

    return dedupeById(fields);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dedupeById(fields) {
    const seen = new Set();
    return fields.filter((f) => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
    });
}

function uniqueId(base, seenIds) {
    const clean = slugify(base) || 'field';
    if (!seenIds.has(clean)) {
        seenIds.add(clean);
        return clean;
    }

    let i = 2;
    while (seenIds.has(`${clean}_${i}`)) i++;

    const id = `${clean}_${i}`;
    seenIds.add(id);
    return id;
}

function defaultPlaceholder(type, label) {
    if (type === 'email') return 'name@example.com';
    if (type === 'tel') return '+1 555 000 0000';
    if (type === 'url') return 'https://example.com';
    if (type === 'number') return '0';
    if (type === 'textarea') return 'Type your answer';
    if (type === 'select') return 'Select an option';
    return `Enter ${label.toLowerCase()}`;
}

function inferTitle(userPrompt, fallback) {
    const cleaned = String(userPrompt || '')
        .replace(/^(create|build|make|generate)\s+(a|an|me)?\s*/i, '')
        .trim();
    if (!cleaned) return fallback || 'Generated Form';

    const match = cleaned.match(/(?:form for|form to|form)(.*)/i);
    const core = (match?.[1] || cleaned).replace(/[.?!]$/, '').trim();
    if (!core) return fallback || 'Generated Form';

    return toTitleCase(core);
}

function inferDescription(userPrompt, title) {
    return `Please complete this ${title.toLowerCase()} form. ${truncate(userPrompt, 140)}`;
}

function inferSubmitLabel(title) {
    if (/register|registration|sign.?up|enroll/i.test(title)) return 'Register';
    if (/apply|application/i.test(title)) return 'Apply';
    if (/feedback|survey|review/i.test(title)) return 'Submit Feedback';
    if (/rsvp|invitation/i.test(title)) return 'RSVP';
    if (/contact|inquiry/i.test(title)) return 'Send Message';
    if (/order|booking|reservation/i.test(title)) return 'Book Now';
    return 'Submit';
}
