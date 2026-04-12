import type {QwenAuthSession, QwenCredentials} from '../types';

export function hasActiveAccessToken(credentials: QwenCredentials | null): boolean {
  return Boolean(credentials?.accessToken);
}

export function resolveSessionFromCredentials(
  credentials: QwenCredentials,
): QwenAuthSession {
  return {
    apiKey: credentials.accessToken,
    baseUrl: credentials.baseUrl,
  };
}