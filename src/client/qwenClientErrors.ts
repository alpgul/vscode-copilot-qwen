export function getErrorStatus(error: unknown): number | undefined {
	if (!error || typeof error !== "object" || !("status" in error)) {
		return undefined;
	}

	const status = (error as { status?: unknown }).status;
	return typeof status === "number" ? status : undefined;
}

export function isConnectionError(error: unknown): boolean {
	if (!error) {
		return false;
	}

	// Check for AbortError (network cancellation)
	if (error instanceof Error && error.name === "AbortError") {
		return true;
	}

	const message = String(error).toLowerCase();

	// Common connection error patterns
	const connectionErrorPatterns = [
		"connection error",
		"connection reset",
		"connection refused",
		"connection closed",
		"connection timed out",
		"network error",
		"network timeout",
		"fetch failed",
		"socket hang up",
		"socket error",
		"econnreset",
		"econnrefused",
		"econnaborted",
		"enetunreach",
		"eai_again",
		"addrinfo not found",
		"stream closed",
		"premature close",
		"unexpected end of",
		"broken pipe",
		"write after end",
		// Stream-specific errors for retry
		"stream returned no chunks",
		"stream produced no content",
	];

	if (connectionErrorPatterns.some((pattern) => message.includes(pattern))) {
		return true;
	}

	// Check error message property
	if (error instanceof Error) {
		const errorMessage = error.message.toLowerCase();
		if (connectionErrorPatterns.some((pattern) => errorMessage.includes(pattern))) {
			return true;
		}
	}

	// Check nested error
	if (error && typeof error === "object" && "error" in error) {
		return isConnectionError((error as { error?: unknown }).error);
	}

	return false;
}

export function isAuthError(error: unknown): boolean {
	const status = getErrorStatus(error);
	if (status === 401 || status === 403) {
		return true;
	}

	const message = (getErrorDetail(error) || String(error)).toLowerCase();
	return /invalid api key|invalid[_\s-]?token|unauthorized|authentication failed/.test(message);
}

export function getErrorDetail(error: unknown): string | undefined {
	if (!error || typeof error !== "object") {
		return undefined;
	}

	const record = error as Record<string, unknown>;
	const parts: string[] = [];

	if (typeof record.status === "number") {
		parts.push(`HTTP ${record.status}`);
	}

	const nested = record.error;
	if (nested && typeof nested === "object") {
		const nestedRecord = nested as Record<string, unknown>;
		if (typeof nestedRecord.code === "string") {
			parts.push(nestedRecord.code);
		}
		if (typeof nestedRecord.message === "string") {
			parts.push(nestedRecord.message);
		}
	}

	if (parts.length > 0) {
		return parts.join(": ");
	}

	if (typeof record.message === "string") {
		return record.message;
	}

	return undefined;
}
