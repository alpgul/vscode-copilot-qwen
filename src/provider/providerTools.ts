import * as vscode from 'vscode';
import type {QwenTool, QwenToolChoice} from '../types';

export function convertTools(
  tools: readonly vscode.LanguageModelChatTool[] | undefined,
): QwenTool[] | undefined {
  if (!tools?.length) {
    return undefined;
  }

  return tools.map((tool, index) => ({
    type: 'function',
    function: {
      name: sanitizeToolName(tool.name || `tool_${index}`),
      description: tool.description || '',
      parameters: normalizeToolSchema(tool.inputSchema),
    },
  }));
}

export function normalizeToolSchema(
  schema: unknown,
): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return undefined;
  }

  return schema as Record<string, unknown>;
}

export function sanitizeToolName(name: string): string {
  let normalized = name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) {
    normalized = 'tool';
  }

  if (!/^[a-zA-Z]/.test(normalized)) {
    normalized = `tool_${normalized}`;
  }

  if (normalized.length > 64) {
    normalized = normalized.slice(0, 64);
  }

  return normalized;
}

export function resolveToolChoice(tools?: QwenTool[]): QwenToolChoice | undefined {
  if (!tools?.length) {
    return undefined;
  }

  return 'auto';
}