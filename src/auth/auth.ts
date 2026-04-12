import * as vscode from 'vscode';
import {
  DEFAULT_BASE_URL,
  REFRESH_BUFFER_MS,
} from './authConstants';
import {
  clearCredentials,
  loadCredentials,
  saveCredentials,
  tokenToCredentials,
} from './authCredentials';
import {
  pollDeviceToken,
  requestDeviceCode,
  updatePollInterval,
} from './authDeviceFlow';
import {delay} from './authHttp';
import {generatePkcePair} from './authPkce';
import {
  RefreshTokenResponseError,
  requestRefreshToken,
} from './authRefresh';
import {
  hasActiveAccessToken,
  resolveSessionFromCredentials,
} from './authSession';
import {buildVerificationUrl} from './authUrl';
import type {QwenAuthSession, QwenCredentials, QwenTokenResponse} from '../types';

export class AuthManager {
  private secretStorage: vscode.SecretStorage | undefined;
  private credentials: QwenCredentials | null = null;
  private refreshPromise: Promise<void> | null = null;

  setSecretStorage(storage: vscode.SecretStorage): void {
    this.secretStorage = storage;
  }

  async loadSession(): Promise<void> {
    this.credentials = await loadCredentials(this.secretStorage);
  }

  isLoggedIn(): boolean {
    return hasActiveAccessToken(this.credentials);
  }

  async getSession(baseUrlOverride?: string): Promise<QwenAuthSession> {
    if (!hasActiveAccessToken(this.credentials)) {
      throw new Error('Not logged in. Use Qwen Copilot: Login.');
    }

    await this.ensureFreshToken();

    if (!this.credentials?.accessToken) {
      throw new Error('Session expired. Please login again.');
    }

    return resolveSessionFromCredentials(this.credentials, baseUrlOverride);
  }

  async loginInteractive(): Promise<string> {
    this.getSecretStorage();

    const {verifier, challenge} = generatePkcePair();
    const deviceCode = await requestDeviceCode(challenge);
    const verificationUrl = buildVerificationUrl(deviceCode);

    await vscode.env.openExternal(vscode.Uri.parse(verificationUrl));

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Qwen Copilot login in progress',
        cancellable: true,
      },
      async (progress, token) => {
        let intervalSeconds = Math.max(1, deviceCode.interval ?? 5);
        const expiresAt = Date.now() + deviceCode.expires_in * 1000;

        while (Date.now() < expiresAt) {
          if (token.isCancellationRequested) {
            throw new Error('Login cancelled.');
          }

          const remainingSeconds = Math.max(
            0,
            Math.floor((expiresAt - Date.now()) / 1000),
          );

          progress.report({
            message: `Enter code ${deviceCode.user_code} in your browser (${remainingSeconds}s left)`,
          });

          const pollResult = await pollDeviceToken(deviceCode.device_code, verifier);

          if (pollResult.type === 'success') {
            const currentBase = this.credentials?.baseUrl;
            const credentials = tokenToCredentials(pollResult.value, currentBase);
            await this.saveAndCacheCredentials(credentials);
            return;
          }

          if (pollResult.type === 'error') {
            throw new Error(pollResult.message);
          }

          intervalSeconds = updatePollInterval(intervalSeconds, pollResult);

          await delay(intervalSeconds * 1000);
        }

        throw new Error('Login timed out. Please run login again.');
      },
    );

    return this.credentials?.baseUrl || DEFAULT_BASE_URL;
  }

  async logout(): Promise<void> {
    await clearCredentials(this.secretStorage);
    this.credentials = null;
  }

  private async ensureFreshToken(): Promise<void> {
    if (!this.credentials) {
      throw new Error('Not logged in. Use Qwen Copilot: Login.');
    }

    if (this.credentials.expiresAt - Date.now() > REFRESH_BUFFER_MS) {
      return;
    }

    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.refreshPromise = null;
      });
    }

    await this.refreshPromise;
  }

  private async refreshAccessToken(): Promise<void> {
    this.getSecretStorage();

    if (!this.credentials?.refreshToken) {
      throw new Error('Missing refresh token. Please login again.');
    }

    const currentCredentials = this.credentials;
    try {
      const refreshed = await requestRefreshToken(currentCredentials.refreshToken);
      const merged: QwenTokenResponse = {
        ...refreshed,
        refresh_token: refreshed.refresh_token || currentCredentials.refreshToken,
      };

      const credentials = tokenToCredentials(merged, currentCredentials.baseUrl);
      await this.saveAndCacheCredentials(credentials);
    } catch (error) {
      if (error instanceof RefreshTokenResponseError) {
        await this.logout();
      }

      throw error;
    }
  }

  private async saveAndCacheCredentials(credentials: QwenCredentials): Promise<void> {
    const storage = this.getSecretStorage();
    await saveCredentials(storage, credentials);
    this.credentials = credentials;
  }

  private getSecretStorage(): vscode.SecretStorage {
    if (!this.secretStorage) {
      throw new Error('Secret storage is unavailable.');
    }

    return this.secretStorage;
  }
}
