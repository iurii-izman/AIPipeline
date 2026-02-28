import { describe, expect, it } from "vitest";
import { NotionClient, NotionError } from "../src/modules/notion-client";

function makeResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("NotionClient", () => {
  it("search returns mapped results on happy path", async () => {
    process.env.NOTION_TOKEN = "notion-token";

    const client = new NotionClient({
      fetcher: async () =>
        makeResponse(200, {
          results: [
            {
              id: "page-1",
              url: "https://notion.so/page-1",
              properties: {
                Name: {
                  type: "title",
                  title: [{ plain_text: "Roadmap" }],
                },
              },
            },
          ],
        }),
    });

    const rows = await client.search("roadmap");
    expect(rows).toEqual([{ id: "page-1", url: "https://notion.so/page-1", title: "Roadmap" }]);
  });

  it("search maps untitled entries when title property is missing", async () => {
    process.env.NOTION_TOKEN = "notion-token";

    const client = new NotionClient({
      fetcher: async () =>
        makeResponse(200, {
          results: [{ id: "page-2", url: "https://notion.so/page-2", properties: { Status: { type: "select" } } }],
        }),
    });

    const rows = await client.search("anything");
    expect(rows).toEqual([{ id: "page-2", url: "https://notion.so/page-2", title: "(untitled)" }]);
  });

  it("createPage creates notion page on happy path", async () => {
    process.env.NOTION_TOKEN = "notion-token";

    const client = new NotionClient({
      fetcher: async () => makeResponse(200, { id: "created-1", url: "https://notion.so/created-1" }),
    });

    const page = await client.createPage({
      parentDatabaseId: "db-1",
      title: "Daily Digest",
      content: "Digest content",
    });

    expect(page).toEqual({ id: "created-1", url: "https://notion.so/created-1" });
  });

  it("createPage keeps custom title property when already provided", async () => {
    process.env.NOTION_TOKEN = "notion-token";

    const bodies: string[] = [];
    const client = new NotionClient({
      fetcher: async (_url, init) => {
        bodies.push(String(init?.body || ""));
        return makeResponse(200, { id: "created-custom", url: "https://notion.so/created-custom" });
      },
    });

    await client.createPage({
      parentDatabaseId: "db-1",
      title: "Ignored in favor of explicit property",
      properties: {
        Name: {
          title: [{ type: "text", text: { content: "Explicit title property" } }],
        },
      },
    });

    const sent = JSON.parse(bodies[0] || "{}");
    expect(sent.properties.Name).toBeTruthy();
    expect(sent.properties.title).toBeUndefined();
  });

  it("retries on 429 and then succeeds", async () => {
    process.env.NOTION_TOKEN = "notion-token";

    let calls = 0;
    const client = new NotionClient({
      fetcher: async () => {
        calls += 1;
        if (calls === 1) {
          return makeResponse(429, { message: "rate limited" });
        }
        return makeResponse(200, { results: [] });
      },
    });

    const rows = await client.search("query");
    expect(rows).toEqual([]);
    expect(calls).toBe(2);
  });

  it("opens circuit breaker after repeated upstream failures", async () => {
    process.env.NOTION_TOKEN = "notion-token";

    const client = new NotionClient({
      fetcher: async () => makeResponse(400, { message: "bad request" }),
    });

    for (let i = 0; i < 5; i += 1) {
      await expect(client.search("query")).rejects.toBeInstanceOf(NotionError);
    }

    await expect(client.search("query")).rejects.toMatchObject({ code: "CIRCUIT_OPEN" });
  });

  it("throws typed network error", async () => {
    process.env.NOTION_TOKEN = "notion-token";

    const client = new NotionClient({
      fetcher: async () => {
        throw new Error("network timeout");
      },
    });

    await expect(client.search("query")).rejects.toMatchObject({ code: "NETWORK", retryable: true });
  });

  it("throws typed bad response when create page payload misses id", async () => {
    process.env.NOTION_TOKEN = "notion-token";

    const client = new NotionClient({
      fetcher: async () => makeResponse(200, { url: "https://notion.so/no-id" }),
    });

    await expect(client.createPage({ parentDatabaseId: "db-1", title: "Item" })).rejects.toMatchObject({
      code: "BAD_RESPONSE",
      retryable: false,
    });
  });

  it("does not retry on non-rate-limited 4xx", async () => {
    process.env.NOTION_TOKEN = "notion-token";

    let calls = 0;
    const client = new NotionClient({
      fetcher: async () => {
        calls += 1;
        return makeResponse(403, { message: "forbidden" });
      },
    });

    await expect(client.search("query")).rejects.toMatchObject({ code: "UPSTREAM", retryable: false, status: 403 });
    expect(calls).toBe(1);
  });

  it("createPageIdempotent returns existing page for duplicate key", async () => {
    process.env.NOTION_TOKEN = "notion-token";

    const responses = [
      makeResponse(200, {
        results: [
          {
            id: "existing-1",
            url: "https://notion.so/existing-1",
            properties: {
              Name: {
                type: "title",
                title: [{ plain_text: "Daily Digest [idem:k1]" }],
              },
            },
          },
        ],
        has_more: false,
      }),
    ];

    const client = new NotionClient({
      fetcher: async () => responses.shift() ?? makeResponse(500, { message: "unexpected" }),
    });

    const result = await client.createPageIdempotent(
      {
        parentDatabaseId: "db-1",
        title: "Daily Digest",
      },
      "k1"
    );

    expect(result).toEqual({
      created: false,
      page: { id: "existing-1", url: "https://notion.so/existing-1" },
    });
  });

  it("createPageIdempotent creates when marker not found", async () => {
    process.env.NOTION_TOKEN = "notion-token";

    const responses = [
      makeResponse(200, { results: [], has_more: false }),
      makeResponse(200, { id: "created-2", url: "https://notion.so/created-2" }),
    ];

    const client = new NotionClient({
      fetcher: async () => responses.shift() ?? makeResponse(500, { message: "unexpected" }),
    });

    const result = await client.createPageIdempotent(
      {
        parentDatabaseId: "db-1",
        title: "Daily Digest",
      },
      "k2"
    );

    expect(result).toEqual({
      created: true,
      page: { id: "created-2", url: "https://notion.so/created-2" },
    });
  });

  it("findPageByTitle paginates and finds match on next cursor", async () => {
    process.env.NOTION_TOKEN = "notion-token";

    const calls: string[] = [];
    const responses = [
      makeResponse(200, {
        results: [],
        has_more: true,
        next_cursor: "cursor-2",
      }),
      makeResponse(200, {
        results: [
          {
            id: "found-2",
            url: "https://notion.so/found-2",
            properties: {
              Name: {
                type: "title",
                title: [{ plain_text: "Target title" }],
              },
            },
          },
        ],
        has_more: false,
      }),
    ];

    const client = new NotionClient({
      fetcher: async (url) => {
        calls.push(url);
        return responses.shift() ?? makeResponse(500, { message: "unexpected" });
      },
    });

    const result = await client.findPageByTitle("db-1", "Target title");
    expect(result).toEqual({ id: "found-2", url: "https://notion.so/found-2" });
    expect(calls).toHaveLength(2);
  });

  it("createPageIdempotent creates directly when key is not provided", async () => {
    process.env.NOTION_TOKEN = "notion-token";

    const client = new NotionClient({
      fetcher: async () => makeResponse(200, { id: "created-no-key", url: "https://notion.so/created-no-key" }),
    });

    const result = await client.createPageIdempotent({
      parentDatabaseId: "db-1",
      title: "No key flow",
    });

    expect(result).toEqual({
      created: true,
      page: { id: "created-no-key", url: "https://notion.so/created-no-key" },
    });
  });

  it("fails fast when required notion env is missing", async () => {
    delete process.env.NOTION_TOKEN;

    expect(() => new NotionClient({ fetcher: async () => makeResponse(200, { results: [] }) })).toThrow();
  });
});
