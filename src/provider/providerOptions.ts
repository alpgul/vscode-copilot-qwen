import * as vscode from 'vscode';
import type {QwenReasoningConfig, ReasoningMode} from '../types';

type ModelOptions = Readonly<Record<string, unknown>>;
const MAX_REASONING_BUDGET = 65_536;

export function resolveMaxTokens(
  model: vscode.LanguageModelChatInformation,
  options: ModelOptions | undefined,
): number | undefined {
  const candidate = options?.maxOutputTokens;
  if (typeof candidate !== 'number' || candidate <= 0) {
    return undefined;
  }

  return Math.min(Math.floor(candidate), model.maxOutputTokens);
}

export function resolveTemperature(options: ModelOptions | undefined): number | undefined {
  const candidate = options?.temperature;
  if (typeof candidate !== 'number') {
    return undefined;
  }

  if (candidate < 0 || candidate >= 2) {
    return undefined;
  }

  return candidate;
}

export function isAbortError(
  error: unknown,
  token: vscode.CancellationToken,
): boolean {
  if (token.isCancellationRequested) {
    return true;
  }

  if (error instanceof Error) {
    return error.name === 'AbortError';
  }

  return false;
}

export function resolveReasoningConfig(
  options: ModelOptions | undefined,
): QwenReasoningConfig {
  const reasoningConfig = vscode.workspace.getConfiguration('qwenCopilot.reasoning');
  const requestReasoning = normalizeReasoningOverride(options?.reasoning);

  const mode =
    requestReasoning.mode ??
    normalizeReasoningMode(reasoningConfig.get<string>('mode', 'on'));
  const budget =
    requestReasoning.budget ??
    normalizeReasoningBudget(reasoningConfig.get<number | null>('budget', null));
  const showSummary =
    requestReasoning.showSummary ?? reasoningConfig.get<boolean>('showSummary', false);
  const preserveHistory =
    requestReasoning.preserveHistory ??
    reasoningConfig.get<boolean>('preserveHistory', false);

  return {
    mode,
    ...(typeof budget === 'number' ? {budget} : {}),
    showSummary,
    preserveHistory,
  };
}

function normalizeReasoningOverride(
  value: unknown,
): Partial<QwenReasoningConfig> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const mode = normalizeReasoningMode(record.mode);
  const budget = normalizeReasoningBudget(record.budget);
  const showSummary =
    typeof record.showSummary === 'boolean' ? record.showSummary : undefined;
  const preserveHistory =
    typeof record.preserveHistory === 'boolean'
      ? record.preserveHistory
      : undefined;

  return {
    ...(mode ? {mode} : {}),
    ...(typeof budget === 'number' ? {budget} : {}),
    ...(typeof showSummary === 'boolean' ? {showSummary} : {}),
    ...(typeof preserveHistory === 'boolean' ? {preserveHistory} : {}),
  };
}

function normalizeReasoningMode(value: unknown): ReasoningMode {
  if (value === 'on' || value === 'auto') {
    return value;
  }

  return 'off';
}

function normalizeReasoningBudget(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.floor(value);
  if (normalized <= 0) {
    return undefined;
  }

  return Math.min(normalized, MAX_REASONING_BUDGET);
}