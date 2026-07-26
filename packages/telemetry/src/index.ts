// Helmies Studio — Observability Service
// Sections 140-142: Structured logging, metrics, cost anomaly detection

// ============================================================
// Structured event logger
// ============================================================

export interface StructuredEvent {
  event: string;
  requestId?: string;
  platformUserId?: string;
  agentUserId?: string;
  jobId?: string;
  parentJobId?: string;
  capability?: string;
  modelId?: string;
  providerId?: string;
  quoteId?: string;
  routeKey?: string;
  status?: string;
  latencyMs?: number;
  credits?: number;
  providerCost?: number;
  error?: string;
  safeError?: string;
  stage?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const eventBuffer: StructuredEvent[] = [];
const MAX_BUFFER_SIZE = 1000;

export function logEvent(event: Omit<StructuredEvent, "timestamp">): void {
  const fullEvent: StructuredEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  eventBuffer.push(fullEvent);
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.splice(0, eventBuffer.length - MAX_BUFFER_SIZE);
  }

  // Console output (structured JSON in production)
  if (process.env.NODE_ENV === "production") {
    console.log(JSON.stringify(fullEvent));
  } else {
    const level = event.status === "failed" ? "error" : event.status === "completed" ? "info" : "debug";
    console[level](
      `[${fullEvent.event}] ${fullEvent.capability || ""} ${fullEvent.status || ""} ${fullEvent.latencyMs ? `(${fullEvent.latencyMs}ms)` : ""}`,
    );
  }
}

// ============================================================
// Specific event loggers
// ============================================================

export function logGenerationRequested(
  requestId: string,
  userId: string,
  capability: string,
  modelId: string,
  estimatedCredits: number,
): void {
  logEvent({
    event: "generation.requested",
    requestId,
    platformUserId: userId,
    capability,
    modelId,
    credits: estimatedCredits,
  });
}

export function logGenerationStarted(jobId: string, userId: string): void {
  logEvent({
    event: "generation.started",
    jobId,
    platformUserId: userId,
    status: "processing",
  });
}

export function logGenerationCompleted(
  jobId: string,
  userId: string,
  capability: string,
  modelId: string,
  providerId: string,
  latencyMs: number,
  credits: number,
  providerCost: number,
): void {
  logEvent({
    event: "generation.completed",
    jobId,
    platformUserId: userId,
    capability,
    modelId,
    providerId,
    latencyMs,
    credits,
    providerCost,
    status: "completed",
  });
}

export function logGenerationFailed(
  jobId: string,
  userId: string,
  capability: string,
  modelId: string,
  providerId: string,
  error: string,
  safeError: string,
): void {
  logEvent({
    event: "generation.failed",
    jobId,
    platformUserId: userId,
    capability,
    modelId,
    providerId,
    error,
    safeError,
    status: "failed",
  });
}

export function logQuoteGenerated(
  quoteId: string,
  userId: string,
  modelId: string,
  credits: number,
  balance: number,
): void {
  logEvent({
    event: "quote.generated",
    quoteId,
    platformUserId: userId,
    modelId,
    credits,
    metadata: { balance },
  });
}

export function logCreditTransaction(
  userId: string,
  type: string,
  delta: number,
  balanceAfter: number,
): void {
  logEvent({
    event: "credit.transaction",
    platformUserId: userId,
    metadata: { type, delta, balanceAfter },
  });
}

export function logAdminAction(
  adminId: string,
  action: string,
  resource: string,
  resourceId?: string,
): void {
  logEvent({
    event: "admin.action",
    platformUserId: adminId,
    metadata: { action, resource, resourceId },
  });
}

export function logProviderError(
  providerId: string,
  modelId: string,
  errorType: string,
  jobId?: string,
): void {
  logEvent({
    event: "provider.error",
    providerId,
    modelId,
    jobId,
    safeError: errorType,
  });
}

// ============================================================
// Metrics aggregator
// ============================================================

interface MetricsSnapshot {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalProviderCost: number;
  totalRetailCredits: number;
  totalGrossMargin: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  activeJobs: number;
  queuedJobs: number;
  provider429Count: number;
}

const latencySamples: number[] = [];
const MAX_LATENCY_SAMPLES = 10000;

export function recordLatency(ms: number): void {
  latencySamples.push(ms);
  if (latencySamples.length > MAX_LATENCY_SAMPLES) {
    latencySamples.splice(0, latencySamples.length - MAX_LATENCY_SAMPLES);
  }
}

export function getMetrics(): MetricsSnapshot {
  const sorted = [...latencySamples].sort((a, b) => a - b);

  const p50 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] : 0;
  const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
  const p99 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] : 0;

  // Aggregated from recent events
  const recentEvents = eventBuffer.filter(
    (e) => Date.now() - new Date(e.timestamp).getTime() < 300_000, // Last 5 min
  );

  const requests = recentEvents.filter((e) => e.event === "generation.started");
  const successes = recentEvents.filter((e) => e.event === "generation.completed");
  const failures = recentEvents.filter((e) => e.event === "generation.failed");
  const providerErrors = recentEvents.filter((e) => e.event === "provider.error");

  return {
    totalRequests: requests.length,
    successfulRequests: successes.length,
    failedRequests: failures.length,
    totalProviderCost: successes.reduce((s, e) => s + (e.providerCost || 0), 0),
    totalRetailCredits: successes.reduce((s, e) => s + (e.credits || 0), 0),
    totalGrossMargin: 0, // Calculated from cost vs revenue
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    p99LatencyMs: p99,
    activeJobs: recentEvents.filter((e) => e.status === "processing").length,
    queuedJobs: recentEvents.filter((e) => e.status === "queued").length,
    provider429Count: providerErrors.filter((e) => e.safeError === "429").length,
  };
}

// ============================================================
// Cost anomaly detection (Section 142)
// ============================================================

interface CostRecord {
  modelId: string;
  providerCost: number;
  timestamp: number;
}

const costHistory: CostRecord[] = [];
const MAX_COST_RECORDS = 1000;

export function recordProviderCost(modelId: string, cost: number): void {
  costHistory.push({ modelId, providerCost: cost, timestamp: Date.now() });
  if (costHistory.length > MAX_COST_RECORDS) {
    costHistory.splice(0, costHistory.length - MAX_COST_RECORDS);
  }

  // Check for anomaly
  checkCostAnomaly(modelId, cost);
}

function checkCostAnomaly(modelId: string, newCost: number): void {
  const modelHistory = costHistory.filter(
    (r) => r.modelId === modelId && Date.now() - r.timestamp < 3600_000, // Last hour
  );

  if (modelHistory.length < 5) return; // Need enough data

  const avg = modelHistory.reduce((s, r) => s + r.providerCost, 0) / modelHistory.length;
  const variance = modelHistory.reduce((s, r) => s + Math.pow(r.providerCost - avg, 2), 0) / modelHistory.length;
  const stdDev = Math.sqrt(variance);

  const deviation = (newCost - avg) / (stdDev || 0.01);

  if (Math.abs(deviation) > 3) {
    console.warn(
      `[cost-anomaly] Model ${modelId}: cost ${newCost.toFixed(4)} is ${deviation.toFixed(1)}σ from avg ${avg.toFixed(4)}`,
    );
    logEvent({
      event: "cost.anomaly",
      modelId,
      metadata: {
        newCost,
        avgCost: avg,
        stdDev,
        deviationSigma: deviation,
        sampleSize: modelHistory.length,
      },
    });
  }
}

// ============================================================
// Health check endpoint data
// ============================================================

export function getHealthStatus(): {
  status: "healthy" | "degraded" | "unhealthy";
  uptimeSec: number;
  metrics: MetricsSnapshot;
} {
  const metrics = getMetrics();
  const failureRate = metrics.totalRequests > 0
    ? metrics.failedRequests / metrics.totalRequests
    : 0;

  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (failureRate > 0.2) status = "unhealthy";
  else if (failureRate > 0.1) status = "degraded";

  return {
    status,
    uptimeSec: process.uptime(),
    metrics,
  };
}
