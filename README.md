# `@ubiquity-os/daemon-task-matcher`

The purpose of this plugin is to match issues against pull-requests. It will suggest a list of different issues that
would be a good fit, and the user can select 1 or more that will get linked.

## Prerequisites

- copy the `.env.example` to `.env` and populate the required values

## Getting Started

1. `bun install`
2. `bun run dev`

## Configuration

```yml
plugins:
  http://localhost:4000:
    with:
      confidenceThreshold: 0.5
      maxSuggestions: 5
      requirePriceLabel: true
      maxIssuesPerLlmCall: 40
      # optional: use OpenRouter via OpenAI SDK instead of callLlm
      openRouter:
        endpoint: "https://openrouter.ai/api/v1"
        model: "openai/gpt-4o-mini"
```
