import OpenAI from "openai";
import { getErrorDetail, getErrorStatus, isAuthError, isConnectionError } from "./qwenClientErrors";
import { normalizeMessages, sanitizeTools } from "./qwenClientNormalization";
import { collectStreamEvents } from "./qwenClientStream";
import type {
	QwenAuthSession,
	QwenMessage,
	QwenModelId,
	QwenReasoningConfig,
	QwenStreamEvent,
	QwenTool,
	QwenToolChoice,
} from "../types";
import { QWEN_CLIENT_HEADERS } from "./qwenConstants";

const MAX_STREAM_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

class QwenClient {
	private client: OpenAI | null = null;
	private activeApiKey: string | null = null;
	private activeBaseUrl: string | null = null;

	reset(): void {
		this.client = null;
		this.activeApiKey = null;
		this.activeBaseUrl = null;
	}

	async *streamChatCompletion(params: {
		session: QwenAuthSession;
		model: QwenModelId;
		messages: QwenMessage[];
		tools?: QwenTool[];
		toolChoice?: QwenToolChoice;
		maxTokens?: number;
		temperature?: number;
		reasoning: QwenReasoningConfig;
		abortSignal?: AbortSignal;
	}): AsyncGenerator<QwenStreamEvent> {
		this.ensureClient(params.session);

		const normalizedMessages = normalizeMessages(params.messages);
		const tools = sanitizeTools(params.tools);

		const baseRequestOptions: any = {
			model: params.model,
			messages: normalizedMessages,
			stream: true,
			...(typeof params.maxTokens === "number" && params.maxTokens > 0 ? { max_tokens: params.maxTokens } : {}),
			...(typeof params.temperature === "number" && params.temperature >= 0 && params.temperature < 2
				? { temperature: params.temperature }
				: {}),
			...(tools?.length
				? {
						tools,
						tool_choice: params.toolChoice ?? "auto",
					}
				: {}),
		};

		applyReasoningOptions(baseRequestOptions, params.reasoning);

		let retryCount = 0;
		const requestOptions: any = { ...baseRequestOptions };
		let yieldedAny = false;

		while (retryCount <= MAX_STREAM_RETRIES) {
			if (retryCount > 0) {
				const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount - 1);
				await this.sleep(delayMs, params.abortSignal);
			}

			try {
				const response = await this.requireClient().chat.completions.create(requestOptions, {
					...(params.abortSignal ? { signal: params.abortSignal } : {}),
				});

				if (response === undefined) {
					throw new Error("Empty response from Qwen API");
				}

				for await (const event of collectStreamEvents(response as unknown as AsyncIterable<any>)) {
					yieldedAny = true;
					yield event;
				}

				// Stream completed successfully
				return;
			} catch (error) {
				if (isAuthError(error)) {
					const status = getErrorStatus(error);
					const detail = getErrorDetail(error);
					const suffix = detail ? ` (${detail})` : "";

					if (status === 401 || status === 403) {
						throw new Error(`Your Qwen login session is not authorized${suffix}. Run Qwen Copilot: Login again.`);
					}

					throw new Error(`Qwen login failed${suffix}. Run Qwen Copilot: Login and try again.`);
				}

				if (getErrorStatus(error) === 400) {
					const detail = getErrorDetail(error);
					const endpoint = this.activeBaseUrl ? ` Endpoint: ${this.activeBaseUrl}.` : "";
					throw new Error(
						`Qwen request was rejected (${detail || "HTTP 400 bad request"}). Model: ${String(requestOptions.model)}.${endpoint}`
					);
				}

				// Retry on connection errors
				if (isConnectionError(error) && retryCount < MAX_STREAM_RETRIES) {
					retryCount++;
					continue;
				}

				if (error instanceof Error) {
					throw error;
				}
				throw new Error(String(error));
			}
		}
	}

	private async sleep(ms: number, abortSignal?: AbortSignal): Promise<void> {
		return new Promise((resolve, reject) => {
			if (abortSignal?.aborted) {
				reject(new DOMException("Aborted", "AbortError"));
				return;
			}

			const timer = setTimeout(resolve, ms);
			const abortHandler = () => {
				clearTimeout(timer);
				reject(new DOMException("Aborted", "AbortError"));
			};

			abortSignal?.addEventListener("abort", abortHandler, { once: true });
			timer.ref?.();
		});
	}

	async countTokens(messages: QwenMessage[]): Promise<number> {
		let totalChars = 0;
		for (const message of messages) {
			const content = (message as { content?: unknown }).content;
			if (typeof content === "string") {
				totalChars += content.length;
			} else if (Array.isArray(content)) {
				totalChars += JSON.stringify(content).length;
			}
		}

		return Math.ceil(totalChars / 4) + messages.length * 3;
	}

	private ensureClient(session: QwenAuthSession): void {
		if (this.client && this.activeApiKey === session.apiKey && this.activeBaseUrl === session.baseUrl) {
			return;
		}

		this.client = new OpenAI({
			apiKey: session.apiKey,
			baseURL: session.baseUrl,
			maxRetries: 2,
			timeout: 60_000,
			defaultHeaders: {
				...QWEN_CLIENT_HEADERS,
			},
		});

		this.activeApiKey = session.apiKey;
		this.activeBaseUrl = session.baseUrl;
	}

	private requireClient(): OpenAI {
		if (!this.client) {
			throw new Error("Qwen client is not initialized.");
		}
		return this.client;
	}
}

export const qwenClient = new QwenClient();

function applyReasoningOptions(request: Record<string, unknown>, reasoning: QwenReasoningConfig): void {
	if (reasoning.mode === "on" || reasoning.mode === "auto") {
		request.enable_thinking = true;
	}

	if (typeof reasoning.budget === "number" && reasoning.budget > 0) {
		request.thinking_budget = reasoning.budget;
	}

	if (reasoning.preserveHistory) {
		request.preserve_thinking = true;
	}
}
