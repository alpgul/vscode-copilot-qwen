import {parseToolInput} from './qwenClientNormalization';
import type {QwenStreamEvent} from '../types';

export async function* collectStreamEvents(
  stream: AsyncIterable<any>,
): AsyncGenerator<QwenStreamEvent> {
  const toolCalls = new Map<number, {id: string; name: string; arguments: string}>();

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