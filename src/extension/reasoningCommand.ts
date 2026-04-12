import * as vscode from 'vscode';
import type {ReasoningMode} from '../types';

const REASONING_CONFIG_KEY = 'qwenCopilot.reasoning';
const REASONING_MODE_KEY = `${REASONING_CONFIG_KEY}.mode`;
const REASONING_BUDGET_KEY = `${REASONING_CONFIG_KEY}.budget`;
const REASONING_SHOW_SUMMARY_KEY = `${REASONING_CONFIG_KEY}.showSummary`;
const REASONING_PRESERVE_HISTORY_KEY = `${REASONING_CONFIG_KEY}.preserveHistory`;

interface ReasoningQuickPickItem extends vscode.QuickPickItem {
  mode: ReasoningMode;
}

export async function toggleReasoningMode(): Promise<void> {
  const config = vscode.workspace.getConfiguration();
  const currentMode = readReasoningMode(config);
  const nextMode: ReasoningMode = currentMode === 'off' ? 'on' : 'off';

  await config.update(REASONING_MODE_KEY, nextMode, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(`Qwen reasoning mode: ${nextMode}`);
}

export async function configureReasoningMode(): Promise<void> {
  const config = vscode.workspace.getConfiguration();
  const currentMode = readReasoningMode(config);

  const modeSelection = await vscode.window.showQuickPick<ReasoningQuickPickItem>(
    [
      {
        label: 'Off',
        description: 'Disable reasoning controls (default behavior)',
        mode: 'off',
      },
      {
        label: 'On',
        description: 'Request reasoning on supported models',
        mode: 'on',
      },
      {
        label: 'Auto',
        description: 'Let the model/API choose reasoning behavior',
        mode: 'auto',
      },
    ],
    {
      placeHolder: 'Select Qwen reasoning mode',
    },
  );

  if (!modeSelection) {
    return;
  }

  const currentBudget = config.get<number | null>(REASONING_BUDGET_KEY, null);
  const budgetInput = await vscode.window.showInputBox({
    prompt: 'Thinking budget (positive integer) or empty for model default',
    value: typeof currentBudget === 'number' ? String(currentBudget) : '',
    validateInput: value => {
      if (!value.trim()) {
        return undefined;
      }

      const budget = Number(value);
      if (!Number.isInteger(budget) || budget <= 0) {
        return 'Use a positive integer or leave empty.';
      }

      return undefined;
    },
  });

  if (budgetInput === undefined) {
    return;
  }

  const summarySelection = await vscode.window.showQuickPick(
    [
      {
        label: 'No',
        description: 'Do not display reasoning summaries in chat',
        value: false,
      },
      {
        label: 'Yes',
        description: 'Display public reasoning summary text when provided by the API',
        value: true,
      },
    ],
    {
      placeHolder: 'Show public reasoning summary in chat?',
    },
  );

  if (!summarySelection) {
    return;
  }

  const preserveSelection = await vscode.window.showQuickPick(
    [
      {
        label: 'No',
        description: 'Do not preserve reasoning history between turns',
        value: false,
      },
      {
        label: 'Yes',
        description: 'Preserve explicitly exposed reasoning history (may increase token usage)',
        value: true,
      },
    ],
    {
      placeHolder: 'Preserve exposed reasoning history across turns?',
    },
  );

  if (!preserveSelection) {
    return;
  }

  const parsedBudget = parseBudgetInput(budgetInput);

  await Promise.all([
    config.update(REASONING_MODE_KEY, modeSelection.mode, vscode.ConfigurationTarget.Global),
    config.update(REASONING_BUDGET_KEY, parsedBudget, vscode.ConfigurationTarget.Global),
    config.update(
      REASONING_SHOW_SUMMARY_KEY,
      summarySelection.value,
      vscode.ConfigurationTarget.Global,
    ),
    config.update(
      REASONING_PRESERVE_HISTORY_KEY,
      preserveSelection.value,
      vscode.ConfigurationTarget.Global,
    ),
  ]);

  vscode.window.showInformationMessage(
    `Qwen reasoning updated: mode=${modeSelection.mode}, summary=${summarySelection.value ? 'on' : 'off'}, preserveHistory=${preserveSelection.value ? 'on' : 'off'}.`,
  );
}

function readReasoningMode(config: vscode.WorkspaceConfiguration): ReasoningMode {
  const candidate = config.get<string>(REASONING_MODE_KEY, 'off');
  if (candidate === 'on' || candidate === 'auto') {
    return candidate;
  }

  return 'off';
}

function parseBudgetInput(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}
