---
description: "Use when: working on this VS Code extension that integrates Qwen Code models with VS Code Copilot chat via OAuth authentication"
applyTo: "**/*"
---

# Qwen Copilot Extension

A VS Code extension that provides Qwen Code AI models as a chat provider for VS Code Copilot.

## Project Overview

- **Type**: VS Code extension (TypeScript)
- **Language**: TypeScript with strict mode
- **Build**: esbuild
- **Testing**: Mocha
- **Linting**: ESLint with @stylistic plugin

## Build & Test Commands

```bash
# Compile TypeScript
npm run compile

# Package extension (VSIX)
npm run package

# Run tests
npm test
```

## Architecture

```
src/
├── extension.ts       # Entry point, registers provider & commands
├── types.ts           # Shared TypeScript interfaces
├── auth/              # OAuth authentication (device flow, PKCE, refresh)
├── client/            # OpenAI-compatible API client for Qwen
├── provider/          # VS Code LanguageModelChatProvider implementation
└── extension/         # Commands (CLI, reasoning, error handling)
```

### Key Components

- **AuthManager** (`auth/auth.ts`): Handles OAuth login, token refresh, session management
- **QwenClient** (`client/qwenClient.ts`): Streaming chat completion with retry logic
- **QwenLanguageModelChatProvider** (`provider/provider.ts`): Implements VS Code's chat provider API

### Authentication Flow

1. Uses OAuth device flow with PKCE for secure authentication
2. Stores tokens in VS Code secret storage
3. Auto-refreshes tokens before expiration
4. Supports logout and re-authentication

## Conventions

- **Strict TypeScript**: All types enabled, no implicit any
- **ESLint**: Configured with complexity limits and stylistic rules
- **Error Handling**: Use `runWithUiError` wrapper for commands
- **OAuth**: Custom implementation using device flow + PKCE (not using Microsoft's vscode-azureaccount)

## Dependencies

- `openai`: OpenAI-compatible API client
- `vscode`: VS Code extension API

## Key Files

- `package.json`: Extension manifest, commands, configuration
- `src/extension.ts`: Activation/deactivation, command registration
- `src/provider/provider.ts`: Chat provider implementation
- `src/auth/auth.ts`: Authentication manager
- `src/types.ts`: TypeScript interfaces for auth, messages, tools, stream events