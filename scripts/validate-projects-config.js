#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function loadRaw() {
  if (process.env.PROJECTS_CONFIG) {
    return JSON.parse(process.env.PROJECTS_CONFIG);
  }
  const filePath = path.resolve(process.cwd(), "config/projects.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing config file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toProjects(root) {
  if (Array.isArray(root)) return root;
  if (root && typeof root === "object" && Array.isArray(root.projects)) return root.projects;
  return [];
}

function validateProject(project, index) {
  const errors = [];
  const key = String(project?.key || "").trim();
  if (!key) errors.push(`projects[${index}].key is required`);
  const label = String(project?.label || "").trim();
  if (!label) errors.push(`projects[${index}].label is required`);

  const links = project?.links;
  if (links !== undefined && (typeof links !== "object" || Array.isArray(links))) {
    errors.push(`projects[${index}].links must be an object when provided`);
  }

  const thread = project?.telegramThreadId;
  if (thread !== undefined && thread !== null && String(thread).trim() && !/^-?\d+$/.test(String(thread).trim())) {
    errors.push(`projects[${index}].telegramThreadId must be numeric-like when provided`);
  }
  return errors;
}

function main() {
  const payload = loadRaw();
  const projects = toProjects(payload);
  if (!projects.length) {
    throw new Error("No projects found. Provide at least one project entry.");
  }

  const errors = [];
  const keys = new Set();
  projects.forEach((project, index) => {
    errors.push(...validateProject(project, index));
    const key = String(project?.key || "").trim().toLowerCase();
    if (key) {
      if (keys.has(key)) {
        errors.push(`Duplicate project key: ${key}`);
      }
      keys.add(key);
    }
  });

  if (errors.length) {
    throw new Error(`Projects config validation failed:\n- ${errors.join("\n- ")}`);
  }
  console.log(`projects config: OK (${projects.length} project(s))`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
