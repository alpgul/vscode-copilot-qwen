import type {QwenMessage, QwenTool} from '../types';

export function normalizeMessages(messages: QwenMessage[]): QwenMessage[] {
  return messages
    .map(message => {
      const normalized: any = {...message};
      delete normalized.name;

      if (normalized.role === 'tool' && !normalized.content) {
        normalized.content = ' ';
      }

      if ('content' in normalized) {
        normalized.content = normalizeMessageContent(normalized.content);
      }

      return normalized as QwenMessage;
    })
    .filter(message => {
      const content = (message as {content?: unknown}).content;
      return !(typeof content === 'string' && content.length === 0);
    });
}

export function normalizeMessageContent(content: unknown): unknown {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') {
          return part;
        }

        if (
          part &&
          typeof part === 'object' &&
          'text' in part &&
          typeof (part as {text?: unknown}).text === 'string'
        ) {
          return (part as {text: string}).text;
        }

        try {
          return JSON.stringify(part);
        } catch {
          return String(part);
        }
      })
      .join('\n');
  }

  if (content == null) {
    return '';
  }

  return String(content);
}

export function sanitizeTools(tools?: QwenTool[]): QwenTool[] | undefined {
  if (!tools?.length) {
    return undefined;
  }

  const used = new Set<string>();
  return tools.map((tool, index) => {
    if (!tool.function) {
      return tool;
    }

    const rawName = tool.function.name || `tool_${index}`;
    let safeName = rawName
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!safeName) {
      safeName = `tool_${index}`;
    }
    if (!/^[a-zA-Z]/.test(safeName)) {
      safeName = `tool_${safeName}`;
    }

    if (safeName.length > 64) {
      safeName = safeName.slice(0, 64);
    }

    let candidate = safeName;
    let suffix = 1;
    while (used.has(candidate)) {
      const tag = `_${suffix++}`;
      candidate = `${safeName.slice(0, Math.max(1, 64 - tag.length))}${tag}`;
    }
    used.add(candidate);

    return {
      ...tool,
      function: {
        ...tool.function,
        name: candidate,
      },
    };
  });
}

export function parseToolInput(raw: string): object {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as object;
    }
    return {};
  } catch {
    return raw.trim() ? {_raw: raw} : {};
  }
}