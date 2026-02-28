import { beforeEach, describe, expect, it } from "vitest";
import { EnvValidationError, loadConfig } from "../src/config/env";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PORT;
    delete process.env.N8N_URL;
    delete process.env.LINEAR_API_KEY;
    delete process.env.LINEAR_TEAM_ID;
    delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    delete process.env.GITHUB_OWNER;
    delete process.env.GITHUB_REPO;
  });

  it("loads defaults", () => {
    const cfg = loadConfig();
    expect(cfg.port).toBe(3000);
    expect(cfg.n8nUrl).toBe("http://localhost:5678");
  });

  it("fails with readable error when required linear env is missing", () => {
    expect(() => loadConfig({ requireLinear: true })).toThrow(EnvValidationError);
  });

  it("fails on invalid PORT", () => {
    process.env.PORT = "abc";
    expect(() => loadConfig()).toThrow(EnvValidationError);
  });

  it("fails when one required linear env is missing", () => {
    process.env.LINEAR_API_KEY = "lin_api_key";
    expect(() => loadConfig({ requireLinear: true })).toThrow(EnvValidationError);
  });

  it("loads required linear env", () => {
    process.env.LINEAR_API_KEY = "lin_api_key";
    process.env.LINEAR_TEAM_ID = "team_1";

    const cfg = loadConfig({ requireLinear: true });
    expect(cfg.linearApiKey).toBe("lin_api_key");
    expect(cfg.linearTeamId).toBe("team_1");
  });

  it("fails with readable error when required github env is missing", () => {
    expect(() => loadConfig({ requireGithub: true })).toThrow(EnvValidationError);
  });

  it("loads required github env", () => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_x";
    process.env.GITHUB_OWNER = "iurii-izman";
    process.env.GITHUB_REPO = "AIPipeline";

    const cfg = loadConfig({ requireGithub: true });
    expect(cfg.githubToken).toBe("ghp_x");
    expect(cfg.githubOwner).toBe("iurii-izman");
    expect(cfg.githubRepo).toBe("AIPipeline");
  });
});
