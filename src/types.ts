import type OpenAI from 'openai';

export type QwenModelId = 'qwen3-coder-plus' | 'qwen3-coder-flash';

export interface QwenAuthSession {
  apiKey: string;
  baseUrl: string;
}

export interface QwenCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  baseUrl: string;
}

export interface QwenDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

export interface QwenTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  resource_url?: string;
}

export interface QwenOAuthErrorResponse {
  error: string;
  error_description?: string;
}

export type QwenMessage = OpenAI.Chat.ChatCompletionMessageParam;
export type QwenTool = OpenAI.Chat.ChatCompletionTool;
export type QwenToolChoice = OpenAI.Chat.ChatCompletionToolChoiceOption;

export type QwenStreamEvent =
  | {type: 'text'; text: string}
  | {type: 'tool_call'; callId: string; name: string; input: object};
