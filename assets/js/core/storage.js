import { ACTIVE_FORM_KEY, STORAGE_KEY } from "./config.js";
import { deepClone, nowIso, uid } from "./utils.js";

function createSeedForms() {
  const now = nowIso();
  return [
    {
      id: "form_product_survey_q3",
      title: "Product Survey Q3",
      description: "Gathering feedback on the new features released in September.",
      status: "live",
      updatedAt: now,
      totalResponses: 856,
      completionRate: 64,
      avgMinutes: 2.3,
      schema: {
        title: "Product Survey Q3",
        description: "Tell us what worked and what should be improved.",
        submitLabel: "Submit Feedback",
        fields: [
          {
            id: "full_name",
            type: "text",
            label: "Full Name",
            placeholder: "Jane Doe",
            required: false,
            helpText: "",
            options: [],
          },
          {
            id: "email",
            type: "email",
            label: "Email",
            placeholder: "name@company.com",
            required: true,
            helpText: "",
            options: [],
          },
          {
            id: "rating",
            type: "select",
            label: "Overall Product Rating",
            placeholder: "Choose rating",
            required: true,
            helpText: "",
            options: [
              { label: "Excellent", value: "excellent" },
              { label: "Good", value: "good" },
              { label: "Fair", value: "fair" },
              { label: "Needs Improvement", value: "needs_improvement" },
            ],
          },
        ],
      },
    },
    {
      id: "form_webinar_registration",
      title: "Webinar Registration",
      description: "Sign up form for the 'AI in Design' webinar next Tuesday.",
      status: "draft",
      updatedAt: now,
      totalResponses: 0,
      completionRate: 0,
      avgMinutes: 0,
      schema: {
        title: "Webinar Registration",
        description: "Reserve your seat and choose your session time.",
        submitLabel: "Register",
        fields: [
          {
            id: "full_name",
            type: "text",
            label: "Full Name",
            placeholder: "Jane Doe",
            required: true,
            helpText: "",
            options: [],
          },
          {
            id: "email",
            type: "email",
            label: "Email",
            placeholder: "name@example.com",
            required: true,
            helpText: "",
            options: [],
          },
        ],
      },
    },
    {
      id: "form_contact_us",
      title: "Contact Us",
      description: "General inquiry form embedded on the homepage.",
      status: "live",
      updatedAt: now,
      totalResponses: 392,
      completionRate: 71,
      avgMinutes: 2.1,
      schema: {
        title: "Contact Us",
        description: "Share your inquiry and our team will follow up shortly.",
        submitLabel: "Send Inquiry",
        fields: [
          {
            id: "full_name",
            type: "text",
            label: "Full Name",
            placeholder: "Jane Doe",
            required: true,
            helpText: "",
            options: [],
          },
          {
            id: "email",
            type: "email",
            label: "Email",
            placeholder: "name@example.com",
            required: true,
            helpText: "",
            options: [],
          },
          {
            id: "inquiry_type",
            type: "radio",
            label: "Inquiry Type",
            placeholder: "",
            required: true,
            helpText: "",
            options: [
              { label: "Product Support", value: "product_support" },
              { label: "Sales Inquiry", value: "sales_inquiry" },
              { label: "Partnership", value: "partnership" },
            ],
          },
        ],
      },
    },
  ];
}

function createSeedResponses() {
  const now = Date.now();
  return [
    {
      id: uid("resp"),
      formId: "form_contact_us",
      status: "new",
      createdAt: new Date(now - 1000 * 60 * 18).toISOString(),
      email: "sarah.m@example.com",
      fullName: "Sarah Miller",
      inquiryType: "Product Support",
      device: "desktop",
    },
    {
      id: uid("resp"),
      formId: "form_contact_us",
      status: "viewed",
      createdAt: new Date(now - 1000 * 60 * 82).toISOString(),
      email: "james.k@company.net",
      fullName: "James K.",
      inquiryType: "Sales Inquiry",
      device: "mobile",
    },
    {
      id: uid("resp"),
      formId: "form_product_survey_q3",
      status: "new",
      createdAt: new Date(now - 1000 * 60 * 210).toISOString(),
      email: "amy.r@startup.io",
      fullName: "Amy Richards",
      inquiryType: "Feature Feedback",
      device: "desktop",
    },
    {
      id: uid("resp"),
      formId: "form_product_survey_q3",
      status: "viewed",
      createdAt: new Date(now - 1000 * 60 * 360).toISOString(),
      email: "kyle.b@example.org",
      fullName: "Kyle Bennett",
      inquiryType: "Bug Report",
      device: "tablet",
    },
  ];
}

function seedState() {
  return {
    forms: createSeedForms(),
    responses: createSeedResponses(),
    analytics: {
      weeklySubmissions: [120, 190, 150, 220, 180, 250, 310],
      weeklyLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      deviceBreakdown: {
        desktop: 55,
        mobile: 35,
        tablet: 10,
      },
    },
  };
}

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedState();
    saveState(seeded);
    setActiveFormId(seeded.forms[0].id);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.forms) || !Array.isArray(parsed.responses)) {
      throw new Error("Invalid shape");
    }
    return parsed;
  } catch {
    const seeded = seedState();
    saveState(seeded);
    setActiveFormId(seeded.forms[0].id);
    return seeded;
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getActiveFormId() {
  return localStorage.getItem(ACTIVE_FORM_KEY);
}

export function setActiveFormId(formId) {
  localStorage.setItem(ACTIVE_FORM_KEY, formId);
}

export function resolveActiveForm(state) {
  const activeId = getActiveFormId();
  const found = state.forms.find((form) => form.id === activeId);
  if (found) {
    return found;
  }

  const fallback = state.forms[0] || null;
  if (fallback) {
    setActiveFormId(fallback.id);
  }
  return fallback;
}

export function upsertForm(state, form) {
  const index = state.forms.findIndex((item) => item.id === form.id);
  if (index >= 0) {
    state.forms[index] = form;
  } else {
    state.forms.unshift(form);
  }
  saveState(state);
}

export function cloneState(state) {
  return deepClone(state);
}
