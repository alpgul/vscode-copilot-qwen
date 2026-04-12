import * as vscode from 'vscode';

type ModelOptions = Readonly<Record<string, unknown>>;

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