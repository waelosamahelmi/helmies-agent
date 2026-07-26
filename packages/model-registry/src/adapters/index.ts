// Helmies Studio — Provider Adapters
// Section 60: Translates normalized requests to provider-native formats.
// The UI never needs provider parameter names. All translation lives here.

// ============================================================
// Normalized request (what the platform sends)
// ============================================================

export interface NormalizedGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  references: string[]; // Asset IDs
  aspectRatio: string; // "16:9", "9:16", "1:1"
  resolution?: string; // "720p", "1080p", "2k", "4k"
  durationSec?: number;
  seed?: number;
  width?: number;
  height?: number;
  imageCount?: number;
  audioSource?: string; // Asset ID for audio input
  videoSource?: string; // Asset ID for video input
  maskSource?: string; // Asset ID for mask
  firstFrameSource?: string; // Asset ID
  lastFrameSource?: string; // Asset ID
  voice?: string;
  speed?: number;
  characters?: number; // For TTS
  extraParams?: Record<string, unknown>;
}

// ============================================================
// Provider-specific request shapes
// ============================================================

export interface ProviderRequest {
  url: string;
  method: "POST" | "GET";
  headers: Record<string, string>;
  body: Record<string, unknown>;
  isAsync: boolean; // true = poll for result, false = sync response
  pollUrl?: string;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

// ============================================================
// Adapter interface
// ============================================================

export interface ProviderAdapter {
  readonly providerKey: string;
  buildRequest(
    modelKey: string,
    normalized: NormalizedGenerationRequest,
    apiKey: string,
    baseUrl: string,
  ): ProviderRequest;
  parseResponse(response: unknown): {
    outputUrl?: string;
    requestId?: string;
    status: "completed" | "processing" | "failed";
    error?: string;
  };
  parsePollResponse(response: unknown): {
    outputUrl?: string;
    status: "completed" | "processing" | "failed";
    progress?: number;
    error?: string;
  };
}

// ============================================================
// WaveSpeed Adapter
// ============================================================

export const wavespeedAdapter: ProviderAdapter = {
  providerKey: "wavespeed",

  buildRequest(modelKey, normalized, apiKey, baseUrl) {
    const body: Record<string, unknown> = {
      model: modelKey,
      prompt: normalized.prompt,
    };

    if (normalized.negativePrompt) body.negative_prompt = normalized.negativePrompt;
    if (normalized.aspectRatio) body.aspect_ratio = normalized.aspectRatio;
    if (normalized.resolution) body.resolution = normalized.resolution;
    if (normalized.durationSec) body.duration = normalized.durationSec;
    if (normalized.seed) body.seed = normalized.seed;
    if (normalized.width) body.width = normalized.width;
    if (normalized.height) body.height = normalized.height;
    if (normalized.references.length > 0) body.image_list = normalized.references;
    if (normalized.audioSource) body.audio = normalized.audioSource;
    if (normalized.videoSource) body.video = normalized.videoSource;
    if (normalized.maskSource) body.mask = normalized.maskSource;
    if (normalized.firstFrameSource) body.first_frame = normalized.firstFrameSource;
    if (normalized.lastFrameSource) body.last_frame = normalized.lastFrameSource;
    if (normalized.voice) body.voice = normalized.voice;
    if (normalized.speed) body.speed = normalized.speed;

    return {
      url: `${baseUrl}/api/v3/${modelKey}`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      isAsync: true,
      pollUrl: `${baseUrl}/api/v3/predictions/{requestId}/result`,
      pollIntervalMs: 3000,
      maxPollAttempts: 120, // 6 minutes max
    };
  },

  parseResponse(response: any) {
    return {
      requestId: response?.id || response?.prediction_id,
      status: response?.status === "succeeded" ? "completed"
        : response?.status === "failed" ? "failed"
        : "processing",
      outputUrl: response?.output || response?.outputs?.[0],
      error: response?.error,
    };
  },

  parsePollResponse(response: any) {
    return {
      status: response?.status === "succeeded" ? "completed"
        : response?.status === "failed" ? "failed"
        : "processing",
      outputUrl: response?.output || response?.outputs?.[0],
      progress: response?.progress,
      error: response?.error,
    };
  },
};

// ============================================================
// Atlas Cloud Adapter
// ============================================================

export const atlasAdapter: ProviderAdapter = {
  providerKey: "atlas",

  buildRequest(modelKey, normalized, apiKey, baseUrl) {
    const body: Record<string, unknown> = {
      model: modelKey,
      prompt: normalized.prompt,
    };

    if (normalized.negativePrompt) body.negative_prompt = normalized.negativePrompt;
    if (normalized.aspectRatio) body.aspect_ratio = normalized.aspectRatio;
    if (normalized.durationSec) body.duration = normalized.durationSec;
    if (normalized.seed) body.seed = normalized.seed;
    if (normalized.references.length > 0) body.images = normalized.references;

    return {
      url: `${baseUrl}/api/v1/${modelKey}`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      isAsync: true,
      pollUrl: `${baseUrl}/api/v1/predictions/{requestId}/result`,
      pollIntervalMs: 3000,
      maxPollAttempts: 120,
    };
  },

  parseResponse(response: any) {
    return {
      requestId: response?.id,
      status: response?.output ? "completed" : "processing",
      outputUrl: response?.output,
      error: response?.error,
    };
  },

  parsePollResponse(response: any) {
    return {
      status: response?.output ? "completed"
        : response?.status === "failed" ? "failed"
        : "processing",
      outputUrl: response?.output,
      progress: response?.progress,
      error: response?.error,
    };
  },
};

// ============================================================
// Alibaba/Qwen Adapter
// ============================================================

export const alibabaAdapter: ProviderAdapter = {
  providerKey: "alibaba",

  buildRequest(modelKey, normalized, apiKey, baseUrl) {
    const isLLM = modelKey.includes("qwen") && !modelKey.includes("image") && !modelKey.includes("video");

    if (isLLM) {
      return {
        url: `${baseUrl}/chat/completions`,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: {
          model: modelKey,
          messages: [{ role: "user", content: normalized.prompt }],
          max_tokens: normalized.extraParams?.maxTokens || 4096,
        },
        isAsync: false,
      };
    }

    // Image/video generation
    const body: Record<string, unknown> = {
      model: modelKey,
      input: { prompt: normalized.prompt },
    };

    if (normalized.negativePrompt) body.negative_prompt = normalized.negativePrompt;
    if (normalized.aspectRatio) body.parameters = { aspect_ratio: normalized.aspectRatio };
    if (normalized.durationSec) body.parameters = { ...((body.parameters as Record<string, unknown>) || {}), duration: normalized.durationSec };
    if (normalized.seed) body.parameters = { ...((body.parameters as Record<string, unknown>) || {}), seed: normalized.seed };

    return {
      url: `${baseUrl}/services/aigc/multimodal-generation/generation`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body,
      isAsync: true,
      pollUrl: `${baseUrl}/services/aigc/multimodal-generation/generation/{requestId}/result`,
      pollIntervalMs: 5000,
      maxPollAttempts: 100,
    };
  },

  parseResponse(response: any) {
    const output = response?.output;
    return {
      requestId: response?.request_id,
      status: output?.task_status === "SUCCEEDED" ? "completed"
        : output?.task_status === "FAILED" ? "failed"
        : "processing",
      outputUrl: output?.results?.[0]?.url || output?.choices?.[0]?.message?.content,
      error: output?.message || response?.message,
    };
  },

  parsePollResponse(response: any) {
    const output = response?.output;
    return {
      status: output?.task_status === "SUCCEEDED" ? "completed"
        : output?.task_status === "FAILED" ? "failed"
        : "processing",
      outputUrl: output?.results?.[0]?.url,
      progress: output?.task_progress,
      error: output?.message,
    };
  },
};

// ============================================================
// OpenAI-compatible Adapter (GPT-4o, Sora)
// ============================================================

export const openaiAdapter: ProviderAdapter = {
  providerKey: "openai",

  buildRequest(modelKey, normalized, apiKey, baseUrl) {
    const isImageModel = modelKey.includes("gpt4o") && modelKey.includes("image");
    const isVideoModel = modelKey.includes("sora");

    if (isImageModel) {
      return {
        url: `${baseUrl}/images/generations`,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: {
          model: modelKey,
          prompt: normalized.prompt,
          n: normalized.imageCount || 1,
          size: mapAspectToSize(normalized.aspectRatio),
          response_format: "url",
        },
        isAsync: false,
      };
    }

    if (isVideoModel) {
      return {
        url: `${baseUrl}/video/generations`,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: {
          model: modelKey,
          prompt: normalized.prompt,
          duration: normalized.durationSec || 5,
          size: mapAspectToSize(normalized.aspectRatio),
        },
        isAsync: true,
        pollUrl: `${baseUrl}/video/generations/{requestId}`,
        pollIntervalMs: 5000,
        maxPollAttempts: 100,
      };
    }

    // Chat completions
    return {
      url: `${baseUrl}/chat/completions`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        model: modelKey,
        messages: [{ role: "user", content: normalized.prompt }],
        max_tokens: normalized.extraParams?.maxTokens || 4096,
      },
      isAsync: false,
    };
  },

  parseResponse(response: any) {
    return {
      requestId: response?.id,
      status: "completed",
      outputUrl: response?.data?.[0]?.url
        || response?.output?.[0]
        || response?.choices?.[0]?.message?.content,
      error: response?.error?.message,
    };
  },

  parsePollResponse(response: any) {
    return {
      status: response?.status === "completed" ? "completed"
        : response?.status === "failed" ? "failed"
        : "processing",
      outputUrl: response?.output,
      progress: response?.progress,
      error: response?.error?.message,
    };
  },
};

// ============================================================
// Google/Imagen/Veo Adapter
// ============================================================

export const googleAdapter: ProviderAdapter = {
  providerKey: "google",

  buildRequest(modelKey, normalized, apiKey, baseUrl) {
    const body: Record<string, unknown> = {
      instances: [{
        prompt: normalized.prompt,
      }],
      parameters: {
        sampleCount: normalized.imageCount || 1,
        aspectRatio: normalized.aspectRatio || "1:1",
      },
    };

    if (normalized.negativePrompt) body.parameters = { ...(body.parameters as Record<string, unknown>), negativePrompt: normalized.negativePrompt };
    if (normalized.seed) body.parameters = { ...(body.parameters as Record<string, unknown>), seed: normalized.seed };

    return {
      url: `${baseUrl}/models/${modelKey}:predict`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      isAsync: modelKey.includes("video") || modelKey.includes("veo"),
      pollIntervalMs: 5000,
      maxPollAttempts: 100,
    };
  },

  parseResponse(response: any) {
    return {
      requestId: response?.id,
      status: "completed",
      outputUrl: response?.predictions?.[0]?.bytesBase64Encoded
        ? `data:image/png;base64,${response.predictions[0].bytesBase64Encoded}`
        : response?.predictions?.[0]?.output,
      error: response?.error?.message,
    };
  },

  parsePollResponse(response: any) {
    return {
      status: response?.done ? "completed"
        : response?.state === "FAILED" ? "failed"
        : "processing",
      outputUrl: response?.response?.output,
      progress: response?.metadata?.progress,
      error: response?.error?.message,
    };
  },
};

// ============================================================
// Adapter registry
// ============================================================

const adapterRegistry: Record<string, ProviderAdapter> = {
  wavespeed: wavespeedAdapter,
  atlas: atlasAdapter,
  alibaba: alibabaAdapter,
  openai: openaiAdapter,
  google: googleAdapter,
  // Additional adapters registered as they're built
  midjourney: wavespeedAdapter, // Midjourney through WaveSpeed
  blackforest: wavespeedAdapter, // Flux through WaveSpeed
  bytedance: wavespeedAdapter, // Seedream through WaveSpeed
  kling: wavespeedAdapter, // Kling through WaveSpeed
  runway: wavespeedAdapter,
  minimax: wavespeedAdapter,
  ideogram: wavespeedAdapter,
  stability: wavespeedAdapter,
  hunyuan: alibabaAdapter,
  xai: openaiAdapter,
  leonardo: wavespeedAdapter,
  ltx: wavespeedAdapter,
  sync: wavespeedAdapter,
  latentsync: wavespeedAdapter,
  creatify: wavespeedAdapter,
  veed: wavespeedAdapter,
};

export function getAdapter(providerKey: string): ProviderAdapter {
  const adapter = adapterRegistry[providerKey.toLowerCase()];
  if (!adapter) {
    throw new Error(`No adapter registered for provider: ${providerKey}`);
  }
  return adapter;
}

export function registerAdapter(providerKey: string, adapter: ProviderAdapter): void {
  adapterRegistry[providerKey.toLowerCase()] = adapter;
}

// ============================================================
// Helpers
// ============================================================

function mapAspectToSize(aspect: string): string {
  const map: Record<string, string> = {
    "1:1": "1024x1024",
    "16:9": "1792x1024",
    "9:16": "1024x1792",
    "4:3": "1280x960",
    "3:4": "960x1280",
    "3:2": "1536x1024",
    "2:3": "1024x1536",
  };
  return map[aspect] || "1024x1024";
}
