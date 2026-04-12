import {P, match} from 'ts-pattern';
import * as vscode from 'vscode';
import {DEFAULT_SYSTEM_PROMPT} from './providerModels';
import type {QwenMessage} from '../types';

export function convertMessages(
  messages: readonly vscode.LanguageModelChatRequestMessage[],
): QwenMessage[] {
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
        });
    }

    if (role === 'assistant' && toolCalls.length > 0) {
      converted.push({
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
      });
      continue;
    }

    pushTextMessage(converted, role, textBuffer);
  }

  // Qwen OAuth chat endpoints reject requests without a system message.
  if (!converted.some(message => message.role === 'system')) {
    converted.unshift({
      role: 'system',
      content: DEFAULT_SYSTEM_PROMPT,
    });
  }

  // Also ensure the request includes at least one user turn.
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
): void {
  if (!text.trim()) {
    return;
  }

  target.push({
    role,
    content: text,
  });
}