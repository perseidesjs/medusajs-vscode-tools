const fs = require('fs');
const path = require('path');
const { toPascalCase } = require('./utils');

/**
 * Create Medusa module structure
 */
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

/**
 * Generate index.ts template
 */
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

/**
 * Generate service.ts template
 */
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

/**
 * Generate model template
 */
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

module.exports = {
  createMedusaModule
};
