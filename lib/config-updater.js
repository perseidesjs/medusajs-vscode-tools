const fs = require('fs');
const path = require('path');

/**
 * Update medusa-config.ts to include the new module
 */
async function updateMedusaConfig(workspacePath, moduleName) {
  const configPath = path.join(workspacePath, 'medusa-config.ts');

  let configContent = '';
  let modulesExist = false;

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

/**
 * Add module to existing config with modules array
 */
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

/**
 * Add modules array to config (when it doesn't exist)
 */
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

module.exports = {
  updateMedusaConfig
};
