# Helmies Studio — Agent Integration Guide

## How to Wire First-Party Tools into the LibreChat Agent Runtime

The Helmies Agent (LibreChat-based) needs to integrate with the commercial platform
for credit-aware, Gateway-backed creative operations.

### Architecture

```
Agent Runtime (LibreChat)
    │
    ├─ helmies.list_models ──────→ platform-api GET /api/generate/models
    ├─ helmies.quote_generation ──→ platform-api POST /api/pricing/quote
    ├─ helmies.generate_image ───→ platform-api POST /api/generate/create
    ├─ helmies.analyze_image ────→ vision-service POST /analyze
    ├─ helmies.get_brand_kit ────→ platform-api GET /api/assets?type=brand
    ├─ helmies.create_director ──→ director-service planProduction()
    └─ helmies.get_job ──────────→ platform-api GET /api/generate/job/:id
```

### Step 1: Agent Commercial Context

At the start of every agent request, resolve the platform user context:

```typescript
// In agent request handler (api/server/controllers/agents/client.js)
const platformContext = await fetch("http://platform-api:3004/api/identity/agent-context", {
  headers: {
    "Authorization": `Bearer ${agentUserAccessToken}`,
    "X-Agent-User-Id": agentUserId,
  },
}).then(r => r.json());

// Attach to agent tool execution context
agentContext.platform = {
  userId: platformContext.platformUserId,
  plan: platformContext.plan,
  walletAvailable: platformContext.walletAvailable,
  features: platformContext.features,
};
```

### Step 2: Register First-Party Tools

Add Helmies tools to the LibreChat tool registry:

```typescript
// In the tool registration system
import { HelmiesToolNames } from "@helmies/contracts/tools";

for (const toolName of HelmiesToolNames) {
  registerTool({
    name: toolName,
    description: getToolDescription(toolName),
    parameters: getToolParams(toolName),
    handler: createHelmiesToolHandler(toolName),
  });
}
```

### Step 3: Tool Handler Pattern

Each tool handler follows the same pattern:

```typescript
async function createHelmiesToolHandler(toolName: string) {
  return async (params: unknown, context: AgentContext) => {
    // 1. Validate platform context
    if (!context.platform?.userId) {
      return { success: false, error: "Platform user not linked" };
    }

    // 2. Call platform API
    const response = await fetch(`http://platform-api:3004/api/${getApiPath(toolName)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${context.platform.token}`,
      },
      body: JSON.stringify({
        ...params,
        platformUserId: context.platform.userId,
      }),
    });

    // 3. Return structured result
    const result = await response.json();
    return {
      success: response.ok,
      ...result,
    };
  };
}
```

### Step 4: Subagent Definitions

Register creative subagents using the existing LibreChat subagent system:

```yaml
# Creative Director subagent
name: "creative-director"
systemPrompt: |
  You are a Creative Director for Helmies Studio.
  You interpret creative briefs and plan visual productions.
  Available tools: helmies.list_models, helmies.get_brand_kit, helmies.analyze_image

# Image Director subagent
name: "image-director"
systemPrompt: |
  You are an Image Director. You plan and execute image generation.
  Tools: helmies.generate_image, helmies.edit_image, helmies.quote_generation

# Brand Guardian subagent
name: "brand-guardian"
systemPrompt: |
  You enforce brand consistency across all creative outputs.
  Tools: helmies.get_brand_kit, helmies.analyze_image
```

### Step 5: Cost Approval Flow

When the Master Agent creates a multi-step plan:

```typescript
// Agent creates plan
const plan = {
  id: "plan_123",
  steps: [
    { kind: "image.generate", estimatedCredits: 140 },
    { kind: "video.generate", estimatedCredits: 520 },
  ],
};

// Agent requests quote approval
// Platform shows:
//   Expected: 660 credits
//   Maximum: 760 credits
//   Balance: 3,250 → 2,590 after

// User approves → Agent executes steps sequentially
// Each step calls helmies.generate_* tool
// Each tool reserves and settles credits via platform API
```

### Step 6: Agent Tool Result Cards

Generated media appears as tool result cards in the chat:

```json
{
  "toolName": "helmies.generate_image",
  "result": {
    "jobId": "job_abc123",
    "status": "completed",
    "assets": [{
      "id": "asset_xyz",
      "type": "image",
      "thumbnailUrl": "/api/assets/asset_xyz/thumbnail",
      "url": "/api/assets/asset_xyz/full"
    }],
    "creditsUsed": 140
  }
}
```

### Important Rules

1. **Never expose provider secrets** — tools call platform API, not providers directly
2. **Always validate ownership** — platform API checks userId against asset/job ownership
3. **Never hardcode credits** — all pricing comes from platform quote endpoint
4. **Stream responsibly** — use existing LibreChat SSE infrastructure for job progress
5. **Reuse existing runtime** — don't rebuild the agent runtime; extend it
