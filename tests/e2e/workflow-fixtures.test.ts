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

function nodeByName(doc: WorkflowDoc, name: string): NodeLike | undefined {
  return (doc.nodes || []).find((node) => String(node.name || "") === name);
}

function triggerUpdates(doc: WorkflowDoc): string[] {
  const trigger = (doc.nodes || []).find((node) => node.name === "Telegram Trigger");
  const updates = (trigger?.parameters || {}).updates as string[] | undefined;
  return Array.isArray(updates) ? updates : [];
}

function hasConnection(doc: WorkflowDoc, fromNode: string, toNode: string): boolean {
  const root = doc.connections || {};
  const source = root[fromNode] as { main?: Array<Array<{ node?: string }>> } | undefined;
  if (!source || !Array.isArray(source.main)) return false;
  for (const branch of source.main) {
    if (!Array.isArray(branch)) continue;
    if (branch.some((edge) => String(edge?.node || "") === toNode)) return true;
  }
  return false;
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
    const updates = triggerUpdates(wf5);

    expect(names).toContain("Telegram Trigger");
    expect(updates).toContain("message");
    expect(updates).toContain("callback_query");
    expect(names).toContain("If /callback");
    expect(names).toContain("If /status");
    expect(names).toContain("If /project");
    expect(names).toContain("If /progress");
    expect(names).toContain("If /inbox");
    expect(names).toContain("If /triage");
    expect(names).toContain("If /spec");
    expect(names).toContain("If /idea");
    expect(names).toContain("If /deploy");
    expect(names).toContain("If /standup");
    expect(names).toContain("Authorize privileged command");
    expect(names).toContain("Set RBAC denied");
  });

  it("WF-5 callback graph keeps ack+edit path for all intake actions", () => {
    const wf5 = loadWorkflow("wf-5-status.json");
    const names = nodeNames(wf5);
    expect(names).toContain("If callback TASK");
    expect(names).toContain("If callback SPEC");
    expect(names).toContain("If callback IDEA");
    expect(names).toContain("If callback MOVE");
    expect(names).toContain("If callback ARCHIVE");
    expect(names).toContain("Telegram: answer callback");
    expect(names).toContain("Telegram: edit callback message");

    expect(hasConnection(wf5, "If /callback", "If callback TASK")).toBe(true);
    expect(hasConnection(wf5, "If callback TASK", "Linear: callback create issue")).toBe(true);
    expect(hasConnection(wf5, "Format callback TASK", "Telegram: answer callback")).toBe(true);
    expect(hasConnection(wf5, "Format callback TASK", "Telegram: edit callback message")).toBe(true);

    expect(hasConnection(wf5, "If callback SPEC", "Notion: callback create spec")).toBe(true);
    expect(hasConnection(wf5, "Format callback SPEC", "Telegram: answer callback")).toBe(true);
    expect(hasConnection(wf5, "Format callback SPEC", "Telegram: edit callback message")).toBe(true);

    expect(hasConnection(wf5, "If callback IDEA", "Notion: callback create idea")).toBe(true);
    expect(hasConnection(wf5, "Format callback IDEA", "Telegram: answer callback")).toBe(true);
    expect(hasConnection(wf5, "Format callback IDEA", "Telegram: edit callback message")).toBe(true);

    expect(hasConnection(wf5, "If callback MOVE", "Set callback MOVE")).toBe(true);
    expect(hasConnection(wf5, "Set callback MOVE", "Telegram: answer callback")).toBe(true);
    expect(hasConnection(wf5, "Set callback MOVE", "Telegram: edit callback message")).toBe(true);

    expect(hasConnection(wf5, "If callback ARCHIVE", "Set callback ARCHIVE")).toBe(true);
    expect(hasConnection(wf5, "Set callback ARCHIVE", "Telegram: answer callback")).toBe(true);
    expect(hasConnection(wf5, "Set callback ARCHIVE", "Telegram: edit callback message")).toBe(true);
  });

  it("WF-5 capture callback contract uses compact action/id payload keys", () => {
    const wf5 = loadWorkflow("wf-5-status.json");
    const captureNode = nodeByName(wf5, "Telegram: capture actions");
    const body = String((captureNode?.parameters || {}).jsonBody || "");
    expect(body).toContain("a=TASK&i=");
    expect(body).toContain("a=SPEC&i=");
    expect(body).toContain("a=IDEA&i=");
    expect(body).toContain("a=ARCHIVE&i=");
    expect(body).toContain("a=MOVE&i=");
    expect(body).toContain("length <= 64");
  });

  it("WF-5 projects command exposes inline PROJECT_SET callback buttons", () => {
    const wf5 = loadWorkflow("wf-5-status.json");
    const setProjects = nodeByName(wf5, "Set /projects");
    const code = String((setProjects?.parameters || {}).jsCode || "");
    expect(code).toContain("inline_keyboard");
    expect(code).toContain("a=PROJECT_SET&p=");
    expect(code).toContain("replyMarkup");
  });

  it("WF-5 extract command supports /q alias and forwarded metadata enrichment", () => {
    const wf5 = loadWorkflow("wf-5-status.json");
    const extract = nodeByName(wf5, "Extract command");
    const code = String((extract?.parameters || {}).jsCode || "");
    expect(code).toContain("if (command === '/q')");
    expect(code).toContain("quickVerb === 'task'");
    expect(code).toContain("callbackAction === 'PROJECT_SET'");
    expect(code).toContain("forwardedFromName");
  });

  it("WF-5 triage command routes to inline actions", () => {
    const wf5 = loadWorkflow("wf-5-status.json");
    const names = nodeNames(wf5);
    expect(names).toContain("If /triage");
    expect(names).toContain("Set /triage next item");
    expect(names).toContain("If /triage item found");
    expect(names).toContain("Telegram: triage actions");
    expect(hasConnection(wf5, "If /triage", "Set /triage next item")).toBe(true);
    expect(hasConnection(wf5, "If /triage item found", "Telegram: triage actions")).toBe(true);
  });

  it("WF-7 contains DLQ parking and replay webhooks", () => {
    const wf7 = loadWorkflow("wf-7-dlq-parking.json");
    const names = nodeNames(wf7);

    expect(names).toContain("DLQ Park Webhook");
    expect(names).toContain("DLQ Replay Webhook");
    expect(names).toContain("Replay dispatch");
  });

  it("WF-7 replay does not depend on workflow static data", () => {
    const wf7 = loadWorkflow("wf-7-dlq-parking.json");
    const nodeScripts = (wf7.nodes || [])
      .map((node) => String((node.parameters || {}).jsCode || ""))
      .join("\n");
    expect(nodeScripts).not.toContain("$getWorkflowStaticData");
  });
});
