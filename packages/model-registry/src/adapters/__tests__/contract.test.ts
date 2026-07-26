// Helmies Studio — Provider Adapter Contract Tests
// Section 144: Each provider adapter must pass these contract tests.
// Detects breaking API changes early.

import { describe, it, expect } from "vitest";
import {
  wavespeedAdapter,
  atlasAdapter,
  alibabaAdapter,
  openaiAdapter,
  googleAdapter,
  type NormalizedGenerationRequest,
} from "./index";

// ============================================================
// Test fixtures
// ============================================================

const BASE_IMAGE_REQUEST: NormalizedGenerationRequest = {
  prompt: "A red apple on a wooden table, product photography",
  negativePrompt: "blurry, low quality",
  references: [],
  aspectRatio: "1:1",
  resolution: "1024x1024",
};

const BASE_VIDEO_REQUEST: NormalizedGenerationRequest = {
  prompt: "A person walking through a forest, cinematic",
  negativePrompt: "distorted, low quality",
  references: [],
  aspectRatio: "16:9",
  durationSec: 5,
  resolution: "1080p",
};

const API_KEY = "test-key-12345";
const BASE_URL = "https://api.example.com";

// ============================================================
// WaveSpeed Adapter Tests
// ============================================================

describe("WaveSpeed Adapter", () => {
  it("builds correct image generation request", () => {
    const req = wavespeedAdapter.buildRequest("flux-dev-image", BASE_IMAGE_REQUEST, API_KEY, BASE_URL);

    expect(req.method).toBe("POST");
    expect(req.url).toContain("/api/v3/flux-dev-image");
    expect(req.headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(req.body.model).toBe("flux-dev-image");
    expect(req.body.prompt).toBe(BASE_IMAGE_REQUEST.prompt);
    expect(req.body.negative_prompt).toBe(BASE_IMAGE_REQUEST.negativePrompt);
    expect(req.body.aspect_ratio).toBe("1:1");
    expect(req.isAsync).toBe(true);
    expect(req.maxPollAttempts).toBeGreaterThan(0);
  });

  it("builds correct video generation request", () => {
    const req = wavespeedAdapter.buildRequest("kling-v3", BASE_VIDEO_REQUEST, API_KEY, BASE_URL);

    expect(req.body.duration).toBe(5);
    expect(req.body.aspect_ratio).toBe("16:9");
    expect(req.isAsync).toBe(true);
  });

  it("includes references when provided", () => {
    const withRefs: NormalizedGenerationRequest = {
      ...BASE_IMAGE_REQUEST,
      references: ["asset_1", "asset_2"],
    };
    const req = wavespeedAdapter.buildRequest("flux-2-dev", withRefs, API_KEY, BASE_URL);

    expect(req.body.image_list).toEqual(["asset_1", "asset_2"]);
  });

  it("parses successful response", () => {
    const response = {
      id: "pred_123",
      status: "succeeded",
      output: "https://cdn.example.com/image.png",
    };

    const parsed = wavespeedAdapter.parseResponse(response);
    expect(parsed.requestId).toBe("pred_123");
    expect(parsed.status).toBe("completed");
    expect(parsed.outputUrl).toBe("https://cdn.example.com/image.png");
  });

  it("parses failed response", () => {
    const response = {
      id: "pred_456",
      status: "failed",
      error: "Content filter triggered",
    };

    const parsed = wavespeedAdapter.parseResponse(response);
    expect(parsed.status).toBe("failed");
    expect(parsed.error).toBe("Content filter triggered");
  });

  it("parses processing poll response", () => {
    const response = {
      status: "processing",
      progress: 0.45,
    };

    const parsed = wavespeedAdapter.parsePollResponse(response);
    expect(parsed.status).toBe("processing");
    expect(parsed.progress).toBe(0.45);
  });
});

// ============================================================
// Atlas Adapter Tests
// ============================================================

describe("Atlas Adapter", () => {
  it("maps references to images field", () => {
    const withRefs: NormalizedGenerationRequest = {
      ...BASE_IMAGE_REQUEST,
      references: ["ref_a"],
    };
    const req = atlasAdapter.buildRequest("flux-dev-image", withRefs, API_KEY, BASE_URL);

    expect(req.body.images).toEqual(["ref_a"]);
  });

  it("uses /api/v1/ path prefix", () => {
    const req = atlasAdapter.buildRequest("test-model", BASE_IMAGE_REQUEST, API_KEY, BASE_URL);

    expect(req.url).toContain("/api/v1/test-model");
  });
});

// ============================================================
// Alibaba Adapter Tests
// ============================================================

describe("Alibaba Adapter", () => {
  it("builds LLM chat completion for qwen models", () => {
    const req = alibabaAdapter.buildRequest("qwen-2.5-72b-instruct", {
      ...BASE_IMAGE_REQUEST,
      prompt: "Hello, how are you?",
    }, API_KEY, BASE_URL);

    expect(req.url).toContain("/chat/completions");
    expect(req.body.messages[0].content).toBe("Hello, how are you?");
    expect(req.isAsync).toBe(false);
  });

  it("builds async image generation for multimodal models", () => {
    const req = alibabaAdapter.buildRequest("qwen-image", BASE_IMAGE_REQUEST, API_KEY, BASE_URL);

    expect(req.isAsync).toBe(true);
    expect(req.headers["X-DashScope-Async"]).toBe("enable");
  });

  it("parses DashScope task response", () => {
    const response = {
      request_id: "req_789",
      output: {
        task_status: "SUCCEEDED",
        results: [{ url: "https://dashscope.aliyuncs.com/result.png" }],
      },
    };

    const parsed = alibabaAdapter.parseResponse(response);
    expect(parsed.requestId).toBe("req_789");
    expect(parsed.status).toBe("completed");
    expect(parsed.outputUrl).toBe("https://dashscope.aliyuncs.com/result.png");
  });
});

// ============================================================
// OpenAI Adapter Tests
// ============================================================

describe("OpenAI Adapter", () => {
  it("maps aspect ratio to size for image generation", () => {
    const req = openaiAdapter.buildRequest("gpt4o-text-to-image", {
      ...BASE_IMAGE_REQUEST,
      aspectRatio: "16:9",
    }, API_KEY, BASE_URL);

    expect(req.body.size).toBe("1792x1024");
  });

  it("uses video endpoint for Sora", () => {
    const req = openaiAdapter.buildRequest("sora-2", BASE_VIDEO_REQUEST, API_KEY, BASE_URL);

    expect(req.url).toContain("/video/generations");
    expect(req.body.duration).toBe(5);
    expect(req.isAsync).toBe(true);
  });

  it("parses image response with data array", () => {
    const response = {
      id: "img_001",
      data: [{ url: "https://cdn.openai.com/img.png" }],
    };

    const parsed = openaiAdapter.parseResponse(response);
    expect(parsed.outputUrl).toBe("https://cdn.openai.com/img.png");
  });
});

// ============================================================
// Google Adapter Tests
// ============================================================

describe("Google Adapter", () => {
  it("uses Vertex AI predict format", () => {
    const req = googleAdapter.buildRequest("google-imagen4", BASE_IMAGE_REQUEST, API_KEY, BASE_URL);

    expect(req.url).toContain(":predict");
    expect(req.body.instances[0].prompt).toBe(BASE_IMAGE_REQUEST.prompt);
    expect(req.body.parameters.aspectRatio).toBe("1:1");
  });

  it("handles base64 encoded responses", () => {
    const response = {
      predictions: [{
        bytesBase64Encoded: "iVBORw0KGgo...",
      }],
    };

    const parsed = googleAdapter.parseResponse(response);
    expect(parsed.outputUrl).toContain("data:image/png;base64,");
  });
});

// ============================================================
// Adapter Registry Tests
// ============================================================

describe("Adapter Registry", () => {
  it("returns adapter for known providers", () => {
    const { getAdapter } = require("./index");
    expect(() => getAdapter("wavespeed")).not.toThrow();
    expect(() => getAdapter("atlas")).not.toThrow();
    expect(() => getAdapter("openai")).not.toThrow();
  });

  it("throws for unknown providers", () => {
    const { getAdapter } = require("./index");
    expect(() => getAdapter("unknown_provider_xyz")).toThrow();
  });

  it("is case-insensitive", () => {
    const { getAdapter } = require("./index");
    expect(() => getAdapter("WAVESPEED")).not.toThrow();
    expect(() => getAdapter("OpenAI")).not.toThrow();
  });
});
