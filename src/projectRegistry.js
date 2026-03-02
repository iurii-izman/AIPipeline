const fs = require("fs");
const path = require("path");

function normalizeThreadId(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object");
}

function loadFromJsonString(raw) {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return toList(parsed);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.projects)) {
      return toList(parsed.projects);
    }
    return [];
  } catch {
    return [];
  }
}

function loadFromConfigFile() {
  const filePath = path.resolve(process.cwd(), "config/projects.json");
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (Array.isArray(parsed)) return toList(parsed);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.projects)) {
      return toList(parsed.projects);
    }
    return [];
  } catch {
    return [];
  }
}

function sanitizeProject(input) {
  const project = input || {};
  const key = String(project.key || "").trim();
  if (!key) return null;
  return {
    key,
    label: String(project.label || key),
    emoji: String(project.emoji || ""),
    linearTeamId: String(project.linearTeamId || ""),
    linearProjectId: String(project.linearProjectId || ""),
    notionInboxDatabaseId: String(project.notionInboxDatabaseId || ""),
    notionSpecsDatabaseId: String(project.notionSpecsDatabaseId || ""),
    notionSpecTemplateId: String(project.notionSpecTemplateId || ""),
    telegramThreadId: normalizeThreadId(project.telegramThreadId),
    links: project.links && typeof project.links === "object" ? project.links : {},
  };
}

function loadProjectRegistry() {
  const envProjects = loadFromJsonString(process.env.PROJECTS_CONFIG || "");
  const fileProjects = loadFromConfigFile();
  const raw = envProjects.length ? envProjects : fileProjects;
  const projects = raw.map(sanitizeProject).filter(Boolean);
  const byKey = new Map(projects.map((project) => [project.key.toLowerCase(), project]));
  return {
    projects,
    byKey,
  };
}

function getProjectByKey(registry, key) {
  if (!key) return null;
  const normalized = String(key || "").trim().toLowerCase();
  if (!normalized) return null;
  return registry.byKey.get(normalized) || null;
}

function getProjectByThreadId(registry, threadId) {
  const normalized = normalizeThreadId(threadId);
  if (!normalized) return null;
  return registry.projects.find((project) => normalizeThreadId(project.telegramThreadId) === normalized) || null;
}

function resolveDefaultProject(registry) {
  const preferred = String(process.env.DEFAULT_PROJECT_KEY || "").trim();
  if (preferred) {
    const hit = getProjectByKey(registry, preferred);
    if (hit) return hit;
  }
  return registry.projects[0] || null;
}

module.exports = {
  loadProjectRegistry,
  getProjectByKey,
  getProjectByThreadId,
  resolveDefaultProject,
};
