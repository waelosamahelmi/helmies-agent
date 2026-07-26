// Helmies Studio — Circuit Breaker & Provider Health
// Section 129, 143, 210: Rolling success/failure tracking, automatic route adjustment,
// provider diagnostics, and health-based model deactivation.

// ============================================================
// Circuit state
// ============================================================

export type CircuitState = "closed" | "open" | "half_open";

interface CircuitWindow {
  requests: number;
  successes: number;
  failures: number;
  timeouts: number;
  rate429s: number;
  latencySamples: number[];
  windowStartMs: number;
}

interface CircuitConfig {
  failureThreshold: number; // % failures to open circuit (0-1)
  successThreshold: number; // consecutive successes to close (half_open → closed)
  windowDurationMs: number; // rolling window size
  halfOpenAfterMs: number; // time before trying half_open
  halfOpenMaxRequests: number; // max probes in half_open
  minRequestsToTrip: number; // min requests before circuit can trip
}

const DEFAULT_CONFIG: CircuitConfig = {
  failureThreshold: 0.5, // 50% failure rate opens circuit
  successThreshold: 3, // 3 consecutive successes to close
  windowDurationMs: 60_000, // 1 minute window
  halfOpenAfterMs: 30_000, // try again after 30s
  halfOpenMaxRequests: 3, // max 3 probe requests
  minRequestsToTrip: 5, // need at least 5 requests before tripping
};

// ============================================================
// In-memory circuit store (Redis-backed in production)
// ============================================================

const circuits = new Map<string, CircuitWindow>();
const circuitStates = new Map<string, CircuitState>();
const halfOpenCounters = new Map<string, { successes: number; requests: number }>();
const circuitOpenTimers = new Map<string, NodeJS.Timeout>();

function getCircuitKey(providerKey: string, modelKey?: string): string {
  return modelKey ? `${providerKey}:${modelKey}` : providerKey;
}

// ============================================================
// Request recording
// ============================================================

export function recordSuccess(
  providerKey: string,
  modelKey?: string,
  latencyMs?: number,
): void {
  const key = getCircuitKey(providerKey, modelKey);
  const now = Date.now();
  let window = circuits.get(key);

  if (!window || now - window.windowStartMs > DEFAULT_CONFIG.windowDurationMs) {
    window = {
      requests: 0,
      successes: 0,
      failures: 0,
      timeouts: 0,
      rate429s: 0,
      latencySamples: [],
      windowStartMs: now,
    };
  }

  window.requests++;
  window.successes++;
  if (latencyMs !== undefined) {
    window.latencySamples.push(latencyMs);
  }
  circuits.set(key, window);

  // Half-open: track consecutive successes
  const state = circuitStates.get(key);
  if (state === "half_open") {
    const counter = halfOpenCounters.get(key) || { successes: 0, requests: 0 };
    counter.successes++;
    counter.requests++;
    halfOpenCounters.set(key, counter);

    if (counter.successes >= DEFAULT_CONFIG.successThreshold) {
      closeCircuit(key);
    }
  }
}

export function recordFailure(
  providerKey: string,
  modelKey?: string,
  errorType: "5xx" | "timeout" | "429" | "other" = "5xx",
): void {
  const key = getCircuitKey(providerKey, modelKey);
  const now = Date.now();
  let window = circuits.get(key);

  if (!window || now - window.windowStartMs > DEFAULT_CONFIG.windowDurationMs) {
    window = {
      requests: 0,
      successes: 0,
      failures: 0,
      timeouts: 0,
      rate429s: 0,
      latencySamples: [],
      windowStartMs: now,
    };
  }

  window.requests++;
  window.failures++;
  if (errorType === "timeout") window.timeouts++;
  if (errorType === "429") window.rate429s++;

  circuits.set(key, window);

  // Check if circuit should open
  checkCircuitHealth(key, window);
}

function checkCircuitHealth(key: string, window: CircuitWindow): void {
  if (window.requests < DEFAULT_CONFIG.minRequestsToTrip) return;

  const failureRate = window.failures / window.requests;
  const currentState = circuitStates.get(key) || "closed";

  if (currentState === "closed" && failureRate >= DEFAULT_CONFIG.failureThreshold) {
    openCircuit(key);
  }
}

function openCircuit(key: string): void {
  circuitStates.set(key, "open");
  console.warn(`[circuit-breaker] Circuit OPEN for ${key}`);

  // Schedule half-open attempt
  const existing = circuitOpenTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    circuitStates.set(key, "half_open");
    halfOpenCounters.set(key, { successes: 0, requests: 0 });
    console.log(`[circuit-breaker] Circuit HALF_OPEN for ${key}`);
  }, DEFAULT_CONFIG.halfOpenAfterMs);

  circuitOpenTimers.set(key, timer);
}

function closeCircuit(key: string): void {
  circuitStates.set(key, "closed");
  halfOpenCounters.delete(key);
  console.log(`[circuit-breaker] Circuit CLOSED for ${key}`);
}

// ============================================================
// Health queries
// ============================================================

export function isCircuitOpen(providerKey: string, modelKey?: string): boolean {
  const key = getCircuitKey(providerKey, modelKey);
  const state = circuitStates.get(key) || "closed";

  if (state === "open") return true;
  if (state === "half_open") {
    const counter = halfOpenCounters.get(key) || { successes: 0, requests: 0 };
    return counter.requests >= DEFAULT_CONFIG.halfOpenMaxRequests;
  }
  return false;
}

export function getProviderHealth(providerKey: string): {
  status: "healthy" | "degraded" | "unhealthy";
  circuitState: CircuitState;
  successRate: number;
  avgLatencyMs: number;
  rate429Rate: number;
  timeoutRate: number;
  requestCount: number;
} {
  const key = getCircuitKey(providerKey);
  const window = circuits.get(key);
  const state = circuitStates.get(key) || "closed";

  if (!window || window.requests === 0) {
    return {
      status: "healthy",
      circuitState: state,
      successRate: 1,
      avgLatencyMs: 0,
      rate429Rate: 0,
      timeoutRate: 0,
      requestCount: 0,
    };
  }

  const successRate = window.successes / window.requests;
  const avgLatency = window.latencySamples.length > 0
    ? window.latencySamples.reduce((a, b) => a + b, 0) / window.latencySamples.length
    : 0;

  let status: "healthy" | "degraded" | "unhealthy";
  if (state === "open") {
    status = "unhealthy";
  } else if (successRate < 0.9 || window.rate429s / window.requests > 0.1) {
    status = "degraded";
  } else {
    status = "healthy";
  }

  return {
    status,
    circuitState: state,
    successRate: Math.round(successRate * 1000) / 1000,
    avgLatencyMs: Math.round(avgLatency),
    rate429Rate: Math.round((window.rate429s / window.requests) * 1000) / 1000,
    timeoutRate: Math.round((window.timeouts / window.requests) * 1000) / 1000,
    requestCount: window.requests,
  };
}

// ============================================================
// Route health-based adjustment
// ============================================================

export function shouldLowerRoutePriority(providerKey: string): boolean {
  const health = getProviderHealth(providerKey);
  return health.status === "unhealthy" || health.status === "degraded";
}

// ============================================================
// Provider diagnostics (Section 143)
// ============================================================

export interface ProviderDiagnosticResult {
  test: string;
  passed: boolean;
  latencyMs: number;
  error?: string;
}

export async function runProviderDiagnostics(
  providerKey: string,
  apiKey: string,
  baseUrl: string,
): Promise<ProviderDiagnosticResult[]> {
  const results: ProviderDiagnosticResult[] = [];

  // Test 1: Auth check
  try {
    const start = Date.now();
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    results.push({
      test: "auth",
      passed: response.ok || response.status === 404, // 404 is fine if no health endpoint
      latencyMs: Date.now() - start,
    });
  } catch (e: any) {
    results.push({
      test: "auth",
      passed: false,
      latencyMs: 0,
      error: e.message,
    });
  }

  // Test 2: Simple chat completion (if LLM provider)
  try {
    const start = Date.now();
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "test",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(10000),
    });
    results.push({
      test: "chat_completion",
      passed: response.ok,
      latencyMs: Date.now() - start,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    });
  } catch (e: any) {
    results.push({
      test: "chat_completion",
      passed: false,
      latencyMs: 0,
      error: e.message,
    });
  }

  return results;
}

// ============================================================
// Periodic cleanup
// ============================================================

setInterval(() => {
  const now = Date.now();
  for (const [key, window] of circuits.entries()) {
    if (now - window.windowStartMs > DEFAULT_CONFIG.windowDurationMs * 3) {
      circuits.delete(key);
    }
  }
}, 60_000);
