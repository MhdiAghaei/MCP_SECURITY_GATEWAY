interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const WINDOW_MS = readPositiveInteger(
  process.env.MCP_RATE_LIMIT_WINDOW_MS,
  10_000,
);

const MAX_REQUESTS = readPositiveInteger(
  process.env.MCP_RATE_LIMIT_MAX_REQUESTS,
  5,
);

const requestStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(clientId: string): RateLimitResult {
  const now = Date.now();

  const current = requestStore.get(clientId);

  if (!current || now - current.windowStartedAt >= WINDOW_MS) {
    requestStore.set(clientId, {
      count: 1,
      windowStartedAt: now,
    });

    return {
      allowed: true,
      remaining: MAX_REQUESTS - 1,
      retryAfterMs: 0,
    };
  }

  if (current.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,

      retryAfterMs: Math.max(0, WINDOW_MS - (now - current.windowStartedAt)),
    };
  }

  current.count += 1;

  return {
    allowed: true,

    remaining: MAX_REQUESTS - current.count,

    retryAfterMs: 0,
  };
}
