import { parseToolInput } from "./qwenClientNormalization";
import type { QwenStreamEvent } from "../types";

export async function* collectStreamEvents(stream: AsyncIterable<any>): AsyncGenerator<QwenStreamEvent> {
	const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();
	let reasoningSummary = "";

	let firstChunkChecked = false;
	let hasYieldedAny = false;

	for await (const chunk of stream) {
		// Validate first chunk to detect HTML responses (error pages, captcha, etc.)
		if (!firstChunkChecked) {
			firstChunkChecked = true;
			validateFirstChunk(chunk);
		}

		const delta = chunk.choices?.[0]?.delta;

		if (typeof delta?.content === "string" && delta.content) {
			hasYieldedAny = true;
			yield { type: "text", text: delta.content };
		}

		for (const call of delta?.tool_calls ?? []) {
			const index = call.index ?? 0;
			const current = toolCalls.get(index) ?? {
				id: call.id ?? `tool_call_${index}`,
				name: "tool",
				arguments: "",
			};

			toolCalls.set(index, {
				id: call.id ?? current.id,
				name: call.function?.name ?? current.name,
				arguments: `${current.arguments}${call.function?.arguments ?? ""}`,
			});
		}

		const summaryDelta = extractPublicReasoningSummaryDelta(chunk);
		if (summaryDelta) {
			hasYieldedAny = true;
			reasoningSummary += summaryDelta;
		}
	}

	// After stream ends, check if we got any valid events
	if (!firstChunkChecked) {
		throw new Error("Empty response from Qwen API: stream returned no chunks");
	}

	if (!hasYieldedAny && toolCalls.size === 0 && !reasoningSummary.trim()) {
		throw new Error("Invalid API response: stream produced no content");
	}

	if (reasoningSummary.trim()) {
		yield {
			type: "reasoning_summary",
			text: reasoningSummary,
		};
	}

	for (const [, call] of [...toolCalls.entries()].sort((a, b) => a[0] - b[0])) {
		yield {
			type: "tool_call",
			callId: call.id,
			name: call.name,
			input: parseToolInput(call.arguments),
		};
	}
}

function extractPublicReasoningSummaryDelta(chunk: any): string {
	const candidates: unknown[] = [
		chunk?.choices?.[0]?.delta?.reasoning_summary,
		chunk?.choices?.[0]?.delta?.reasoning_summary_text,
		chunk?.reasoning_summary,
	];

	const output = chunk?.output;
	if (Array.isArray(output)) {
		for (const item of output) {
			if (item?.type === "reasoning_summary" && typeof item?.text === "string") {
				candidates.push(item.text);
			}
		}
	}

	const eventType = chunk?.type;
	if (eventType === "response.reasoning_summary_text.delta" && typeof chunk?.delta === "string") {
		candidates.push(chunk.delta);
	}

	for (const candidate of candidates) {
		if (typeof candidate === "string" && candidate) {
			return candidate;
		}
	}

	return "";
}

/**
 * Validates the first chunk to detect non-JSON responses (HTML error pages, captchas, etc.)
 * @throws Error if the response appears to be an HTML page or invalid API response
 */
function validateFirstChunk(chunk: unknown): void {
	if (!chunk || typeof chunk !== "object") {
		return;
	}

	// Check for HTML content in common response fields
	const content = chunk as Record<string, unknown>;
	const contentStr = JSON.stringify(content).toLowerCase();

	// HTML indicators
	const htmlIndicators = ["<html", "<!doctype", "<!DOCTYPE", "<head>", "<body>", "<div", "<script"];

	for (const indicator of htmlIndicators) {
		if (contentStr.includes(indicator)) {
			throw new Error(
				`Invalid API response: received HTML instead of JSON. The endpoint may be returning an error page. ` +
					`Status: 200 (OK) but content type is text/html. Check the base URL configuration.`
			);
		}
	}

	// Check for typical error page patterns in response text
	const textField = content.text ?? content.message ?? content.error ?? content.content;
	if (typeof textField === "string") {
		const textLower = textField.toLowerCase();
		const errorPagePatterns = ["<html", "<!doctype", "<!doctype html", "access denied", "captcha", "blocked"];

		for (const pattern of errorPagePatterns) {
			if (textLower.includes(pattern)) {
				throw new Error(
					`Invalid API response: received HTML content in text field. The endpoint may be returning an error page.`
				);
			}
		}
	}

	// Validate expected OpenAI streaming response structure
	if (!("choices" in chunk) || !Array.isArray((chunk as { choices?: unknown }).choices)) {
		// Some valid responses might not have choices on first chunk, so only warn
		console.warn('Qwen stream: first chunk missing expected "choices" array');
	}
}
