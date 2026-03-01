import { loadConfig } from "../../config/env";
import {
  CircuitBreakerOpenError,
  defaultCircuitBreakerPolicy,
  defaultRetryPolicy,
  withCircuitBreaker,
  withRetry,
} from "../../lib/resilience";
import { fetchWithTimeout, type RequestOptions } from "../../lib/http/fetchWithTimeout";

export type NotionPageRef = {
  id: string;
  url?: string;
};

export type NotionSearchResult = {
  id: string;
  url?: string;
  title: string;
};

export type NotionCreatePageInput = {
  parentDatabaseId: string;
  title: string;
  content?: string;
  properties?: Record<string, unknown>;
};

export class NotionError extends Error {
  public readonly status?: number;
  public readonly retryable: boolean;
  public readonly code: "NETWORK" | "RATE_LIMIT" | "UPSTREAM" | "BAD_RESPONSE" | "CIRCUIT_OPEN";

  constructor(params: {
    message: string;
    code: NotionError["code"];
    retryable: boolean;
    status?: number;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "NotionError";
    this.code = params.code;
    this.retryable = params.retryable;
    this.status = params.status;
    if (params.cause) {
      (this as Error & { cause?: unknown }).cause = params.cause;
    }
  }
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type NotionClientOptions = {
  token?: string;
  fetcher?: Fetcher;
  notionVersion?: string;
  defaultTimeoutMs?: number;
};

type NotionListResponse = {
  results?: Array<Record<string, unknown>>;
  has_more?: boolean;
  next_cursor?: string | null;
};

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function parseErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Unknown Notion API error";
  }
  const asObj = payload as Record<string, unknown>;
  const msg = asObj.message;
  if (typeof msg === "string" && msg.trim()) {
    return msg;
  }
  return JSON.stringify(payload);
}

function extractTitleFromPage(page: Record<string, unknown>): string {
  const properties = page.properties;
  if (!properties || typeof properties !== "object") return "(untitled)";
  for (const value of Object.values(properties as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const prop = value as Record<string, unknown>;
    if (prop.type !== "title") continue;
    const nodes = prop.title;
    if (!Array.isArray(nodes)) return "(untitled)";
    const text = nodes
      .map((node) => {
        if (!node || typeof node !== "object") return "";
        const plain = (node as Record<string, unknown>).plain_text;
        return typeof plain === "string" ? plain : "";
      })
      .join("");
    return text || "(untitled)";
  }
  return "(untitled)";
}

function toNotionError(error: unknown): NotionError {
  if (error instanceof NotionError) return error;
  if (error instanceof CircuitBreakerOpenError) {
    return new NotionError({
      message: error.message,
      code: "CIRCUIT_OPEN",
      retryable: true,
      cause: error,
    });
  }
  return new NotionError({
    message: error instanceof Error ? error.message : "Unknown network error",
    code: "NETWORK",
    retryable: true,
    cause: error,
  });
}

export class NotionClient {
  private readonly token: string;
  private readonly fetcher: Fetcher;
  private readonly notionVersion: string;
  private readonly endpoint = "https://api.notion.com/v1";
  private readonly executeWithBreaker: <T>(operation: () => Promise<T>) => Promise<T>;
  private readonly defaultTimeoutMs?: number;

  constructor(options?: NotionClientOptions) {
    const cfg = loadConfig({ requireNotion: true });
    this.token = options?.token ?? cfg.notionToken!;
    this.fetcher = options?.fetcher ?? fetch;
    this.notionVersion = options?.notionVersion ?? cfg.notionVersion;
    this.defaultTimeoutMs = options?.defaultTimeoutMs;
    const guarded = withCircuitBreaker(
      async <T>(operation: () => Promise<T>) => operation(),
      defaultCircuitBreakerPolicy
    );
    this.executeWithBreaker = guarded as <T>(operation: () => Promise<T>) => Promise<T>;
  }

  private async runRequest<T>(
    path: string,
    init?: RequestInit,
    errorContext = "Notion request failed",
    requestOptions?: RequestOptions
  ): Promise<T> {
    const execute = () =>
      withRetry(
        async () => {
          let response: Response;
          try {
            response = await fetchWithTimeout(
              this.fetcher,
              `${this.endpoint}${path}`,
              {
                ...init,
                headers: {
                  Authorization: `Bearer ${this.token}`,
                  "Notion-Version": this.notionVersion,
                  "Content-Type": "application/json",
                  ...(init?.headers ?? {}),
                },
              },
              {
                timeoutMs: requestOptions?.timeoutMs ?? this.defaultTimeoutMs,
                signal: requestOptions?.signal,
              }
            );
          } catch (error) {
            throw new NotionError({
              message: `${errorContext} at network layer`,
              code: "NETWORK",
              retryable: true,
              cause: error,
            });
          }

          const text = await response.text();
          let payload: unknown = {};
          if (text) {
            try {
              payload = JSON.parse(text);
            } catch {
              payload = { message: text };
            }
          }

          if (!response.ok) {
            const message = parseErrorMessage(payload);
            throw new NotionError({
              message: `${errorContext}: ${message}`,
              code: response.status === 429 ? "RATE_LIMIT" : "UPSTREAM",
              retryable: isRetryableStatus(response.status),
              status: response.status,
            });
          }

          if (!payload || typeof payload !== "object") {
            throw new NotionError({
              message: `${errorContext}: invalid JSON payload`,
              code: "BAD_RESPONSE",
              retryable: false,
              status: response.status,
            });
          }

          return payload as T;
        },
        {
          ...defaultRetryPolicy,
          shouldRetry: (error) => toNotionError(error).retryable,
        }
      );

    try {
      return await this.executeWithBreaker(execute);
    } catch (error) {
      throw toNotionError(error);
    }
  }

  async search(query: string, pageSize = 5, requestOptions?: RequestOptions): Promise<NotionSearchResult[]> {
    const data = await this.runRequest<NotionListResponse>(
      "/search",
      {
        method: "POST",
        body: JSON.stringify({ query, page_size: pageSize }),
      },
      "Notion search failed",
      requestOptions
    );

    const rows = Array.isArray(data.results) ? data.results : [];
    return rows.map((row) => {
      const page = row as Record<string, unknown>;
      return {
        id: String(page.id || ""),
        url: typeof page.url === "string" ? page.url : undefined,
        title: extractTitleFromPage(page),
      };
    });
  }

  async createPage(input: NotionCreatePageInput, requestOptions?: RequestOptions): Promise<NotionPageRef> {
    const properties: Record<string, unknown> = {
      ...(input.properties ?? {}),
    };

    if (!Object.values(properties).some((property) => {
      if (!property || typeof property !== "object") return false;
      const titleValue = (property as Record<string, unknown>).title;
      return Array.isArray(titleValue);
    })) {
      properties.title = {
        title: [
          {
            type: "text",
            text: { content: input.title },
          },
        ],
      };
    }

    const children = input.content
      ? [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: input.content } }],
            },
          },
        ]
      : undefined;

    const payload = await this.runRequest<Record<string, unknown>>(
      "/pages",
      {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: input.parentDatabaseId },
          properties,
          ...(children ? { children } : {}),
        }),
      },
      "Notion create page failed",
      requestOptions
    );

    const id = payload.id;
    if (typeof id !== "string" || !id) {
      throw new NotionError({
        message: "Notion create page failed: missing page id",
        code: "BAD_RESPONSE",
        retryable: false,
      });
    }

    return {
      id,
      url: typeof payload.url === "string" ? payload.url : undefined,
    };
  }

  async findPageByTitle(parentDatabaseId: string, title: string, requestOptions?: RequestOptions): Promise<NotionPageRef | null> {
    const maxPages = 3;
    let cursor: string | undefined;

    for (let pageNo = 0; pageNo < maxPages; pageNo += 1) {
      const data = await this.runRequest<NotionListResponse>(
        `/databases/${parentDatabaseId}/query`,
        {
          method: "POST",
          body: JSON.stringify({
            page_size: 50,
            ...(cursor ? { start_cursor: cursor } : {}),
          }),
        },
        "Notion database query failed",
        requestOptions
      );

      const rows = Array.isArray(data.results) ? data.results : [];
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const page = row as Record<string, unknown>;
        if (extractTitleFromPage(page) !== title) continue;
        const id = page.id;
        if (typeof id === "string" && id) {
          return {
            id,
            url: typeof page.url === "string" ? page.url : undefined,
          };
        }
      }

      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }

    return null;
  }

  async createPageIdempotent(
    input: NotionCreatePageInput,
    idempotencyKey?: string,
    requestOptions?: RequestOptions
  ): Promise<{ created: boolean; page: NotionPageRef }> {
    if (!idempotencyKey) {
      const page = await this.createPage(input, requestOptions);
      return { created: true, page };
    }

    const marker = `[idem:${idempotencyKey}]`;
    const markedTitle = input.title.includes(marker) ? input.title : `${input.title} ${marker}`;

    const existing = await this.findPageByTitle(input.parentDatabaseId, markedTitle, requestOptions);
    if (existing) {
      return { created: false, page: existing };
    }

    const page = await this.createPage(
      {
        ...input,
        title: markedTitle,
      },
      requestOptions
    );

    return { created: true, page };
  }
}
