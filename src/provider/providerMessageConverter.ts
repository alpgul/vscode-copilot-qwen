import {P, match} from 'ts-pattern';
import * as vscode from 'vscode';
import {DEFAULT_SYSTEM_PROMPT} from './providerModels';
import type {QwenMessage} from '../types';

export function convertMessages(
  messages: readonly vscode.LanguageModelChatRequestMessage[],
  options?: {preserveReasoningHistory?: boolean},
): QwenMessage[] {
  const preserveReasoningHistory = options?.preserveReasoningHistory ?? false;
  const converted: QwenMessage[] = [];

  for (const message of messages) {
    const roleText = String(message.role).toLowerCase();
    const role: 'assistant' | 'user' | 'system' =
      message.role === vscode.LanguageModelChatMessageRole.Assistant ||
      roleText === 'assistant'
        ? 'assistant'
        : message.role === vscode.LanguageModelChatMessageRole.User ||
            roleText === 'user'
          ? 'user'
          : 'system';

    const toolCalls: vscode.LanguageModelToolCallPart[] = [];
    let textBuffer = '';
    const reasoningContentBuffer: string[] = [];

    for (const part of message.content ?? []) {
      match(part)
        .with(P.instanceOf(vscode.LanguageModelToolCallPart), call => {
          toolCalls.push(call);
        })
        .with(P.instanceOf(vscode.LanguageModelToolResultPart), result => {
          pushTextMessage(converted, role, textBuffer);
          textBuffer = '';
          converted.push({
            role: 'tool',
            tool_call_id: result.callId,
            content: serializeToolResult(result),
          });
        })
        .otherwise(value => {
          textBuffer += partToText(value);
          const reasoning =
            preserveReasoningHistory && role === 'assistant'
              ? extractReasoningContent(value)
              : undefined;
          if (typeof reasoning === 'string' && reasoning.trim()) {
            reasoningContentBuffer.push(reasoning);
          }
        });
    }

    const reasoningContent =
      preserveReasoningHistory && reasoningContentBuffer.length > 0
        ? reasoningContentBuffer.join('\n')
        : undefined;

    if (role === 'assistant' && toolCalls.length > 0) {
      const assistantMessage: QwenMessage = {
        role: 'assistant',
        content: textBuffer || ' ',
        tool_calls: toolCalls.map(call => ({
          id: call.callId,
          type: 'function',
          function: {
            name: call.name,
            arguments: stringifySafe(call.input ?? {}),
          },
        })),
      };

      if (reasoningContent) {
        (
          assistantMessage as unknown as Record<string, unknown>
        ).reasoning_content = reasoningContent;
      }

      converted.push(assistantMessage);
      continue;
    }

    pushTextMessage(converted, role, textBuffer, reasoningContent);
  }

  if (!converted.some(message => message.role === 'system')) {
    converted.unshift({
      role: 'system',
      content: DEFAULT_SYSTEM_PROMPT,
    });
  }

  if (!converted.some(message => message.role === 'user')) {
    for (let index = converted.length - 1; index >= 0; index--) {
      const item = converted[index] as unknown as {
        role?: unknown;
        content?: unknown;
      };
      if (item.role === 'system' && typeof item.content === 'string') {
        converted[index] = {
          role: 'user',
          content: item.content,
        };
        break;
      }
    }
  }

  return converted;
}

export function serializeToolResult(part: vscode.LanguageModelToolResultPart): string {
  return part.content.map(value => partToText(value)).join('');
}

export function partToText(part: unknown): string {
  return match(part)
    .with(P.instanceOf(vscode.LanguageModelTextPart), entry => entry.value)
    .with(P.instanceOf(vscode.LanguageModelPromptTsxPart), entry =>
      stringifySafe(entry.value),
    )
    .with(P.instanceOf(vscode.LanguageModelDataPart), entry => dataPartToText(entry))
    .otherwise(value => stringifySafe(value));
}

export function dataPartToText(part: vscode.LanguageModelDataPart): string {
  const mime = part.mimeType || 'application/octet-stream';
  const buffer = Buffer.from(part.data);

  if (mime.startsWith('text/') || mime === 'application/json') {
    return buffer.toString('utf-8');
  }

  return '';
}

export function stringifySafe(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function pushTextMessage(
  target: QwenMessage[],
  role: 'user' | 'assistant' | 'system',
  text: string,
  reasoningContent?: string,
): void {
  if (!text.trim()) {
    return;
  }

  const message: QwenMessage = {
    role,
    content: text,
  };

  if (role === 'assistant' && reasoningContent) {
    (message as unknown as Record<string, unknown>).reasoning_content =
      reasoningContent;
  }

  target.push(message);
}

function extractReasoningContent(part: unknown): string | undefined {
  if (part && typeof part === 'object' && !Array.isArray(part)) {
    const direct = (part as Record<string, unknown>).reasoning_content;
    if (typeof direct === 'string' && direct.trim()) {
      return direct;
    }
  }

  if (part instanceof vscode.LanguageModelDataPart) {
    const text = dataPartToText(part).trim();
    if (!text) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const reasoning = parsed.reasoning_content;
      if (typeof reasoning === 'string' && reasoning.trim()) {
        return reasoning;
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
}