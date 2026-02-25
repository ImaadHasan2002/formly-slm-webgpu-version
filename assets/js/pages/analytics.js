import { applyDeviceRing, renderLineChart } from "../core/charts.js";
import { loadState, resolveActiveForm } from "../core/storage.js";
import { formatDateTime, formatNumber, formatPercent } from "../core/utils.js";

const elements = {
  formTitle: document.querySelector("#analytics-form-title"),
  formStatus: document.querySelector("#analytics-form-status"),
  metricSubmissions: document.querySelector("#metric-submissions"),
  metricSubmissionsTrend: document.querySelector("#metric-submissions-trend"),
  metricCompletion: document.querySelector("#metric-completion"),
  metricCompletionTrend: document.querySelector("#metric-completion-trend"),
  metricTime: document.querySelector("#metric-time"),
  metricTimeTrend: document.querySelector("#metric-time-trend"),
  rangeSelect: document.querySelector("#range-select"),
  responseSearch: document.querySelector("#response-search"),
  responsesBody: document.querySelector("#responses-body"),
  submissionChart: document.querySelector("#submission-chart"),
  deviceRing: document.querySelector("#device-ring"),
};

const state = loadState();
const activeForm = resolveActiveForm(state) || state.forms[0];

render();
wireEvents();

function wireEvents() {
  elements.responseSearch.addEventListener("input", renderResponses);
  elements.rangeSelect.addEventListener("change", renderMetrics);
}

function render() {
  if (!activeForm) {
    return;
  }

  elements.formTitle.textContent = activeForm.title;
  elements.formStatus.textContent = activeForm.status === "live" ? "Active" : "Draft";
  elements.formStatus.className = `badge ${activeForm.status === "live" ? "success" : "warning"}`;

  renderMetrics();
  renderCharts();
  renderResponses();
}

function renderMetrics() {
  const days = Number(elements.rangeSelect.value || 30);
  const responses = getResponsesForActiveForm(days);

  const submissions = responses.length || activeForm.totalResponses || 0;
  const completion = activeForm.completionRate || estimateCompletionRate(responses.length);
  const avgMinutes = activeForm.avgMinutes || estimateAverageMinutes(responses.length);

  elements.metricSubmissions.textContent = formatNumber(submissions);
  elements.metricSubmissionsTrend.textContent = "+12%";
  elements.metricSubmissionsTrend.className = "trend up";

  elements.metricCompletion.textContent = formatPercent(completion, 1);
  elements.metricCompletionTrend.textContent = "-2.1%";
  elements.metricCompletionTrend.className = "trend down";

  elements.metricTime.textContent = formatMinutes(avgMinutes);
  elements.metricTimeTrend.textContent = "vs previous period";
  elements.metricTimeTrend.className = "trend up";
}

function renderCharts() {
  const labels = state.analytics?.weeklyLabels || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const values = state.analytics?.weeklySubmissions || [120, 190, 150, 220, 180, 250, 310];
  renderLineChart(elements.submissionChart, values, labels);
  applyDeviceRing(elements.deviceRing, state.analytics?.deviceBreakdown);
}

function renderResponses() {
  const searchTerm = elements.responseSearch.value.trim().toLowerCase();
  const rows = getResponsesForActiveForm(30).filter((response) => {
    if (!searchTerm) {
      return true;
    }

    return [response.email, response.fullName, response.inquiryType, response.device]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm);
  });

  elements.responsesBody.innerHTML = "";

  rows.forEach((response) => {
    const tr = document.createElement("tr");

    const statusClass = response.status === "new" ? "new" : "viewed";
    const dateParts = formatDateTime(response.createdAt);

    tr.innerHTML = `
      <td><span class="status-chip ${statusClass}">${escapeCell(response.status)}</span></td>
      <td>${escapeCell(dateParts.date)}<br><span style="color: var(--muted)">${escapeCell(dateParts.time)}</span></td>
      <td>${escapeCell(response.email)}</td>
      <td>${escapeCell(response.fullName)}</td>
      <td>${escapeCell(response.inquiryType)}</td>
      <td style="text-transform: capitalize">${escapeCell(response.device)}</td>
    `;

    elements.responsesBody.appendChild(tr);
  });

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" style="text-align:center; color: var(--muted)">No matching responses.</td>`;
    elements.responsesBody.appendChild(tr);
  }
}

function getResponsesForActiveForm(daysBack) {
  const threshold = Date.now() - Number(daysBack) * 24 * 60 * 60 * 1000;
  return state.responses
    .filter((response) => response.formId === activeForm.id)
    .filter((response) => new Date(response.createdAt).getTime() >= threshold)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function estimateCompletionRate(responseCount) {
  return responseCount ? Math.max(35, Math.min(88, 55 + responseCount * 0.8)) : 64;
}

function estimateAverageMinutes(responseCount) {
  return responseCount ? Math.max(1.3, 2.6 - responseCount * 0.01) : 2.2;
}

function formatMinutes(value) {
  const totalSeconds = Math.round(Number(value || 0) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function escapeCell(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
