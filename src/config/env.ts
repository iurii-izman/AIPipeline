import { z } from "zod";

export type AppConfig = {
  port: number;
  n8nUrl: string;
  linearApiKey?: string;
  linearTeamId?: string;
  notionToken?: string;
  notionVersion: string;
  notionInboxDatabaseId?: string;
  notionSpecsDatabaseId?: string;
  notionSpecTemplateId?: string;
  githubToken?: string;
  githubOwner?: string;
  githubRepo?: string;
  projectsConfig?: string;
  defaultProjectKey?: string;
};

export class EnvValidationError extends Error {
  public readonly issues: string[];

  constructor(issues: string[]) {
    super(`Environment validation failed:\n- ${issues.join("\n- ")}`);
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

const schema = z.object({
  PORT: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return 3000;
      const num = Number(value);
      return Number.isFinite(num) && num > 0 ? num : NaN;
    })
    .refine((value) => Number.isFinite(value), "PORT must be a positive number"),
  N8N_URL: z.string().url().optional().default("http://localhost:5678"),
  LINEAR_API_KEY: z.string().min(1).optional(),
  LINEAR_TEAM_ID: z.string().min(1).optional(),
  NOTION_TOKEN: z.string().min(1).optional(),
  NOTION_VERSION: z.string().min(1).optional().default("2025-09-03"),
  NOTION_INBOX_DATABASE_ID: z.string().min(1).optional(),
  NOTION_SPECS_DATABASE_ID: z.string().min(1).optional(),
  NOTION_SPEC_TEMPLATE_ID: z.string().min(1).optional(),
  GITHUB_PERSONAL_ACCESS_TOKEN: z.string().min(1).optional(),
  GITHUB_OWNER: z.string().min(1).optional(),
  GITHUB_REPO: z.string().min(1).optional(),
  PROJECTS_CONFIG: z.string().min(1).optional(),
  DEFAULT_PROJECT_KEY: z.string().min(1).optional(),
});

export function loadConfig(options?: { requireLinear?: boolean; requireNotion?: boolean; requireGithub?: boolean }): AppConfig {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`);
    throw new EnvValidationError(issues);
  }

  const cfg: AppConfig = {
    port: parsed.data.PORT,
    n8nUrl: parsed.data.N8N_URL,
    linearApiKey: parsed.data.LINEAR_API_KEY,
    linearTeamId: parsed.data.LINEAR_TEAM_ID,
    notionToken: parsed.data.NOTION_TOKEN,
    notionVersion: parsed.data.NOTION_VERSION,
    notionInboxDatabaseId: parsed.data.NOTION_INBOX_DATABASE_ID,
    notionSpecsDatabaseId: parsed.data.NOTION_SPECS_DATABASE_ID,
    notionSpecTemplateId: parsed.data.NOTION_SPEC_TEMPLATE_ID,
    githubToken: parsed.data.GITHUB_PERSONAL_ACCESS_TOKEN,
    githubOwner: parsed.data.GITHUB_OWNER,
    githubRepo: parsed.data.GITHUB_REPO,
    projectsConfig: parsed.data.PROJECTS_CONFIG,
    defaultProjectKey: parsed.data.DEFAULT_PROJECT_KEY,
  };

  if (options?.requireLinear) {
    const missing: string[] = [];
    if (!cfg.linearApiKey) missing.push("LINEAR_API_KEY is required");
    if (!cfg.linearTeamId) missing.push("LINEAR_TEAM_ID is required");
    if (missing.length) throw new EnvValidationError(missing);
  }

  if (options?.requireNotion) {
    const missing: string[] = [];
    if (!cfg.notionToken) missing.push("NOTION_TOKEN is required");
    if (missing.length) throw new EnvValidationError(missing);
  }

  if (options?.requireGithub) {
    const missing: string[] = [];
    if (!cfg.githubToken) missing.push("GITHUB_PERSONAL_ACCESS_TOKEN is required");
    if (!cfg.githubOwner) missing.push("GITHUB_OWNER is required");
    if (!cfg.githubRepo) missing.push("GITHUB_REPO is required");
    if (missing.length) throw new EnvValidationError(missing);
  }

  return cfg;
}
