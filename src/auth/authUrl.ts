import {DEFAULT_BASE_URL} from './authConstants';
import type {QwenDeviceCodeResponse} from '../types';

export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  const parsed = new URL(withScheme);
  let pathname = parsed.pathname.replace(/\/+$/, '');

  // Token resource_url may point to a concrete completion endpoint.
  pathname = pathname.replace(/\/chat\/completions$/i, '');

  if (!pathname) {
    pathname = '/v1';
  }

  if (!/\/v\d+$/i.test(pathname)) {
    pathname = `${pathname}/v1`;
  }

  return `${parsed.origin}${pathname}`;
}

export function resolveBaseUrl(
  resourceUrl: string | undefined,
  fallbackBaseUrl: string | undefined,
): string {
  const fallback = normalizeBaseUrl(fallbackBaseUrl || DEFAULT_BASE_URL);
  if (!resourceUrl?.trim()) {
    return fallback;
  }

  try {
    return normalizeBaseUrl(resourceUrl);
  } catch {
    return fallback;
  }
}

export function buildVerificationUrl(deviceCode: QwenDeviceCodeResponse): string {
  if (deviceCode.verification_uri_complete?.trim()) {
    return deviceCode.verification_uri_complete.trim();
  }

  const base = new URL(deviceCode.verification_uri);
  if (!base.searchParams.get('user_code')) {
    base.searchParams.set('user_code', deviceCode.user_code);
  }
  return base.toString();
}