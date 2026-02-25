import { clamp } from "./utils.js";

export function renderLineChart(svg, values, labels) {
  const width = 720;
  const height = 280;
  const padding = { top: 16, right: 18, bottom: 36, left: 42 };

  const cleanValues = Array.isArray(values) && values.length ? values.map((v) => Number(v || 0)) : [0, 0];
  const maxValue = Math.max(...cleanValues, 10);
  const minValue = 0;
  const points = cleanValues.length;

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const x = (index) => padding.left + (chartWidth / Math.max(1, points - 1)) * index;
  const y = (value) => {
    const ratio = (value - minValue) / (maxValue - minValue || 1);
    return padding.top + chartHeight - ratio * chartHeight;
  };

  const path = cleanValues.map((value, index) => `${index === 0 ? "M" : "L"}${x(index)} ${y(value)}`).join(" ");

  const areaPath = `${path} L ${x(points - 1)} ${padding.top + chartHeight} L ${x(0)} ${padding.top + chartHeight} Z`;

  const horizontalTicks = 5;
  const grid = [];
  for (let i = 0; i <= horizontalTicks; i += 1) {
    const lineY = padding.top + (chartHeight / horizontalTicks) * i;
    const tickValue = Math.round(maxValue - (maxValue / horizontalTicks) * i);
    grid.push(`<line x1="${padding.left}" y1="${lineY}" x2="${width - padding.right}" y2="${lineY}" stroke="#eef2f8"/>`);
    grid.push(
      `<text x="${padding.left - 8}" y="${lineY + 3}" text-anchor="end" font-size="10" fill="#98a2b3">${tickValue}</text>`
    );
  }

  const xLabels = (Array.isArray(labels) ? labels : []).map((label, index) => {
    return `<text x="${x(index)}" y="${height - 10}" text-anchor="middle" font-size="10" fill="#98a2b3">${label}</text>`;
  });

  const dots = cleanValues
    .map((value, index) => {
      return `<circle cx="${x(index)}" cy="${y(value)}" r="3" fill="#111827" stroke="#ffffff" stroke-width="1.5"/>`;
    })
    .join("");

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
    ${grid.join("")}
    <path d="${areaPath}" fill="#f4f5f9"></path>
    <path d="${path}" fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
    ${dots}
    ${xLabels.join("")}
  `;
}

export function applyDeviceRing(element, breakdown) {
  const desktop = clamp(Number(breakdown?.desktop || 0), 0, 100);
  const mobile = clamp(Number(breakdown?.mobile || 0), 0, 100);
  const tablet = clamp(Number(breakdown?.tablet || 0), 0, 100);

  const total = desktop + mobile + tablet || 1;
  const d1 = (desktop / total) * 360;
  const d2 = ((desktop + mobile) / total) * 360;

  element.style.background = `conic-gradient(#111827 0deg ${d1}deg, #98a2b3 ${d1}deg ${d2}deg, #d6dae3 ${d2}deg 360deg)`;
}
