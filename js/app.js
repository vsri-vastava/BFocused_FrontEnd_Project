/* ApplyFlow — vanilla JavaScript only */
"use strict";

const STORAGE_KEY = "applyflow_applications_v1";
const THEME_KEY = "applyflow_theme_v1";
const STATUSES = ["Wishlist", "Applied", "Assessment", "Interview", "Offer", "Rejected"];
const ACTIVE_STATUSES = ["Applied", "Assessment", "Interview"];
let applications = [];
let currentView = "dashboard";
let currentDetailsId = null;
let draggedApplicationId = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const makeId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `app-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const safeURL = value => {
  if (!value) return "";
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
};
const formatDate = value => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const dateDifference = value => {
  if (!value) return null;
  const target = new Date(`${value}T00:00:00`);
  const today = new Date(`${todayISO()}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target - today) / 86400000);
};
const initials = name => String(name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
const toneClass = name => {
  let hash = 0;
  for (const char of String(name || "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `tone-${hash % 5}`;
};
const statusClass = status => `status-${String(status || "").toLowerCase()}`;
const isTerminal = app => ["Offer", "Rejected"].includes(app.status);

function loadApplications() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    applications = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(applications)) applications = [];
    applications = applications.filter(app => app && app.id && app.company && app.role && STATUSES.includes(app.status));
  } catch (error) {
    applications = [];
    console.warn("ApplyFlow could not read saved data.", error);
  }
}
function saveApplications() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    return true;
  } catch (error) {
    showToast("Could not save data. Your browser storage may be full.", "error");
    return false;
  }
}
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  $("#toastContainer").appendChild(toast);
  window.setTimeout(() => toast.remove(), 3500);
}
function setView(view) {
  const map = { dashboard: "Dashboard", applications: "Applications", kanban: "Kanban board", deadlines: "Deadlines" };
  if (!map[view]) return;
  currentView = view;
  $$(".view").forEach(section => section.classList.toggle("active-view", section.id === `${view}View`));
  $$(".nav-link[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  $("#pageCrumb").textContent = map[view];
  $("#sidebar").classList.remove("mobile-open");
  $("#sidebarScrim").classList.remove("show");
  renderAll();
}
function renderAll() {
  $("#navAppCount").textContent = applications.length;
  renderDashboard();
  renderApplications();
  renderKanban();
  renderDeadlines();
  updateNotificationDot();
}
function applicationRow(app, includeType = false) {
  const deadlineDiff = dateDifference(app.deadline);
  const deadlineClass = deadlineDiff !== null && deadlineDiff < 0 && !isTerminal(app) ? "overdue" : deadlineDiff !== null && deadlineDiff <= 7 && !isTerminal(app) ? "soon" : "";
  return `<tr>
    <td><div class="company-cell"><div class="company-logo ${toneClass(app.company)}">${escapeHTML(initials(app.company))}</div><div class="company-copy"><strong>${escapeHTML(app.company)}</strong><span>${escapeHTML(app.role)}</span></div></div></td>
    ${includeType ? `<td>${escapeHTML(app.jobType || "Internship")}</td>` : ""}
    <td><span class="status-badge ${statusClass(app.status)}">${escapeHTML(app.status)}</span></td>
    ${includeType ? "" : ""}
    <td>${formatDate(app.appliedDate)}</td>
    <td><span class="deadline-text ${deadlineClass}">${formatDate(app.deadline)}</span></td>
    <td><div class="row-actions"><button class="row-action" data-action="details" data-id="${escapeHTML(app.id)}" title="View details" aria-label="View ${escapeHTML(app.company)} details">↗</button><button class="row-action" data-action="edit" data-id="${escapeHTML(app.id)}" title="Edit application" aria-label="Edit ${escapeHTML(app.company)}">✎</button><button class="row-action" data-action="delete" data-id="${escapeHTML(app.id)}" title="Delete application" aria-label="Delete ${escapeHTML(app.company)}">×</button></div></td>
  </tr>`;
}
function renderDashboard() {
  $("#statTotal").textContent = applications.length;
  $("#statProgress").textContent = applications.filter(app => ACTIVE_STATUSES.includes(app.status)).length;
  $("#statInterviews").textContent = applications.filter(app => app.status === "Interview").length;
  $("#statOffers").textContent = applications.filter(app => app.status === "Offer").length;
  const recent = [...applications].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 5);
  $("#recentApplicationsBody").innerHTML = recent.map(app => applicationRow(app)).join("");
  $("#recentEmpty").classList.toggle("visible", recent.length === 0);
  $("#recentApplicationsBody").closest(".table-wrap").classList.toggle("no-rows", recent.length === 0);
  renderDashboardDeadlines();
  renderPipeline();
  const responded = applications.filter(app => !["Wishlist", "Applied"].includes(app.status)).length;
  const applied = applications.filter(app => app.status !== "Wishlist").length;
  const rate = applied ? Math.round((responded / applied) * 100) : 0;
  $("#responseRate").textContent = `${rate}%`;
  $("#responseProgress").style.width = `${rate}%`;
}
function upcomingItems() {
  return applications.flatMap(app => {
    const items = [];
    if (app.deadline && !isTerminal(app)) {
      const diff = dateDifference(app.deadline);
      if (diff !== null && diff <= 7) items.push({ app, date: app.deadline, kind: "Application deadline", diff });
    }
    if (app.followupDate && !app.followupDone) {
      const diff = dateDifference(app.followupDate);
      if (diff !== null && diff <= 7) items.push({ app, date: app.followupDate, kind: "Follow-up", diff });
    }
    return items;
  }).sort((a, b) => a.date.localeCompare(b.date));
}
function renderDashboardDeadlines() {
  const items = upcomingItems().slice(0, 4);
  $("#dashboardDeadlines").innerHTML = items.map(item => {
    const d = new Date(`${item.date}T12:00:00`);
    const diffText = item.diff < 0 ? `${Math.abs(item.diff)} day${Math.abs(item.diff) === 1 ? "" : "s"} overdue` : item.diff === 0 ? "Due today" : item.diff === 1 ? "Due tomorrow" : `In ${item.diff} days`;
    return `<div class="deadline-item"><div class="date-tile ${item.diff < 0 ? "overdue-tile" : ""}"><span class="month">${d.toLocaleDateString("en-IN", { month: "short" })}</span><span class="day">${d.getDate()}</span></div><div class="deadline-copy"><strong>${escapeHTML(item.app.company)}</strong><span>${escapeHTML(item.kind)} · ${escapeHTML(item.app.role)}</span></div><span class="deadline-label">${escapeHTML(diffText)}</span></div>`;
  }).join("");
  $("#deadlinesEmpty").classList.toggle("visible", items.length === 0);
}
function renderPipeline() {
  const counts = STATUSES.map(status => ({ status, count: applications.filter(app => app.status === status).length }));
  const max = Math.max(1, ...counts.map(item => item.count));
  $("#pipelineChart").innerHTML = counts.map(item => `<div class="pipeline-row"><span class="pipeline-name">${escapeHTML(item.status)}</span><div class="pipeline-track"><div class="pipeline-fill ${item.status.toLowerCase()}" style="width:${(item.count / max) * 100}%"></div></div><span class="pipeline-count">${item.count}</span></div>`).join("");
}
function getFilteredApplications() {
  const search = $("#searchInput").value.trim().toLowerCase();
  const status = $("#statusFilter").value;
  const type = $("#typeFilter").value;
  const sort = $("#sortFilter").value;
  const filtered = applications.filter(app => {
    const matchesSearch = !search || `${app.company} ${app.role} ${app.notes || ""}`.toLowerCase().includes(search);
    return matchesSearch && (!status || app.status === status) && (!type || app.jobType === type);
  });
  filtered.sort((a, b) => {
    if (sort === "company") return a.company.localeCompare(b.company);
    if (sort === "deadline") return (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31");
    if (sort === "applied") return (b.appliedDate || "").localeCompare(a.appliedDate || "");
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
  return filtered;
}
function renderApplications() {
  const filtered = getFilteredApplications();
  $("#listCount").textContent = `${filtered.length} application${filtered.length === 1 ? "" : "s"}`;
  $("#allApplicationsBody").innerHTML = filtered.map(app => applicationRow(app, true)).join("");
  $("#allEmpty").classList.toggle("visible", filtered.length === 0);
  $("#allTablePanel").style.display = $("#cardViewButton").classList.contains("active") ? "none" : "block";
  $("#applicationCardGrid").classList.toggle("active", $("#cardViewButton").classList.contains("active"));
  $("#applicationCardGrid").innerHTML = filtered.map(app => {
    const link = safeURL(app.jobLink);
    return `<article class="application-card"><div class="application-card-top"><div class="company-logo ${toneClass(app.company)}">${escapeHTML(initials(app.company))}</div><div class="company-copy"><strong>${escapeHTML(app.company)}</strong><span>${escapeHTML(app.jobType)} · ${escapeHTML(app.workMode)}</span></div></div><p class="card-role">${escapeHTML(app.role)}</p><span class="status-badge ${statusClass(app.status)}">${escapeHTML(app.status)}</span><div class="application-card-meta"><span>Applied <strong>${formatDate(app.appliedDate)}</strong></span><span>Deadline <strong>${formatDate(app.deadline)}</strong></span></div><div class="application-card-actions"><button class="secondary-button" data-action="details" data-id="${escapeHTML(app.id)}">Details</button><button class="secondary-button" data-action="edit" data-id="${escapeHTML(app.id)}">Edit</button>${link ? `<a class="secondary-button" href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">Job link ↗</a>` : ""}</div></article>`;
  }).join("");
}
function renderKanban() {
  $("#kanbanBoard").innerHTML = STATUSES.map(status => {
    const items = applications.filter(app => app.status === status);
    return `<section class="kanban-column" data-status="${escapeHTML(status)}"><div class="kanban-column-heading"><span class="column-title"><span class="column-dot ${status.toLowerCase()}"></span>${escapeHTML(status)}</span><span class="column-count">${items.length}</span></div><div class="kanban-cards" data-status="${escapeHTML(status)}">${items.length ? items.map(app => `<article class="kanban-card" draggable="true" data-id="${escapeHTML(app.id)}"><div class="company-cell"><div class="company-logo ${toneClass(app.company)}">${escapeHTML(initials(app.company))}</div><div class="company-copy"><strong>${escapeHTML(app.company)}</strong><span>${escapeHTML(app.jobType)}</span></div></div><p class="kanban-role">${escapeHTML(app.role)}</p><span class="status-badge ${statusClass(app.status)}">${escapeHTML(app.status)}</span><div class="kanban-card-footer"><span>${app.deadline ? `Due ${formatDate(app.deadline)}` : "No deadline"}</span><button class="row-action" data-action="edit" data-id="${escapeHTML(app.id)}" title="Edit">✎</button></div></article>`).join("") : `<div class="kanban-empty">Drop applications here</div>`}</div></section>`;
  }).join("");
}
function allDeadlineItems() {
  return applications.flatMap(app => {
    const result = [];
    if (app.deadline && !isTerminal(app)) result.push({ app, date: app.deadline, kind: "Application deadline", type: "deadline", diff: dateDifference(app.deadline) });
    if (app.followupDate && !app.followupDone) result.push({ app, date: app.followupDate, kind: "Follow-up", type: "followup", diff: dateDifference(app.followupDate) });
    return result;
  }).sort((a, b) => a.date.localeCompare(b.date));
}
function renderDeadlines() {
  const items = allDeadlineItems();
  const upcoming = items.filter(item => item.diff >= 0 && item.diff <= 7 && item.type === "deadline").length;
  const overdue = items.filter(item => item.diff < 0 && item.type === "deadline").length;
  const followups = items.filter(item => item.type === "followup" && item.diff <= 0).length;
  $("#deadlineUpcomingCount").textContent = upcoming;
  $("#deadlineOverdueCount").textContent = overdue;
  $("#followupDueCount").textContent = followups;
  const filter = $("#deadlineFilter").value;
  const filtered = items.filter(item => {
    if (filter === "upcoming") return item.type === "deadline" && item.diff >= 0 && item.diff <= 7;
    if (filter === "overdue") return item.type === "deadline" && item.diff < 0;
    if (filter === "followup") return item.type === "followup";
    return true;
  });
  $("#allDeadlinesList").innerHTML = filtered.map(item => {
    const diffText = item.diff < 0 ? `${Math.abs(item.diff)} day${Math.abs(item.diff) === 1 ? "" : "s"} overdue` : item.diff === 0 ? "Due today" : item.diff === 1 ? "Tomorrow" : `In ${item.diff} days`;
    const dateLabelClass = item.diff < 0 ? "overdue" : item.diff <= 3 ? "soon" : "";
    return `<div class="deadline-page-item"><div class="date-tile ${item.diff < 0 ? "overdue-tile" : ""}"><span class="month">${new Date(`${item.date}T12:00:00`).toLocaleDateString("en-IN", { month: "short" })}</span><span class="day">${new Date(`${item.date}T12:00:00`).getDate()}</span></div><div class="deadline-main"><div class="deadline-kind">${escapeHTML(item.kind)}</div><strong>${escapeHTML(item.app.company)} — ${escapeHTML(item.app.role)}</strong><p>${escapeHTML(item.app.status)}${item.app.followupDate && item.type === "followup" ? " · Contact or follow up" : ""}</p></div><div class="deadline-date-label ${dateLabelClass}">${escapeHTML(diffText)}<br><span>${formatDate(item.date)}</span></div><button class="row-action" data-action="${item.type === "followup" ? "complete-followup" : "edit"}" data-id="${escapeHTML(item.app.id)}" title="${item.type === "followup" ? "Mark follow-up done" : "Edit application"}">${item.type === "followup" ? "✓" : "✎"}</button></div>`;
  }).join("");
  $("#allDeadlinesEmpty").classList.toggle("visible", filtered.length === 0);
}
function updateNotificationDot() {
  const items = upcomingItems().filter(item => item.diff <= 2);
  $("#notificationDot").style.display = items.length ? "block" : "none";
}
function openModal(app = null) {
  $("#applicationForm").reset();
  $("#applicationId").value = app?.id || "";
  $("#modalTitle").textContent = app ? "Edit application" : "Add application";
  $("#saveApplicationButton").textContent = app ? "Save changes" : "Save application";
  $("#formError").textContent = "";
  $("#company").value = app?.company || "";
  $("#role").value = app?.role || "";
  $("#jobType").value = app?.jobType || "Internship";
  $("#workMode").value = app?.workMode || "Remote";
  $("#status").value = app?.status || "Wishlist";
  $("#appliedDate").value = app?.appliedDate || (app ? "" : todayISO());
  $("#deadline").value = app?.deadline || "";
  $("#followupDate").value = app?.followupDate || "";
  $("#salary").value = app?.salary || "";
  $("#jobLink").value = app?.jobLink || "";
  $("#recruiter").value = app?.recruiter || "";
  $("#notes").value = app?.notes || "";
  $("#applicationModal").classList.add("open");
  $("#applicationModal").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  window.setTimeout(() => $("#company").focus(), 60);
}
function closeModal() {
  $("#applicationModal").classList.remove("open");
  $("#applicationModal").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
function saveApplication(event) {
  event.preventDefault();
  const id = $("#applicationId").value;
  const company = $("#company").value.trim();
  const role = $("#role").value.trim();
  const deadline = $("#deadline").value;
  const appliedDate = $("#appliedDate").value;
  const followupDate = $("#followupDate").value;
  const jobLink = $("#jobLink").value.trim();
  const error = $("#formError");
  error.textContent = "";
  if (!company || !role) { error.textContent = "Please enter both the company name and job role."; return; }
  if (deadline && appliedDate && deadline < appliedDate) { error.textContent = "The deadline is earlier than the application date. Please check the dates."; return; }
  if (jobLink && !safeURL(jobLink)) { error.textContent = "Please enter a valid link beginning with http:// or https://."; return; }
  const old = applications.find(app => app.id === id);
  const now = new Date().toISOString();
  const updated = {
    id: id || makeId(), company, role,
    jobType: $("#jobType").value, workMode: $("#workMode").value, status: $("#status").value,
    appliedDate, deadline, followupDate, salary: $("#salary").value.trim(),
    jobLink: jobLink ? safeURL(jobLink) : "", recruiter: $("#recruiter").value.trim(),
    notes: $("#notes").value.trim(), followupDone: old?.followupDone || false,
    createdAt: old?.createdAt || now, updatedAt: now,
    history: old?.history || [{ status: $("#status").value, date: todayISO() }]
  };
  if (old) {
    if (old.status !== updated.status) updated.history = [...(old.history || []), { status: updated.status, date: todayISO() }];
    applications = applications.map(app => app.id === id ? updated : app);
  } else applications.unshift(updated);
  saveApplications();
  closeModal();
  renderAll();
  showToast(old ? "Application updated successfully." : "Application added successfully.");
}
function editApplication(id) {
  const app = applications.find(item => item.id === id);
  if (app) openModal(app);
}
function deleteApplication(id) {
  const app = applications.find(item => item.id === id);
  if (!app) return;
  if (!window.confirm(`Delete the application for ${app.company} — ${app.role}? This cannot be undone.`)) return;
  applications = applications.filter(item => item.id !== id);
  saveApplications();
  renderAll();
  showToast("Application deleted.");
  if ($("#detailsModal").classList.contains("open")) closeDetails();
}
function openDetails(id) {
  const app = applications.find(item => item.id === id);
  if (!app) return;
  currentDetailsId = id;
  $("#detailsTitle").textContent = `${app.company}`;
  const link = safeURL(app.jobLink);
  const history = (app.history || []).map(item => `<div class="detail-item"><span>${formatDate(item.date)}</span><strong>${escapeHTML(item.status)}</strong></div>`).join("");
  $("#detailsContent").innerHTML = `<div class="detail-header"><div class="company-logo ${toneClass(app.company)}">${escapeHTML(initials(app.company))}</div><div><h3>${escapeHTML(app.role)}</h3><p>${escapeHTML(app.jobType)} · ${escapeHTML(app.workMode)} · <span class="status-badge ${statusClass(app.status)}">${escapeHTML(app.status)}</span></p></div></div><div class="details-grid"><div class="detail-item"><span>Application date</span><strong>${formatDate(app.appliedDate)}</strong></div><div class="detail-item"><span>Deadline</span><strong>${formatDate(app.deadline)}</strong></div><div class="detail-item"><span>Follow-up date</span><strong>${formatDate(app.followupDate)}${app.followupDone ? " · Completed" : ""}</strong></div><div class="detail-item"><span>Stipend / salary</span><strong>${escapeHTML(app.salary || "Not specified")}</strong></div><div class="detail-item"><span>Recruiter contact</span><strong>${escapeHTML(app.recruiter || "Not specified")}</strong></div><div class="detail-item"><span>Job link</span>${link ? `<a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">Open opportunity ↗</a>` : "<strong>Not provided</strong>"}</div><div class="detail-item full-field"><span>Notes</span><strong class="detail-notes">${escapeHTML(app.notes || "No notes added yet.")}</strong></div></div><h3 style="font-size:12px;margin:20px 0 0">Status history</h3><div class="details-grid">${history || "<p>No history yet.</p>"}</div>`;
  $("#detailsModal").classList.add("open");
  $("#detailsModal").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeDetails() {
  $("#detailsModal").classList.remove("open");
  $("#detailsModal").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  currentDetailsId = null;
}
function handleActionClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "details") openDetails(id);
  if (action === "edit") editApplication(id);
  if (action === "delete") deleteApplication(id);
  if (action === "complete-followup") {
    const app = applications.find(item => item.id === id);
    if (app) {
      app.followupDone = true;
      app.updatedAt = new Date().toISOString();
      saveApplications();
      renderAll();
      showToast("Follow-up marked as completed.");
    }
  }
}
function handleDragStart(event) {
  const card = event.target.closest(".kanban-card");
  if (!card) return;
  draggedApplicationId = card.dataset.id;
  card.classList.add("dragging");
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedApplicationId);
  }
}
function handleDragEnd(event) {
  const card = event.target.closest(".kanban-card");
  if (card) card.classList.remove("dragging");
  $$(".kanban-column").forEach(column => column.classList.remove("drag-over"));
  draggedApplicationId = null;
}
function handleDrop(event) {
  event.preventDefault();
  const column = event.target.closest(".kanban-column");
  if (!column) return;
  column.classList.remove("drag-over");
  const id = event.dataTransfer?.getData("text/plain") || draggedApplicationId;
  const newStatus = column.dataset.status;
  const app = applications.find(item => item.id === id);
  if (!app || !STATUSES.includes(newStatus) || app.status === newStatus) return;
  app.status = newStatus;
  app.updatedAt = new Date().toISOString();
  app.history = [...(app.history || []), { status: newStatus, date: todayISO() }];
  saveApplications();
  renderAll();
  showToast(`Moved ${app.company} to ${newStatus}.`);
}
function loadDemoData() {
  if (applications.length && !window.confirm("Add demo applications to your existing list?")) return;
  const today = new Date();
  const plusDays = n => { const d = new Date(today); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const demo = [
    { company: "Atlassian", role: "Software Engineer Intern", jobType: "Internship", workMode: "Hybrid", status: "Applied", appliedDate: plusDays(-8), deadline: plusDays(5), followupDate: plusDays(2), salary: "As listed", jobLink: "https://www.atlassian.com/company/careers", recruiter: "", notes: "Review data structures and JavaScript fundamentals." },
    { company: "Microsoft", role: "Explore Intern", jobType: "Internship", workMode: "Hybrid", status: "Assessment", appliedDate: plusDays(-14), deadline: plusDays(2), followupDate: "", salary: "Not specified", jobLink: "https://careers.microsoft.com/", recruiter: "", notes: "Practise problem-solving and review application details." },
    { company: "Adobe", role: "Frontend Developer Intern", jobType: "Internship", workMode: "On-site", status: "Interview", appliedDate: plusDays(-20), deadline: "", followupDate: plusDays(1), salary: "", jobLink: "https://careers.adobe.com/", recruiter: "", notes: "Prepare project walkthrough and DOM questions." },
    { company: "Google", role: "Software Engineering Intern", jobType: "Internship", workMode: "Hybrid", status: "Wishlist", appliedDate: "", deadline: plusDays(12), followupDate: "", salary: "", jobLink: "https://www.google.com/about/careers/applications/", recruiter: "", notes: "Check eligibility and application opening dates." },
    { company: "Zoho", role: "Web Developer", jobType: "Full-time", workMode: "On-site", status: "Rejected", appliedDate: plusDays(-35), deadline: "", followupDate: "", salary: "", jobLink: "https://www.zoho.com/careers/", recruiter: "", notes: "Review the process and keep improving." },
    { company: "Freshworks", role: "Product Engineering Intern", jobType: "Internship", workMode: "Remote", status: "Offer", appliedDate: plusDays(-30), deadline: "", followupDate: "", salary: "As listed", jobLink: "https://www.freshworks.com/company/careers/", recruiter: "", notes: "Demo data only — replace with your own records." }
  ];
  const now = new Date().toISOString();
  demo.forEach(item => {
    if (!applications.some(existing => existing.company.toLowerCase() === item.company.toLowerCase() && existing.role.toLowerCase() === item.role.toLowerCase())) {
      applications.push({ ...item, id: makeId(), followupDone: false, createdAt: now, updatedAt: now, history: [{ status: item.status, date: item.appliedDate || todayISO() }] });
    }
  });
  saveApplications();
  renderAll();
  showToast("Demo data loaded. You can edit or delete these sample records.");
}
function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}
function exportCSV() {
  const columns = ["company", "role", "jobType", "workMode", "status", "appliedDate", "deadline", "followupDate", "salary", "jobLink", "recruiter", "notes"];
  const rows = [columns.join(","), ...applications.map(app => columns.map(key => csvEscape(app[key])).join(","))];
  const blob = new Blob(["\uFEFF" + rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `applyflow-applications-${todayISO()}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("CSV export downloaded.");
}
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (ch === '"' && inQuotes && next === '"') { field += '"'; i++; }
    else if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) { row.push(field); field = ""; }
    else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ""));
}
async function importCSV(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error("The CSV file does not contain any application records.");
    const headers = rows[0].map(header => header.trim().toLowerCase());
    const required = ["company", "role"];
    if (!required.every(key => headers.includes(key))) throw new Error("CSV must contain at least the company and role columns. Export a sample CSV first to see the format.");
    const imported = [];
    rows.slice(1).forEach(row => {
      const record = {};
      headers.forEach((header, index) => record[header] = row[index] ?? "");
      const company = (record.company || "").trim();
      const role = (record.role || "").trim();
      if (!company || !role) return;
      const status = STATUSES.includes(record.status) ? record.status : "Wishlist";
      const now = new Date().toISOString();
      imported.push({
        id: makeId(), company: company.slice(0, 80), role: role.slice(0, 100),
        jobType: ["Internship", "Full-time", "Part-time", "Contract"].includes(record.jobtype) ? record.jobtype : "Internship",
        workMode: ["Remote", "Hybrid", "On-site", "Not specified"].includes(record.workmode) ? record.workmode : "Not specified",
        status, appliedDate: record.applieddate || "", deadline: record.deadline || "", followupDate: record.followupdate || "",
        salary: record.salary || "", jobLink: safeURL(record.joblink || ""), recruiter: record.recruiter || "", notes: record.notes || "",
        followupDone: false, createdAt: now, updatedAt: now, history: [{ status, date: record.applieddate || todayISO() }]
      });
    });
    if (!imported.length) throw new Error("No valid application rows were found in this CSV.");
    if (!window.confirm(`Import ${imported.length} application(s)? Existing records will be kept.`)) return;
    applications = [...imported, ...applications];
    saveApplications();
    renderAll();
    showToast(`${imported.length} application(s) imported.`);
  } catch (error) {
    showToast(error.message || "Unable to import this CSV file.", "error");
  } finally {
    $("#importFile").value = "";
  }
}
function toggleNotifications() {
  const popover = $("#notificationPopover");
  if (!popover.hidden) { popover.hidden = true; return; }
  const items = upcomingItems().filter(item => item.diff <= 7).slice(0, 6);
  popover.innerHTML = `<h3>Deadline reminders</h3>${items.length ? items.map(item => `<div class="notification-line"><strong>${escapeHTML(item.app.company)}</strong><br>${escapeHTML(item.kind)} · ${formatDate(item.date)}${item.diff < 0 ? " — overdue" : item.diff === 0 ? " — today" : ` — in ${item.diff} day(s)`}</div>`).join("") : "<p>No deadlines or follow-ups due in the next seven days.</p>"}`;
  popover.hidden = false;
}
function applyTheme(theme) {
  document.body.classList.toggle("dark-mode", theme === "dark");
  $("#themeIcon").textContent = theme === "dark" ? "☀" : "◐";
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}
function init() {
  loadApplications();
  let savedTheme = "light";
  try { savedTheme = localStorage.getItem(THEME_KEY) || "light"; } catch {}
  applyTheme(savedTheme);
  $("#todayLabel").textContent = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  $$(".nav-link[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  $$("[data-go]").forEach(button => button.addEventListener("click", () => setView(button.dataset.go)));
  $$("[data-add]").forEach(button => button.addEventListener("click", () => openModal()));
  $("#addApplicationTop").addEventListener("click", () => openModal());
  $("#loadSampleButton").addEventListener("click", loadDemoData);
  $("#applicationForm").addEventListener("submit", saveApplication);
  $("#closeModal").addEventListener("click", closeModal);
  $("#cancelModal").addEventListener("click", closeModal);
  $("#applicationModal").addEventListener("click", event => { if (event.target === $("#applicationModal")) closeModal(); });
  $("#closeDetails").addEventListener("click", closeDetails);
  $("#detailsCloseButton").addEventListener("click", closeDetails);
  $("#detailsModal").addEventListener("click", event => { if (event.target === $("#detailsModal")) closeDetails(); });
  $("#editFromDetails").addEventListener("click", () => { const id = currentDetailsId; closeDetails(); if (id) editApplication(id); });
  document.addEventListener("click", event => {
    handleActionClick(event);
    if (!event.target.closest("#notificationsButton") && !event.target.closest("#notificationPopover")) $("#notificationPopover").hidden = true;
  });
  $("#searchInput").addEventListener("input", renderApplications);
  ["statusFilter", "typeFilter", "sortFilter"].forEach(id => $(`#${id}`).addEventListener("change", renderApplications));
  $("#clearFilters").addEventListener("click", () => {
    $("#searchInput").value = ""; $("#statusFilter").value = ""; $("#typeFilter").value = ""; $("#sortFilter").value = "updated"; renderApplications();
  });
  $("#tableViewButton").addEventListener("click", () => { $("#tableViewButton").classList.add("active"); $("#cardViewButton").classList.remove("active"); renderApplications(); });
  $("#cardViewButton").addEventListener("click", () => { $("#cardViewButton").classList.add("active"); $("#tableViewButton").classList.remove("active"); renderApplications(); });
  $("#deadlineFilter").addEventListener("change", renderDeadlines);
  $("#kanbanBoard").addEventListener("dragstart", handleDragStart);
  $("#kanbanBoard").addEventListener("dragend", handleDragEnd);
  $("#kanbanBoard").addEventListener("dragover", event => {
    const column = event.target.closest(".kanban-column");
    if (column) { event.preventDefault(); $$(".kanban-column").forEach(item => item.classList.toggle("drag-over", item === column)); }
  });
  $("#kanbanBoard").addEventListener("dragleave", event => {
    const column = event.target.closest(".kanban-column");
    if (column && !column.contains(event.relatedTarget)) column.classList.remove("drag-over");
  });
  $("#kanbanBoard").addEventListener("drop", handleDrop);
  $("#exportButton").addEventListener("click", exportCSV);
  $("#importButton").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", event => importCSV(event.target.files[0]));
  $("#notificationsButton").addEventListener("click", toggleNotifications);
  $("#themeToggle").addEventListener("click", () => applyTheme(document.body.classList.contains("dark-mode") ? "light" : "dark"));
  $("#mobileMenu").addEventListener("click", () => { $("#sidebar").classList.add("mobile-open"); $("#sidebarScrim").classList.add("show"); });
  $("#sidebarScrim").addEventListener("click", () => { $("#sidebar").classList.remove("mobile-open"); $("#sidebarScrim").classList.remove("show"); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { closeModal(); closeDetails(); $("#notificationPopover").hidden = true; $("#sidebar").classList.remove("mobile-open"); $("#sidebarScrim").classList.remove("show"); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setView("applications"); $("#searchInput").focus(); }
  });
  renderAll();
}
document.addEventListener("DOMContentLoaded", init);
