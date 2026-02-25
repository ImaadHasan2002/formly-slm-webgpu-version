import { loadState, setActiveFormId } from "../core/storage.js";
import { formatNumber, formatPercent, relativeAgo, truncate } from "../core/utils.js";

const elements = {
  promptInput: document.querySelector("#builder-prompt"),
  goBuilder: document.querySelector("#go-builder"),
  totalResponses: document.querySelector("#total-responses"),
  activeForms: document.querySelector("#active-forms"),
  avgCompletion: document.querySelector("#avg-completion"),
  totalTrend: document.querySelector("#total-trend"),
  formsTrend: document.querySelector("#forms-trend"),
  completionTrend: document.querySelector("#completion-trend"),
  recentForms: document.querySelector("#recent-forms"),
};

const state = loadState();
renderSummary();
renderRecentForms();
wireEvents();

function wireEvents() {
  elements.goBuilder.addEventListener("click", goToBuilder);
  elements.promptInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      goToBuilder();
    }
  });

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.promptInput.value = button.dataset.prompt;
      goToBuilder();
    });
  });

  elements.recentForms.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-open-form]");
    if (!button) {
      return;
    }
    const formId = button.dataset.openForm;
    setActiveFormId(formId);
    window.location.href = "./builder.html";
  });
}

function goToBuilder() {
  const prompt = elements.promptInput.value.trim();
  const query = prompt ? `?prompt=${encodeURIComponent(prompt)}` : "";
  window.location.href = `./builder.html${query}`;
}

function renderSummary() {
  const totalResponses = state.responses.length;
  const activeForms = state.forms.filter((form) => form.status === "live").length;

  const completionAvg = average(
    state.forms.map((form) => Number(form.completionRate || 0)).filter((value) => value > 0)
  );

  elements.totalResponses.textContent = formatNumber(totalResponses);
  elements.activeForms.textContent = formatNumber(activeForms);
  elements.avgCompletion.textContent = formatPercent(completionAvg, 0);

  elements.totalTrend.textContent = "+12.5% this week";
  elements.formsTrend.textContent = `${state.forms.filter((f) => f.status === "draft").length} drafts pending`;
  elements.completionTrend.textContent = "+2.1% this week";
}

function renderRecentForms() {
  elements.recentForms.innerHTML = "";

  const covers = ["cover-live-a", "cover-draft", "cover-live-b"];

  state.forms.slice(0, 6).forEach((form, index) => {
    const card = document.createElement("article");
    card.className = "card form-card";

    const cover = document.createElement("div");
    cover.className = `form-cover ${covers[index % covers.length]}`;

    const body = document.createElement("div");
    body.className = "form-body";

    const headRow = document.createElement("div");
    headRow.style.display = "flex";
    headRow.style.justifyContent = "space-between";
    headRow.style.gap = "0.5rem";

    const title = document.createElement("h4");
    title.style.margin = "0";
    title.style.fontSize = "1.55rem";
    title.style.letterSpacing = "-0.01em";
    title.textContent = form.title;

    const status = document.createElement("span");
    status.className = `badge ${form.status === "live" ? "success" : "warning"}`;
    status.textContent = form.status === "live" ? "LIVE" : "DRAFT";

    headRow.append(title, status);

    const meta = document.createElement("p");
    meta.className = "form-meta";
    meta.textContent = truncate(form.description, 90);

    const footer = document.createElement("div");
    footer.className = "form-footer";

    const left = document.createElement("span");
    left.textContent = `${formatNumber(form.totalResponses || 0)} responses`;

    const right = document.createElement("button");
    right.type = "button";
    right.className = "btn btn-ghost";
    right.style.padding = "0.32rem 0.56rem";
    right.style.fontSize = "0.78rem";
    right.dataset.openForm = form.id;
    right.textContent = `Edited ${relativeAgo(form.updatedAt)}`;

    footer.append(left, right);

    body.append(headRow, meta, footer);
    card.append(cover, body);
    elements.recentForms.appendChild(card);
  });
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
