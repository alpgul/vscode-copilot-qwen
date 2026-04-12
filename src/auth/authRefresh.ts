import {
  QWEN_OAUTH_CLIENT_ID,
  QWEN_OAUTH_TOKEN_ENDPOINT,
} from './authConstants';
import {postForm} from './authHttp';
import {
  extractOAuthError,
  isTokenResponse,
  parseJson,
} from './authOAuthParsing';
import type {QwenTokenResponse} from '../types';

export class RefreshTokenResponseError extends Error {}

export async function requestRefreshToken(
  refreshToken: string,
): Promise<QwenTokenResponse> {
  const response = await postForm(QWEN_OAUTH_TOKEN_ENDPOINT, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: QWEN_OAUTH_CLIENT_ID,
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new RefreshTokenResponseError(
      extractOAuthError(payload, 'Session expired. Please login again.'),
    );
  }

  if (!isTokenResponse(payload)) {
    throw new RefreshTokenResponseError(
      'Invalid refresh response. Please login again.',
    );
  }

  return payload;
}