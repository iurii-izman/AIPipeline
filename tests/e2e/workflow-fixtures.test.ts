import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type NodeLike = { name?: string; parameters?: Record<string, unknown> };

type WorkflowDoc = {
  nodes?: NodeLike[];
  connections?: Record<string, unknown>;
};

function loadWorkflow(fileName: string): WorkflowDoc {
  const p = path.resolve(process.cwd(), "docs", "n8n-workflows", fileName);
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw) as WorkflowDoc;
}

function nodeNames(doc: WorkflowDoc): string[] {
  return Array.isArray(doc.nodes) ? doc.nodes.map((n) => String(n.name || "")) : [];
}

describe("e2e/workflow fixtures baseline", () => {
  it("WF-2 contains GitHub webhook + dedupe + DLQ path", () => {
    const wf2 = loadWorkflow("wf-2-github-pr-linear.json");
    const names = nodeNames(wf2);

    expect(names).toContain("GitHub PR Webhook");
    expect(names).toContain("Deduplicate delivery");
    expect(names).toContain("DLQ: park Linear failure");
  });

  it("WF-3 contains Sentry webhook + LLM + heuristic fallback", () => {
    const wf3 = loadWorkflow("wf-3-sentry-telegram.json");
    const names = nodeNames(wf3);

    expect(names).toContain("Sentry Webhook");
    expect(names).toContain("OpenAI classify severity");
    expect(names).toContain("Heuristic classify severity");
    expect(names).toContain("DLQ: park WF-3 Linear failure");
  });

  it("WF-5 exposes command-center branches", () => {
    const wf5 = loadWorkflow("wf-5-status.json");
    const names = nodeNames(wf5);

    expect(names).toContain("Telegram Trigger");
    expect(names).toContain("If /status");
    expect(names).toContain("If /deploy");
    expect(names).toContain("If /standup");
  });

  it("WF-7 contains DLQ parking and replay webhooks", () => {
    const wf7 = loadWorkflow("wf-7-dlq-parking.json");
    const names = nodeNames(wf7);

    expect(names).toContain("DLQ Park Webhook");
    expect(names).toContain("DLQ Replay Webhook");
    expect(names).toContain("Replay dispatch");
  });
});
