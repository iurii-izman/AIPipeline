import { describe, expect, it } from "vitest";
import { main } from "../src/index.js";

describe("smoke", () => {
  it("returns app name", () => {
    expect(main()).toBe("AIPipeline");
  });
});
