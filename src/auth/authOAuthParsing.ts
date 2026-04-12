import type {
  QwenDeviceCodeResponse,
  QwenOAuthErrorResponse,
  QwenTokenResponse,
} from '../types';

export async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function extractOAuthError(payload: unknown, fallback: string): string {
  if (!isOAuthError(payload)) {
    return fallback;
  }

  if (payload.error_description?.trim()) {
    return `${fallback} ${payload.error_description.trim()}`;
  }

  return `${fallback} (${payload.error})`;
}

export function isDeviceCodeResponse(value: unknown): value is QwenDeviceCodeResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.device_code === 'string' &&
    typeof record.user_code === 'string' &&
    typeof record.verification_uri === 'string' &&
    typeof record.expires_in === 'number'
  );
}

export function isTokenResponse(value: unknown): value is QwenTokenResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.access_token === 'string' &&
    typeof record.expires_in === 'number' &&
    typeof record.token_type === 'string'
  );
}

export function isOAuthError(value: unknown): value is QwenOAuthErrorResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.error === 'string';
}