export function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined;
  }

  const status = (error as {status?: unknown}).status;
  return typeof status === 'number' ? status : undefined;
}

export function isAuthError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) {
    return true;
  }

  const message = (getErrorDetail(error) || String(error)).toLowerCase();
  return /invalid api key|invalid[_\s-]?token|unauthorized|authentication failed/.test(
    message,
  );
}

export function getErrorDetail(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const record = error as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof record.status === 'number') {
    parts.push(`HTTP ${record.status}`);
  }

  const nested = record.error;
  if (nested && typeof nested === 'object') {
    const nestedRecord = nested as Record<string, unknown>;
    if (typeof nestedRecord.code === 'string') {
      parts.push(nestedRecord.code);
    }
    if (typeof nestedRecord.message === 'string') {
      parts.push(nestedRecord.message);
    }
  }

  if (parts.length > 0) {
    return parts.join(': ');
  }

  if (typeof record.message === 'string') {
    return record.message;
  }

  return undefined;
}