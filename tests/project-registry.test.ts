import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  loadProjectRegistry,
  getProjectByKey,
  getProjectByThreadId,
  resolveDefaultProject,
} = require("../src/projectRegistry.js") as {
  loadProjectRegistry: () => { projects: Array<Record<string, unknown>>; byKey: Map<string, Record<string, unknown>> };
  getProjectByKey: (registry: { byKey: Map<string, Record<string, unknown>> }, key: string) => Record<string, unknown> | null;
  getProjectByThreadId: (
    registry: { projects: Array<Record<string, unknown>> },
    threadId: string | number
  ) => Record<string, unknown> | null;
  resolveDefaultProject: (registry: { projects: Array<Record<string, unknown>> }) => Record<string, unknown> | null;
};

const originalProjectsConfig = process.env.PROJECTS_CONFIG;
const originalDefaultProjectKey = process.env.DEFAULT_PROJECT_KEY;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

afterEach(() => {
  restoreEnv("PROJECTS_CONFIG", originalProjectsConfig);
  restoreEnv("DEFAULT_PROJECT_KEY", originalDefaultProjectKey);
});

describe("projectRegistry", () => {
  it("loads registry from PROJECTS_CONFIG and resolves key/thread/default", () => {
    process.env.PROJECTS_CONFIG = JSON.stringify({
      projects: [
        {
          key: "aipipeline",
          label: "AIPipeline",
          telegramThreadId: "111",
          notionInboxDatabaseId: "inbox-1",
        },
        {
          key: "other",
          label: "Other Project",
          telegramThreadId: 222,
        },
      ],
    });
    process.env.DEFAULT_PROJECT_KEY = "other";

    const registry = loadProjectRegistry();
    expect(registry.projects).toHaveLength(2);
    expect(getProjectByKey(registry, "AIPIPELINE")?.label).toBe("AIPipeline");
    expect(getProjectByThreadId(registry, "222")?.key).toBe("other");
    expect(resolveDefaultProject(registry)?.key).toBe("other");
  });

  it("ignores invalid entries and falls back safely", () => {
    process.env.PROJECTS_CONFIG = JSON.stringify({
      projects: [
        null,
        {},
        { key: "valid", label: "Valid", links: "bad-shape" },
      ],
    });
    delete process.env.DEFAULT_PROJECT_KEY;

    const registry = loadProjectRegistry();
    expect(registry.projects).toHaveLength(1);
    expect(registry.projects[0]?.key).toBe("valid");
    expect(getProjectByKey(registry, "missing")).toBeNull();
    expect(getProjectByThreadId(registry, "999")).toBeNull();
    expect(resolveDefaultProject(registry)?.key).toBe("valid");
  });
});

