# 4. Form schema & data

⬅️ [Code map](03-code-map.md) · Next ➡️ [FAQ & troubleshooting](05-faq.md)

---

## The model's output format

The system prompt asks the model to return exactly this shape:

```json
{
  "assistant_message": "Here's your workshop registration form.",
  "schema": {
    "title": "Workshop Registration",
    "description": "Sign up for our hands-on session.",
    "submit_label": "Register",
    "fields": [
      {
        "id": "full_name",
        "type": "text",
        "label": "Full Name",
        "placeholder": "Jane Doe",
        "required": true,
        "help_text": ""
      },
      {
        "id": "session",
        "type": "radio",
        "label": "Preferred Session",
        "required": true,
        "options": [
          { "label": "Morning", "value": "morning" },
          { "label": "Afternoon", "value": "afternoon" }
        ]
      }
    ]
  },
  "suggested_next_prompts": ["Add a dietary preference question", "Make phone required"]
}
```

| Key | Used for |
|---|---|
| `assistant_message` | Shown as the AI's chat reply |
| `schema` | The form itself |
| `suggested_next_prompts` | The clickable chips under the chat |

> Note: the model writes `snake_case` keys (`submit_label`, `help_text`), but Formly stores them internally in `camelCase` (`submitLabel`, `helpText`). The normalizer accepts both.

## The 12 field types

| Type | Renders as | Typical use | Needs `options`? |
|---|---|---|---|
| `text` | single-line input | name, subject | |
| `textarea` | multi-line box | feedback, comments | |
| `email` | email input | email | |
| `tel` | phone input | phone | |
| `number` | number input | age, guests | |
| `url` | URL input | portfolio, LinkedIn | |
| `date` | date picker | start date | |
| `time` | time picker | preferred time | |
| `radio` | pick **one** | rating, yes/no | ✅ |
| `select` | dropdown | country, department | ✅ |
| `checkbox_group` | pick **many** | interests, topics | ✅ |
| `checkbox` | single tick box | consent / "I agree" | |

If the model returns a type that isn't on this list, the normalizer maps it to the closest match (or guesses from the label). The form never breaks on an unknown type.

## Where data lives: localStorage

There is no database. Everything is stored in **two localStorage keys**:

| Key | Holds |
|---|---|
| `formly_prod_state_v1` | The whole app state (see below) |
| `formly_active_form_id` | The ID of the form you're currently working on, shared by the Builder and Analytics |

State shape:

```js
{
  forms: [
    {
      id, title, description,
      status: "draft" | "live",
      updatedAt,                       // ISO timestamp
      totalResponses, completionRate, avgMinutes,
      schema: { title, description, submitLabel, fields: [...] }
    }
  ],
  responses: [ /* sample response rows used by Analytics */ ],
  analytics: {
    weeklySubmissions: [...7 numbers],
    weeklyLabels: ["Mon", ..., "Sun"],
    deviceBreakdown: { desktop, mobile, tablet }
  }
}
```

**Behaviours worth knowing:**

- On first visit (or if the stored data is corrupt), `loadState()` **seeds demo data** automatically.
- Data is **per browser, per origin.** `127.0.0.1:8000` and `localhost:8000` count as different origins with separate data.
- To reset everything, open DevTools → Application → Local Storage → delete both keys, then reload.
