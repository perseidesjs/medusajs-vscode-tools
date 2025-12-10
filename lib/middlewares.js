const fs = require('fs');
const path = require('path');
const { toCamelCase } = require('./utils');
const { generateValidatorNames, getValidatorsTemplate } = require('./validators');

/**
 * Create middleware group file in the endpoint directory
 */
async function createMiddlewareGroup(workspacePath, routeDir, endpoint, httpVerbs, addValidators) {
  // Generate middleware group name from endpoint
  const middlewareName = toCamelCase(endpoint) + 'Middlewares';
  const middlewareFilePath = path.join(routeDir, 'middlewares.ts');

  // Check if middleware file already exists
  if (fs.existsSync(middlewareFilePath)) {
    throw new Error(`Middleware file "middlewares.ts" already exists in this directory`);
  }

  // Create validators if requested
  let validatorImport = '';
  const validatorNames = [];
  
  if (addValidators) {
    const validatorsFilePath = path.join(routeDir, 'validators.ts');
    
    // Check if validators file already exists
    if (fs.existsSync(validatorsFilePath)) {
      throw new Error(`Validators file "validators.ts" already exists in this directory`);
    }

    // Generate validator names for each HTTP verb
    validatorNames.push(...generateValidatorNames(endpoint, httpVerbs));

    // Create single validators.ts file with all validators
    const validatorsContent = getValidatorsTemplate(validatorNames, httpVerbs);
    fs.writeFileSync(validatorsFilePath, validatorsContent);
    
    // Add import for validators
    validatorImport = `import { ${validatorNames.join(', ')} } from "./validators"\n`;
  }

  // Determine which validate functions are needed
  const needsValidateQuery = addValidators && httpVerbs.includes('GET');
  const needsValidateBody = addValidators && httpVerbs.some(v => ['POST', 'PUT', 'PATCH'].includes(v));

  // Create middleware entries for each HTTP verb
  const middlewareEntries = httpVerbs.map((verb, index) => {
    let middlewareEntry = `  {
    method: ["${verb}"],
    matcher: "${endpoint}",`;
    
    if (addValidators && validatorNames[index]) {
      const validatorName = validatorNames[index];
      if (verb === 'GET') {
        middlewareEntry += `
    middlewares: [
      validateAndTransformQuery(${validatorName}, {})
    ],`;
      } else if (['POST', 'PUT', 'PATCH'].includes(verb)) {
        middlewareEntry += `
    middlewares: [
      validateAndTransformBody(${validatorName})
    ],`;
      } else {
        // DELETE or other methods
        middlewareEntry += `
    middlewares: [],`;
      }
    } else {
      middlewareEntry += `
    middlewares: [],`;
    }
    
    middlewareEntry += `
  }`;
    return middlewareEntry;
  });

  // Build middleware content with imports
  let middlewareImports = ['MiddlewareRoute'];
  if (needsValidateQuery) {
    middlewareImports.push('validateAndTransformQuery');
  }
  if (needsValidateBody) {
    middlewareImports.push('validateAndTransformBody');
  }

  let middlewareContent = `import {
  ${middlewareImports.join(',\n  ')}
} from "@medusajs/framework";
`;
  
  if (validatorImport) {
    middlewareContent += validatorImport;
  }

  middlewareContent += `
export const ${middlewareName}: MiddlewareRoute[] = [
${middlewareEntries.join(',\n')},
];
`;

  fs.writeFileSync(middlewareFilePath, middlewareContent);

  // Update or create middlewares.ts or middlewares/index.ts
  // Calculate relative path from src/api/middlewares.ts to the endpoint folder
  const apiPath = path.join(workspacePath, 'src', 'api');
  const relativePath = path.relative(apiPath, routeDir);
  await updateMiddlewaresFile(workspacePath, middlewareName, relativePath);
}

/**
 * Update or create the main middlewares.ts file
 */
async function updateMiddlewaresFile(workspacePath, middlewareName, relativePath) {
  // Check for middlewares.ts first
  let middlewaresPath = path.join(workspacePath, 'src', 'api', 'middlewares.ts');
  let isIndexFile = false;
  
  // If middlewares.ts doesn't exist, check for middlewares/index.ts
  if (!fs.existsSync(middlewaresPath)) {
    const middlewaresIndexPath = path.join(workspacePath, 'src', 'api', 'middlewares', 'index.ts');
    if (fs.existsSync(middlewaresIndexPath)) {
      middlewaresPath = middlewaresIndexPath;
      isIndexFile = true;
    } else {
      // Create new middlewares.ts file
      // Convert Windows path separators to forward slashes for import
      const importPath = relativePath.replace(/\\/g, '/');
      const newMiddlewaresContent = `import { 
  defineMiddlewares,
  MedusaNextFunction, 
  MedusaRequest, 
  MedusaResponse, 
} from "@medusajs/framework/http"
import { ${middlewareName} } from "./${importPath}/middlewares"

export default defineMiddlewares({
  routes: [
    ...${middlewareName},
  ],
})
`;
      fs.writeFileSync(middlewaresPath, newMiddlewaresContent);
      return;
    }
  }

  // Read existing middlewares file
  let content = fs.readFileSync(middlewaresPath, 'utf8');
  
  // Convert Windows path separators to forward slashes for import
  const importPath = relativePath.replace(/\\/g, '/');
  
  // Check if it uses defineMiddlewares (new format) or exports array (old format)
  if (content.includes('defineMiddlewares')) {
    // New format - update it
    content = addMiddlewareToDefineMiddlewares(content, middlewareName, importPath, isIndexFile);
  } else {
    // Old format or different structure - try to add import and spread
    content = addMiddlewareToExistingFile(content, middlewareName, importPath, isIndexFile);
  }

  fs.writeFileSync(middlewaresPath, content);
}

/**
 * Add middleware to defineMiddlewares format
 */
function addMiddlewareToDefineMiddlewares(content, middlewareName, importPath, isIndexFile) {
  // Build the full import path
  const fullImportPath = `./${importPath}/middlewares`;
  
  // Check if import already exists
  if (content.includes(`import { ${middlewareName} }`)) {
    // Import exists, just need to add to routes array
  } else {
    // Add import at the top
    const importStatement = `import { ${middlewareName} } from "${fullImportPath}"`;
    
    // Find the last import statement
    const importRegex = /^import\s+.*$/gm;
    const imports = content.match(importRegex);
    
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertIndex = lastImportIndex + lastImport.length;
      content = content.slice(0, insertIndex) + '\n' + importStatement + content.slice(insertIndex);
    } else {
      // No imports found, add at the beginning
      content = importStatement + '\n' + content;
    }
  }

  // Add to routes array
  // Find the routes array in defineMiddlewares - handle multiline with proper bracket matching
  const lines = content.split('\n');
  let routesStartIndex = -1;
  let routesEndIndex = -1;
  let bracketCount = 0;
  let inRoutesArray = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Find the start of routes array
    if (line.includes('routes:') && line.includes('[')) {
      routesStartIndex = i;
      inRoutesArray = true;
      bracketCount = (line.match(/\[/g) || []).length - (line.match(/\]/g) || []).length;
      continue;
    }
    
    if (inRoutesArray) {
      const openBrackets = (line.match(/\[/g) || []).length;
      const closeBrackets = (line.match(/\]/g) || []).length;
      bracketCount += openBrackets - closeBrackets;
      
      if (bracketCount <= 0) {
        routesEndIndex = i;
        break;
      }
    }
  }
  
  if (routesStartIndex !== -1 && routesEndIndex !== -1) {
    // Check if middleware is already in the routes array
    const routesSection = lines.slice(routesStartIndex, routesEndIndex + 1).join('\n');
    if (routesSection.includes(`...${middlewareName}`)) {
      return content; // Already added
    }
    
    // Insert the spread operator before the closing bracket
    const insertLine = routesEndIndex;
    const insertContent = lines[insertLine];
    const indentMatch = insertContent.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '    ';
    
    // Check if there's already content in the array
    const hasContent = lines.slice(routesStartIndex + 1, routesEndIndex).some(line => line.trim() !== '');
    const separator = hasContent ? ',\n' : '';
    
    lines.splice(insertLine, 0, `${indent}${separator}...${middlewareName}`);
    return lines.join('\n');
  }

  // Fallback: use regex replacement
  const routesArrayPattern = /(routes:\s*\[)([\s\S]*?)(\s*\])/;
  if (routesArrayPattern.test(content)) {
    content = content.replace(routesArrayPattern, (match, opening, routesContent, closing) => {
      if (routesContent.includes(`...${middlewareName}`)) {
        return match; // Already added
      }
      const trimmedContent = routesContent.trim();
      const separator = trimmedContent ? ',\n    ' : '';
      return `${opening}${trimmedContent}${separator}...${middlewareName}${closing}`;
    });
  }

  return content;
}

/**
 * Add middleware to existing file (fallback for non-defineMiddlewares format)
 */
function addMiddlewareToExistingFile(content, middlewareName, importPath, isIndexFile) {
  // Build the full import path
  const fullImportPath = `./${importPath}/middlewares`;
  
  // Add import
  const importStatement = `import { ${middlewareName} } from "${fullImportPath}"`;
  
  // Try to add import at the top
  const lines = content.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      lastImportIndex = i;
    } else if (lastImportIndex !== -1 && lines[i].trim() !== '') {
      break;
    }
  }
  
  if (lastImportIndex !== -1) {
    lines.splice(lastImportIndex + 1, 0, importStatement);
  } else {
    lines.unshift(importStatement);
  }
  
  return lines.join('\n');
}

module.exports = {
  createMiddlewareGroup,
  updateMiddlewaresFile
};
