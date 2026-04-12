import * as vscode from 'vscode';
import {
  CREDENTIALS_SECRET_KEY,
  DEFAULT_BASE_URL,
} from './authConstants';
import {resolveBaseUrl} from './authUrl';
import type {QwenCredentials, QwenTokenResponse} from '../types';

export async function loadCredentials(
  storage: vscode.SecretStorage | undefined,
): Promise<QwenCredentials | null> {
  const raw = await storage?.get(CREDENTIALS_SECRET_KEY);
  return parseCredentials(raw);
}

export async function saveCredentials(
  storage: vscode.SecretStorage,
  credentials: QwenCredentials,
): Promise<void> {
  await storage.store(CREDENTIALS_SECRET_KEY, JSON.stringify(credentials));
}

export async function clearCredentials(
  storage: vscode.SecretStorage | undefined,
): Promise<void> {
  if (storage) {
    await storage.delete(CREDENTIALS_SECRET_KEY);
  }
}

export function parseCredentials(raw: string | undefined): QwenCredentials | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<QwenCredentials>;

    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }

    const accessToken = parsed.accessToken.trim();
    const refreshToken = parsed.refreshToken.trim();
    const baseUrl = resolveBaseUrl(
      typeof parsed.baseUrl === 'string' ? parsed.baseUrl : undefined,
      DEFAULT_BASE_URL,
    );

    if (!accessToken || !refreshToken) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: parsed.expiresAt,
      baseUrl,
    };
  } catch {
    return null;
  }
}

export function tokenToCredentials(
  token: QwenTokenResponse,
  fallbackBaseUrl?: string,
): QwenCredentials {
  const accessToken = token.access_token.trim();
  const refreshToken = (token.refresh_token || '').trim();

  if (!accessToken || !refreshToken) {
    throw new Error('OAuth response did not include valid tokens.');
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + token.expires_in * 1000,
    baseUrl: resolveBaseUrl(token.resource_url, fallbackBaseUrl),
  };
}