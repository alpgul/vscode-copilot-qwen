import {
	MAX_POLL_INTERVAL_SECONDS,
	QWEN_OAUTH_CLIENT_ID,
	QWEN_OAUTH_DEVICE_CODE_ENDPOINT,
	QWEN_OAUTH_DEVICE_GRANT,
	QWEN_OAUTH_SCOPE,
	QWEN_OAUTH_TOKEN_ENDPOINT,
} from "./authConstants";
import { postForm } from "./authHttp";
import { extractOAuthError, isDeviceCodeResponse, isOAuthError, isTokenResponse, parseJson } from "./authOAuthParsing";
import type { QwenDeviceCodeResponse, QwenTokenResponse } from "../types";

export type DeviceTokenPollResult =
	| { type: "success"; value: QwenTokenResponse }
	| { type: "pending" }
	| { type: "slow_down" }
	| { type: "rate_limited" }
	| { type: "error"; message: string };

export async function requestDeviceCode(challenge: string): Promise<QwenDeviceCodeResponse> {
	const response = await postForm(QWEN_OAUTH_DEVICE_CODE_ENDPOINT, {
		client_id: QWEN_OAUTH_CLIENT_ID,
		scope: QWEN_OAUTH_SCOPE,
		code_challenge: challenge,
		code_challenge_method: "S256",
	});

	const payload = await parseJson(response);

	if (!response.ok) {
		throw new Error(extractOAuthError(payload, "Failed to start OAuth device login."));
	}

	if (!isDeviceCodeResponse(payload)) {
		throw new Error("Invalid device login response from Qwen OAuth service.");
	}

	return payload;
}

export async function pollDeviceToken(deviceCode: string, verifier: string): Promise<DeviceTokenPollResult> {
	const response = await postForm(QWEN_OAUTH_TOKEN_ENDPOINT, {
		grant_type: QWEN_OAUTH_DEVICE_GRANT,
		client_id: QWEN_OAUTH_CLIENT_ID,
		device_code: deviceCode,
		code_verifier: verifier,
	});

	const payload = await parseJson(response);

	if (response.status === 429) {
		return { type: "rate_limited" };
	}

	if (isTokenResponse(payload)) {
		return { type: "success", value: payload };
	}

	if (isOAuthError(payload)) {
		if (payload.error === "authorization_pending") {
			return { type: "pending" };
		}

		if (payload.error === "slow_down") {
			return { type: "slow_down" };
		}

		if (payload.error === "expired_token") {
			return {
				type: "error",
				message: "Login code expired. Please run login again.",
			};
		}

		if (payload.error === "access_denied") {
			return {
				type: "error",
				message: "Login denied in browser. Please run login again.",
			};
		}

		return {
			type: "error",
			message: extractOAuthError(payload, "OAuth login failed."),
		};
	}

	if (!response.ok) {
		return {
			type: "error",
			message: `OAuth login failed with status ${response.status}.`,
		};
	}

	return { type: "pending" };
}

export function updatePollInterval(currentIntervalSeconds: number, result: DeviceTokenPollResult): number {
	if (result.type === "slow_down") {
		return Math.min(currentIntervalSeconds + 5, MAX_POLL_INTERVAL_SECONDS);
	}

	if (result.type === "rate_limited") {
		return Math.min(currentIntervalSeconds * 2, MAX_POLL_INTERVAL_SECONDS);
	}

	return currentIntervalSeconds;
}
