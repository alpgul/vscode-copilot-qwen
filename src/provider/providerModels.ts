import type { QwenModelId } from "../types";

export const QWEN_MODELS = {
	"coder-model": {
		id: "coder-model",
		name: "Qwen Coder Model",
		maxInputTokens: 1_000_000,
		maxOutputTokens: 65_536,
	},
	"qwen3-coder-plus": {
		id: "qwen3-coder-plus",
		name: "Qwen 3 Coder Plus",
		maxInputTokens: 1_000_000,
		maxOutputTokens: 65_536,
	},
	"qwen3-coder-flash": {
		id: "qwen3-coder-flash",
		name: "Qwen 3 Coder Flash",
		maxInputTokens: 1_000_000,
		maxOutputTokens: 65_536,
	},
} as const;

export const DEFAULT_SYSTEM_PROMPT = "You are a helpful coding assistant.";

export function resolveModelId(modelId: string): QwenModelId {
	if (modelId === "qwen3-coder-plus" || modelId === "qwen3-coder-flash" || modelId === "coder-model") {
		return modelId;
	}

	throw new Error(
		`Unsupported model '${modelId}'. Select a Qwen model (qwen3-coder-plus or qwen3-coder-flash or coder-model) in the chat model picker.`
	);
}
