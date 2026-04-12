import {parseToolInput} from './qwenClientNormalization';
import type {QwenStreamEvent} from '../types';

export async function* collectStreamEvents(
  stream: AsyncIterable<any>,
): AsyncGenerator<QwenStreamEvent> {
  const toolCalls = new Map<number, {id: string; name: string; arguments: string}>();
  let reasoningSummary = '';

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;

    if (typeof delta?.content === 'string' && delta.content) {
      yield {type: 'text', text: delta.content};
    }

    for (const call of delta?.tool_calls ?? []) {
      const index = call.index ?? 0;
      const current = toolCalls.get(index) ?? {
        id: call.id ?? `tool_call_${index}`,
        name: 'tool',
        arguments: '',
      };

      toolCalls.set(index, {
        id: call.id ?? current.id,
        name: call.function?.name ?? current.name,
        arguments: `${current.arguments}${call.function?.arguments ?? ''}`,
      });
    }

    const summaryDelta = extractPublicReasoningSummaryDelta(chunk);
    if (summaryDelta) {
      reasoningSummary += summaryDelta;
    }
  }

  if (reasoningSummary.trim()) {
    yield {
      type: 'reasoning_summary',
      text: reasoningSummary,
    };
  }

  for (const [, call] of [...toolCalls.entries()].sort((a, b) => a[0] - b[0])) {
    yield {
      type: 'tool_call',
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
      if (item?.type === 'reasoning_summary' && typeof item?.text === 'string') {
        candidates.push(item.text);
      }
    }
  }

  const eventType = chunk?.type;
  if (
    eventType === 'response.reasoning_summary_text.delta' &&
    typeof chunk?.delta === 'string'
  ) {
    candidates.push(chunk.delta);
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) {
      return candidate;
    }
  }

  return '';
}