import {normalizeBaseUrl} from './authUrl';
import type {QwenAuthSession, QwenCredentials} from '../types';

export function hasActiveAccessToken(credentials: QwenCredentials | null): boolean {
  return Boolean(credentials?.accessToken);
}

export function resolveSessionFromCredentials(
  credentials: QwenCredentials,
  baseUrlOverride?: string,
): QwenAuthSession {
  const baseUrl = baseUrlOverride?.trim()
    ? normalizeBaseUrl(baseUrlOverride)
    : credentials.baseUrl;

  return {
    apiKey: credentials.accessToken,
    baseUrl,
  };
}