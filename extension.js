const vscode = require('vscode');
const { createMedusaModule } = require('./lib/module-creator');
const { updateMedusaConfig } = require('./lib/config-updater');
const { createApiEndpoint } = require('./lib/api-endpoint-creator');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('Medusa Snippets extension is now active!');

  // Register the create module command
  let disposable = vscode.commands.registerCommand('medusa-snippets.createModule', async function () {
    try {
      // Get the workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
        return;
      }

      // Prompt user for module name
      const moduleName = await vscode.window.showInputBox({
        prompt: 'Enter the name of the new Medusa module',
        placeHolder: 'e.g. subscription',
        validateInput: (value) => {
          if (!value) {
            return 'Module name is required';
          }
          if (!/^[a-z0-9_]+$/.test(value)) {
            return 'Module name should contain only lowercase letters, numbers, and underscores';
          }
          return null;
        }
      });

      if (!moduleName) {
        return; // User cancelled
      }

      // Ask if user wants to add models
      const addModels = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Do you want to add data models to this module?'
      });

      if (!addModels) {
        return; // User cancelled
      }

      let modelName = moduleName; // Default to module name
      if (addModels === 'Yes') {
        modelName = await vscode.window.showInputBox({
          prompt: 'Enter the name of the data model',
          placeHolder: `e.g. ${moduleName}`,
          value: moduleName,
          validateInput: (value) => {
            if (!value) {
              return 'Model name is required';
            }
            if (!/^[a-z0-9_]+$/.test(value)) {
              return 'Model name should contain only lowercase letters, numbers, and underscores';
            }
            return null;
          }
        });

        if (!modelName) {
          return; // User cancelled
        }
      }

      // Create the module structure
      await createMedusaModule(workspaceFolder.uri.fsPath, moduleName, addModels === 'Yes', modelName);

      // Update medusa-config.ts
      await updateMedusaConfig(workspaceFolder.uri.fsPath, moduleName);

      vscode.window.showInformationMessage(`Medusa module "${moduleName}" created successfully!`);

      // Notify user about database generation if models were created
      if (addModels === 'Yes') {
        notifyUserToGenerateDB(moduleName);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error creating module: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);

  // Register the create API endpoint command
  let createApiEndpointDisposable = vscode.commands.registerCommand('medusa-snippets.createApiEndpoint', async function () {
    try {
      // Get the workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
        return;
      }

      // Step 1: Prompt for endpoint
      const endpoint = await vscode.window.showInputBox({
        prompt: 'Enter the API endpoint path',
        placeHolder: 'e.g. /admin/custom/analytics',
        validateInput: (value) => {
          if (!value) {
            return 'Endpoint is required';
          }
          if (!value.startsWith('/')) {
            return 'Endpoint must start with /';
          }
          if (!/^\/[a-zA-Z0-9\/_:\[\]-]*$/.test(value)) {
            return 'Endpoint contains invalid characters';
          }
          return null;
        }
      });

      if (!endpoint) {
        return; // User cancelled
      }

      // Step 2: Select HTTP verbs
      const httpVerbs = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      const selectedVerbs = await vscode.window.showQuickPick(httpVerbs, {
        placeHolder: 'Select HTTP methods (use Ctrl/Cmd to select multiple)',
        canPickMany: true
      });

      if (!selectedVerbs || selectedVerbs.length === 0) {
        return; // User cancelled or didn't select any
      }

      // Step 3: Ask if user wants to add middleware group
      const addMiddleware = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Do you want to add a middleware group?'
      });

      if (!addMiddleware) {
        return; // User cancelled
      }

      // Step 4: Ask if user wants to create validators
      const addValidators = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Do you want to create default validators for each matcher?'
      });

      if (!addValidators) {
        return; // User cancelled
      }

      // Create the API endpoint structure
      await createApiEndpoint(
        workspaceFolder.uri.fsPath,
        endpoint,
        selectedVerbs,
        addMiddleware === 'Yes',
        addValidators === 'Yes'
      );

      vscode.window.showInformationMessage(`API endpoint "${endpoint}" created successfully!`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error creating API endpoint: ${error.message}`);
    }
  });

  context.subscriptions.push(createApiEndpointDisposable);
}

/**
 * Notify user to generate database migration
 */
function notifyUserToGenerateDB(moduleName) {
  vscode.window.showInformationMessage(
    `Module '${moduleName}' created with data models. Don't forget to run: npx medusa db:generate ${moduleName}`,
    'Copy Command'
  ).then(selection => {
    if (selection === 'Copy Command') {
      vscode.env.clipboard.writeText(`npx medusa db:generate ${moduleName}`);
      vscode.window.showInformationMessage('Command copied to clipboard!');
    }
  });
}

function deactivate() { }

module.exports = {
  activate,
  deactivate
}
