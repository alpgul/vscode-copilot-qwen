import * as vscode from 'vscode';

export function runWithUiError(
  action: string,
  task: () => Promise<void>,
): Promise<void> {
  return task().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`${action} error: ${message}`);
  });
}