import OpenAI from 'openai';
import {
  getErrorDetail,
  getErrorStatus,
  isAuthError,
} from './qwenClientErrors';
import {
  normalizeMessages,
  sanitizeTools,
} from './qwenClientNormalization';
import {collectStreamEvents} from './qwenClientStream';
import type {
  QwenAuthSession,
  QwenMessage,
  QwenModelId,
  QwenStreamEvent,
  QwenTool,
  QwenToolChoice,
} from '../types';

class QwenClient {
  private client: OpenAI | null = null;
  private activeApiKey: string | null = null;
  private activeBaseUrl: string | null = null;
  // portal.qwen.ai validates the X-Dashscope-Useragent must start with "QwenCode/"
  private static readonly QWEN_USERAGENT = `QwenCode/0.1.0 (${process.platform}; ${process.arch})`;
  private static readonly USER_AGENT = 'vscode-qwen-copilot/0.1.0';

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
    abortSignal?: AbortSignal;
  }): AsyncGenerator<QwenStreamEvent> {
    this.ensureClient(params.session);

    const normalizedMessages = normalizeMessages(params.messages);
    const tools = sanitizeTools(params.tools);

    const baseRequestOptions: any = {
      model: params.model,
      messages: normalizedMessages,
      stream: true,
      ...(typeof params.maxTokens === 'number' && params.maxTokens > 0
        ? {max_tokens: params.maxTokens}
        : {}),
      ...(typeof params.temperature === 'number' &&
      params.temperature >= 0 &&
      params.temperature < 2
        ? {temperature: params.temperature}
        : {}),
      ...(tools?.length
        ? {
            tools,
            tool_choice: params.toolChoice ?? 'auto',
          }
        : {}),
    };

    let response: any | undefined;
    let lastError: unknown;
    let requestOptions: any = {...baseRequestOptions};

    try {
      const createCompletion = () =>
        this.requireClient().chat.completions.create(requestOptions, {
          ...(params.abortSignal ? {signal: params.abortSignal} : {}),
        });

      try {
        response = await createCompletion();
      } catch (error) {
        lastError = error;
      }

      // If the request failed with 400 and tools were present,
      // retry without tools (some models don't support tool calling).
      if (
        response === undefined &&
        getErrorStatus(lastError) === 400 &&
        tools?.length
      ) {
        const {tools: _tools, tool_choice: _toolChoice, ...rest} = requestOptions;
        requestOptions = rest;
        try {
          response = await createCompletion();
        } catch (error) {
          lastError = error;
        }
      }

      if (response === undefined) {
        throw lastError;
      }

      for await (const event of collectStreamEvents(response as AsyncIterable<any>)) {
        yield event;
      }
    } catch (error) {
      if (isAuthError(error)) {
        const status = getErrorStatus(error);
        const detail = getErrorDetail(error);
        const suffix = detail ? ` (${detail})` : '';

        if (status === 401 || status === 403) {
          throw new Error(
            `Your Qwen login session is not authorized${suffix}. Run Qwen Copilot: Login again.`,
          );
        }

        throw new Error(
          `Qwen login failed${suffix}. Run Qwen Copilot: Login and try again.`,
        );
      }

      if (getErrorStatus(error) === 400) {
        const detail = getErrorDetail(error);
        const endpoint = this.activeBaseUrl ? ` Endpoint: ${this.activeBaseUrl}.` : '';
        throw new Error(
          `Qwen request was rejected (${detail || 'HTTP 400 bad request'}). Model: ${String(requestOptions.model)}.${endpoint}`,
        );
      }

      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    }
  }

  async countTokens(messages: QwenMessage[]): Promise<number> {
    let totalChars = 0;
    for (const message of messages) {
      const content = (message as {content?: unknown}).content;
      if (typeof content === 'string') {
        totalChars += content.length;
      } else if (Array.isArray(content)) {
        totalChars += JSON.stringify(content).length;
      }
    }

    return Math.ceil(totalChars / 4) + messages.length * 3;
  }

  private ensureClient(session: QwenAuthSession): void {
    if (
      this.client &&
      this.activeApiKey === session.apiKey &&
      this.activeBaseUrl === session.baseUrl
    ) {
      return;
    }

    this.client = new OpenAI({
      apiKey: session.apiKey,
      baseURL: session.baseUrl,
      maxRetries: 0,
      defaultHeaders: {
        'User-Agent': QwenClient.USER_AGENT,
        'X-Dashscope-Useragent': QwenClient.QWEN_USERAGENT,
        'X-Dashscope-Authtype': 'qwen-oauth',
        'X-Dashscope-Cachecontrol': 'enable',
      },
    });

    this.activeApiKey = session.apiKey;
    this.activeBaseUrl = session.baseUrl;
  }

  private requireClient(): OpenAI {
    if (!this.client) {
      throw new Error('Qwen client is not initialized.');
    }
    return this.client;
  }
}

export const qwenClient = new QwenClient();
