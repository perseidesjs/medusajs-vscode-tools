const { generateValidatorName } = require('./utils');

/**
 * Generate validator names for all HTTP verbs
 */
function generateValidatorNames(endpoint, httpVerbs) {
  return httpVerbs.map(verb => generateValidatorName(endpoint, verb));
}

/**
 * Generate validators.ts file content
 */
function getValidatorsTemplate(validatorNames, httpVerbs) {
  // Create a single validators.ts file with all validators
  let validators = [];
  let needsCreateFindParams = false;
  let needsZod = false;
  
  validatorNames.forEach((validatorName, index) => {
    const verb = httpVerbs[index];
    
    if (verb === 'GET') {
      needsCreateFindParams = true;
      needsZod = true;
      validators.push(`export const ${validatorName} = createFindParams({
  offset: 0,
  limit: 10,
})

export type ${validatorName} = z.infer<
  typeof ${validatorName}
>;`);
    } else if (['POST', 'PUT', 'PATCH'].includes(verb)) {
      needsZod = true;
      validators.push(`export const ${validatorName} = z.object({
})

export type ${validatorName} = z.infer<typeof ${validatorName}>;`);
    } else if (verb === 'DELETE') {
      needsZod = true;
      validators.push(`export const ${validatorName} = z.object({
})

export type ${validatorName} = z.infer<typeof ${validatorName}>;`);
    }
  });

  // Build imports
  let imports = [];
  if (needsCreateFindParams) {
    imports.push('import { createFindParams } from "@medusajs/medusa/api/utils/validators";');
  }
  if (needsZod) {
    imports.push('import { z } from "zod";');
  }

  return `${imports.join('\n')}

${validators.join('\n\n')}
`;
}

module.exports = {
  generateValidatorNames,
  getValidatorsTemplate
};
