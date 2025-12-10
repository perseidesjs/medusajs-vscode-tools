const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

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
}

async function createMedusaModule(workspacePath, moduleName, hasModels, modelName) {
  const modulesPath = path.join(workspacePath, 'src', 'modules');
  const modulePath = path.join(modulesPath, moduleName);

  // Check if src/modules directory exists
  if (!fs.existsSync(modulesPath)) {
    fs.mkdirSync(modulesPath, { recursive: true });
  }

  // Check if module already exists
  if (fs.existsSync(modulePath)) {
    throw new Error(`Module "${moduleName}" already exists`);
  }

  // Create module directory
  fs.mkdirSync(modulePath);

  // Create models directory and model file only if models are requested
  if (hasModels) {
    const modelsPath = path.join(modulePath, 'models');
    fs.mkdirSync(modelsPath);

    // Create a basic model file
    const modelContent = getModelTemplate(modelName);
    fs.writeFileSync(path.join(modelsPath, `${modelName}.ts`), modelContent);
  }

  // Create index.ts
  const indexContent = getIndexTemplate(moduleName, hasModels, modelName);
  fs.writeFileSync(path.join(modulePath, 'index.ts'), indexContent);

  // Create service.ts
  const serviceContent = getServiceTemplate(moduleName, hasModels, modelName);
  fs.writeFileSync(path.join(modulePath, 'service.ts'), serviceContent);
}

async function updateMedusaConfig(workspacePath, moduleName) {
  const configPath = path.join(workspacePath, 'medusa-config.ts');

  let configContent = '';
  let modulesExist = false;
  let modulesArray = [];

  // Check if medusa-config.ts exists
  if (fs.existsSync(configPath)) {
    configContent = fs.readFileSync(configPath, 'utf8');

    // Check if modules key exists
    if (configContent.includes('modules:')) {
      modulesExist = true;
    }
  }

  if (modulesExist) {
    // Parse and update existing modules array
    configContent = addModuleToExistingConfig(configContent, moduleName);
  } else {
    // Create new modules array or add it to existing config
    configContent = addModulesArrayToConfig(configContent, moduleName);
  }

  // Write the updated config
  fs.writeFileSync(configPath, configContent);
}

function addModuleToExistingConfig(configContent, moduleName) {
  // Find the modules array and add the new module
  const moduleEntry = `    {
      resolve: "./src/modules/${moduleName}",
    },`;

  // Look for the top-level modules array by finding "modules:" at the start of a line
  // followed by "[" and then find the matching closing bracket
  const lines = configContent.split('\n');
  let modulesStartIndex = -1;
  let modulesEndIndex = -1;
  let bracketCount = 0;
  let inModulesArray = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Find the start of the modules array
    if (line.startsWith('modules:') && line.includes('[')) {
      modulesStartIndex = i;
      inModulesArray = true;
      // Count opening brackets in this line
      bracketCount = (line.match(/\[/g) || []).length - (line.match(/\]/g) || []).length;
      continue;
    }

    if (inModulesArray) {
      // Count brackets in this line
      const openBrackets = (line.match(/\[/g) || []).length;
      const closeBrackets = (line.match(/\]/g) || []).length;
      bracketCount += openBrackets - closeBrackets;

      // If we've reached the matching closing bracket for the modules array
      if (bracketCount <= 0) {
        modulesEndIndex = i;
        break;
      }
    }
  }

  if (modulesStartIndex !== -1 && modulesEndIndex !== -1) {
    // Insert the new module before the closing bracket of the modules array
    lines.splice(modulesEndIndex, 0, moduleEntry);
    return lines.join('\n');
  }

  // Fallback to the old method if we can't find the modules array precisely
  const modulesArrayPattern = /(modules:\s*\[)([\s\S]*?)(\s*\],?)/;
  return configContent.replace(modulesArrayPattern, (match, opening, content, closing) => {
    return `${opening}${content}${content.trim() ? '\n' : ''}${moduleEntry}${closing}`;
  });
}

function addModulesArrayToConfig(configContent, moduleName) {
  const moduleEntry = `  modules: [
    {
      resolve: "./src/modules/${moduleName}",
    },
  ],`;

  if (configContent.trim() === '') {
    // Create new config file
    return `import { defineConfig } from "@medusajs/framework/utils"

module.exports = defineConfig({
  projectConfig: {
    // ...
  },
${moduleEntry}
})
`;
  } else {
    const configEndPattern = /(\s*)(}\s*\)\s*;?\s*$)/;
    return configContent.replace(configEndPattern, (match, whitespace, closing) => {
      // Check if there's already a comma before the closing brace
      const beforeClosing = configContent.substring(0, configContent.lastIndexOf(closing));
      const lastNonWhitespace = beforeClosing.trim().slice(-1);

      // If the last non-whitespace character is not a comma, add one
      const commaNeeded = lastNonWhitespace !== ',' && lastNonWhitespace !== '{';
      const comma = commaNeeded ? ',' : '';

      return `${comma}${whitespace}${moduleEntry}${whitespace}${closing}`;
    });
  }
}

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

function getIndexTemplate(moduleName, hasModels, modelName) {
  const className = toPascalCase(moduleName);
  const moduleConstant = moduleName.toUpperCase().replace(/-/g, '_') + '_MODULE';

  return `import { Module } from "@medusajs/framework/utils"
import ${className}Service from "./service"

export const ${moduleConstant} = "${moduleName}"

export default Module(${moduleConstant}, {
  service: ${className}Service
})
`;
}

function getServiceTemplate(moduleName, hasModels, modelName) {
  const className = toPascalCase(moduleName);

  if (hasModels) {
    // Service with models - extends MedusaService
    return `import { MedusaService } from "@medusajs/framework/utils"
import ${toPascalCase(modelName)} from "./models/${modelName}"

class ${className}Service extends MedusaService({
  ${toPascalCase(modelName)}
}) {
}

export default ${className}Service
`;
  } else {
    // Service without models - regular class
    return `class ${className}Service {
}

export default ${className}Service
`;
  }
}

function getModelTemplate(modelName) {
  const className = toPascalCase(modelName);
  return `import { model } from "@medusajs/framework/utils"

const ${className} = model.define("${modelName}", {
  id: model.id().primaryKey(),
  name: model.text(),
  // Add your model properties here
})

export default ${className}
`;
}

function toPascalCase(str) {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function deactivate() { }

module.exports = {
  activate,
  deactivate
}
