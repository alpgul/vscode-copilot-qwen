import * as vscode from 'vscode';

const CLI_CONFIG_KEY = 'qwenCopilot.cli';

export async function continueInQwenCli(): Promise<void> {
  const config = vscode.workspace.getConfiguration(CLI_CONFIG_KEY);
  const command = (config.get<string>('command') || 'qwen').trim() || 'qwen';
  const args = config.get<string[]>('args') || [];
  const autoSendPrompt = config.get<boolean>('autoSendPrompt') ?? true;

  const prompt = await getPromptForCli();
  const terminal = vscode.window.createTerminal('Qwen CLI');
  terminal.show(true);

  terminal.sendText(
    [command, ...args]
      .map(value => shellQuote(value))
      .join(' '),
  );

  if (prompt && autoSendPrompt) {
    terminal.sendText(prompt);
  }
}

export async function getPromptForCli(): Promise<string | undefined> {
  const editor = vscode.window.activeTextEditor;
  const selectedText = editor?.document.getText(editor.selection).trim();
  if (selectedText) {
    return selectedText;
  }

  const input = await vscode.window.showInputBox({
    prompt: 'Prompt to send to Qwen CLI (optional)',
    placeHolder: 'Leave empty to open interactive CLI only',
  });

  return input?.trim() || undefined;
}

export function shellQuote(value: string): string {
  if (!value) {
    return "''";
  }

  if (/^[a-zA-Z0-9_./-]+$/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, `"'"'`)}'`;
}