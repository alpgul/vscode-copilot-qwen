import * as vscode from 'vscode';
import {AuthManager} from './auth/auth';
import {continueInQwenCli as continueInQwenCliCommand} from './extension/cliCommand';
import {QwenLanguageModelChatProvider} from './provider/provider';
import {qwenClient} from './client/qwenClient';
import {runWithUiError} from './extension/uiError';

const authManager = new AuthManager();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  authManager.setSecretStorage(context.secrets);
  await authManager.loadSession();

  const provider = new QwenLanguageModelChatProvider(authManager);
  context.subscriptions.push(
    vscode.lm.registerLanguageModelChatProvider('qwen', provider),
  );

  const commands: Array<[string, () => Promise<void>]> = [
    ['qwen-copilot.login', login],
    ['qwen-copilot.authenticate', login],
    ['qwen-copilot.logout', logout],
    ['qwen-copilot.manage', manage],
    ['qwen-copilot.continueInQwenCli', continueInQwenCli],
  ];

  for (const [command, handler] of commands) {
    context.subscriptions.push(vscode.commands.registerCommand(command, handler));
  }
}

export function deactivate(): void {
  qwenClient.reset();
}

async function login(): Promise<void> {
  return runWithUiError('Login', async () => {
    const baseUrl = await authManager.loginInteractive();
    qwenClient.reset();
    vscode.window.showInformationMessage(`Successfully logged in to Qwen (${baseUrl}).`);
  });
}

async function logout(): Promise<void> {
  return runWithUiError('Logout', async () => {
    await authManager.logout();
    qwenClient.reset();
    vscode.window.showInformationMessage('Logged out from Qwen.');
  });
}

async function manage(): Promise<void> {
  const isLoggedIn = authManager.isLoggedIn();

  const selection = await vscode.window.showQuickPick(
    [
      {
        label: 'Continue in Qwen CLI',
        description: 'Open Qwen CLI in terminal and optionally send selected text',
      },
      {
        label: 'Login',
        description: isLoggedIn
          ? 'Restart OAuth browser login'
          : 'Start OAuth browser login',
      },
      {
        label: 'Logout',
        description: isLoggedIn ? 'Clear stored credentials' : 'No active session',
      },
    ],
    {
      placeHolder: 'Manage Qwen Copilot account',
    },
  );

  if (!selection) {
    return;
  }

  if (selection.label === 'Continue in Qwen CLI') {
    await continueInQwenCli();
    return;
  }

  if (selection.label === 'Login') {
    await login();
    return;
  }

  if (selection.label === 'Logout') {
    await logout();
  }
}

async function continueInQwenCli(): Promise<void> {
  return runWithUiError('Continue in Qwen CLI', continueInQwenCliCommand);
}
