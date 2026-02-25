import { escapeHtml } from "./utils.js";

export function renderSchemaJson(target, schema) {
  target.textContent = JSON.stringify(
    {
      title: schema.title,
      description: schema.description,
      submit_label: schema.submitLabel,
      fields: schema.fields,
    },
    null,
    2
  );
}

export function renderFormPreview({ schema, root, titleEl, descriptionEl, submitEl }) {
  titleEl.textContent = schema.title;
  descriptionEl.textContent = schema.description;
  submitEl.textContent = schema.submitLabel;
  root.innerHTML = "";

  schema.fields.forEach((field) => {
    root.appendChild(createFieldNode(field));
  });
}

function createFieldNode(field) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";

  if (field.type === "radio" || field.type === "checkbox_group") {
    const fieldset = document.createElement("fieldset");
    fieldset.style.margin = "0";
    fieldset.style.padding = "0";
    fieldset.style.border = "0";

    const legend = document.createElement("legend");
    legend.textContent = `${field.label}${field.required ? " *" : ""}`;
    fieldset.appendChild(legend);

    const list = document.createElement("div");
    list.className = "option-list";

    field.options.forEach((option, index) => {
      const optionLabel = document.createElement("label");
      optionLabel.className = "option-item";

      const input = document.createElement("input");
      input.type = field.type === "radio" ? "radio" : "checkbox";
      input.name = `preview_${field.id}`;
      input.value = option.value;
      if (field.required && index === 0 && field.type === "radio") {
        input.required = true;
      }

      const text = document.createElement("span");
      text.textContent = option.label;

      optionLabel.append(input, text);
      list.appendChild(optionLabel);
    });

    fieldset.appendChild(list);
    wrapper.appendChild(fieldset);
    appendHelp(wrapper, field.helpText);
    return wrapper;
  }

  if (field.type === "checkbox") {
    const optionLabel = document.createElement("label");
    optionLabel.className = "option-item";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = `preview_${field.id}`;
    input.required = field.required;

    const text = document.createElement("span");
    text.textContent = field.label;

    optionLabel.append(input, text);
    wrapper.appendChild(optionLabel);
    appendHelp(wrapper, field.helpText);
    return wrapper;
  }

  const label = document.createElement("label");
  label.setAttribute("for", `preview_${field.id}`);
  label.innerHTML = `${escapeHtml(field.label)}${field.required ? ' <span class="required">*</span>' : ""}`;
  wrapper.appendChild(label);

  let control;
  if (field.type === "textarea") {
    control = document.createElement("textarea");
    control.rows = 4;
  } else if (field.type === "select") {
    control = document.createElement("select");

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = field.placeholder || "Select an option";
    control.appendChild(placeholder);

    field.options.forEach((option) => {
      const item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      control.appendChild(item);
    });
  } else {
    control = document.createElement("input");
    control.type = field.type;
  }

  control.id = `preview_${field.id}`;
  control.name = field.id;
  control.required = field.required;
  if (field.placeholder && field.type !== "select") {
    control.placeholder = field.placeholder;
  }

  wrapper.appendChild(control);
  appendHelp(wrapper, field.helpText);
  return wrapper;
}

function appendHelp(wrapper, helpText) {
  if (!helpText) {
    return;
  }
  const hint = document.createElement("small");
  hint.textContent = helpText;
  wrapper.appendChild(hint);
}
