import type {QwenModelId} from '../types';

export const QWEN_MODELS = {
  'qwen3-coder-plus': {
    id: 'qwen3-coder-plus',
    name: 'Qwen 3 Coder Plus',
    maxInputTokens: 1_000_000,
    maxOutputTokens: 65_536,
  },
  'qwen3-coder-flash': {
    id: 'qwen3-coder-flash',
    name: 'Qwen 3 Coder Flash',
    maxInputTokens: 1_000_000,
    maxOutputTokens: 65_536,
  },
} as const;

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful coding assistant.';

export function resolveModelId(modelId: string, fallbackModel: string): QwenModelId {
  if (modelId === 'qwen3-coder-plus' || modelId === 'qwen3-coder-flash') {
    return modelId;
  }

  if (fallbackModel === 'qwen3-coder-plus' || fallbackModel === 'qwen3-coder-flash') {
    return fallbackModel;
  }

  return 'qwen3-coder-flash';
}