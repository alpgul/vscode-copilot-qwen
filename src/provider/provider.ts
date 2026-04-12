import * as vscode from 'vscode';
import {AuthManager} from '../auth/auth';
import {convertMessages} from './providerMessageConverter';
import {QWEN_MODELS, resolveModelId} from './providerModels';
import {isAbortError, resolveMaxTokens, resolveTemperature} from './providerOptions';
import {convertTools, resolveToolChoice} from './providerTools';
import {qwenClient} from '../client/qwenClient';

export class QwenLanguageModelChatProvider
  implements vscode.LanguageModelChatProvider
{
  constructor(private readonly auth: AuthManager) {}

  async provideLanguageModelChatInformation(): Promise<
    vscode.LanguageModelChatInformation[]
  > {
    return Object.values(QWEN_MODELS).map(model => ({
      id: model.id,
      name: model.name,
      family: 'qwen3-coder',
      version: 'latest',
      detail: 'Qwen',
      maxInputTokens: model.maxInputTokens,
      maxOutputTokens: model.maxOutputTokens,
      capabilities: {toolCalling: true},
    }));
  }

  async provideLanguageModelChatResponse(
    model: vscode.LanguageModelChatInformation,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: vscode.ProvideLanguageModelChatResponseOptions,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken,
  ): Promise<void> {
    await this.ensureLoggedIn();

    const apiConfig = vscode.workspace.getConfiguration('qwenCopilot.api');
    const baseUrlOverride = (apiConfig.get<string>('baseUrl') || '').trim();
    const defaultModel = (apiConfig.get<string>('defaultModel') || '').trim();
    const session = await this.auth.getSession(baseUrlOverride);

    const modelId = resolveModelId(model.id, defaultModel);
    const convertedMessages = convertMessages(messages);
    const tools = convertTools(options.tools);

    const abortController = new AbortController();
    const cancellationSubscription = token.onCancellationRequested(() =>
      abortController.abort(),
    );

    try {
      const stream = qwenClient.streamChatCompletion({
        session,
        model: modelId,
        messages: convertedMessages,
        tools,
        toolChoice: resolveToolChoice(tools),
        maxTokens: resolveMaxTokens(model, options.modelOptions),
        temperature: resolveTemperature(options.modelOptions),
        abortSignal: abortController.signal,
      });

      for await (const chunk of stream) {
        if (token.isCancellationRequested) {
          break;
        }

        if (chunk.type === 'text') {
          progress.report(new vscode.LanguageModelTextPart(chunk.text));
          continue;
        }

        progress.report(
          new vscode.LanguageModelToolCallPart(
            chunk.callId,
            chunk.name,
            chunk.input,
          ),
        );
      }
    } catch (error) {
      if (!isAbortError(error, token)) {
        throw error;
      }
    } finally {
      cancellationSubscription.dispose();
    }
  }

  provideTokenCount(
    model: vscode.LanguageModelChatInformation,
    text: string | vscode.LanguageModelChatRequestMessage,
    token: vscode.CancellationToken,
  ): Promise<number> {
    if (token.isCancellationRequested) {
      return Promise.resolve(0);
    }

    if (typeof text === 'string') {
      return Promise.resolve(Math.min(Math.ceil(text.length / 4), model.maxInputTokens));
    }

    return qwenClient
      .countTokens(convertMessages([text]))
      .then(count => Math.min(count, model.maxInputTokens))
      .catch(() => 0);
  }

  private async ensureLoggedIn(): Promise<void> {
    if (this.auth.isLoggedIn()) {
      return;
    }

    const action = await vscode.window.showInformationMessage(
      'Qwen Copilot needs login before it can respond.',
      'Login now',
      'Manage',
    );

    if (action === 'Login now') {
      await vscode.commands.executeCommand('qwen-copilot.login');
    }

    if (action === 'Manage') {
      await vscode.commands.executeCommand('qwen-copilot.manage');
    }

    if (!this.auth.isLoggedIn()) {
      throw new Error('Not logged in. Use Qwen Copilot: Login.');
    }
  }
}
