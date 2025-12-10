const fs = require('fs');
const path = require('path');
const { createMiddlewareGroup } = require('./middlewares');

/**
 * Create API endpoint structure
 */
async function createApiEndpoint(workspacePath, endpoint, httpVerbs, addMiddleware, addValidators) {
  // Parse endpoint path to create directory structure
  // e.g., /admin/custom/analytics -> src/api/admin/custom/analytics/route.ts
  // e.g., /admin/subscriptions/:id/orders -> src/api/admin/subscriptions/[id]/orders/route.ts
  const apiPath = path.join(workspacePath, 'src', 'api');
  
  // Remove leading slash and split path
  // Convert path parameters from :param to [param] format for file system
  const pathParts = endpoint
    .replace(/^\//, '')
    .split('/')
    .map(part => {
      // Convert :param to [param] for path parameters
      if (part.startsWith(':')) {
        return `[${part.substring(1)}]`;
      }
      return part;
    });
  
  const routeDir = path.join(apiPath, ...pathParts);
  
  // Check if src/api directory exists
  if (!fs.existsSync(apiPath)) {
    fs.mkdirSync(apiPath, { recursive: true });
  }

  // Check if route already exists
  const routeFile = path.join(routeDir, 'route.ts');
  if (fs.existsSync(routeFile)) {
    throw new Error(`API route at "${endpoint}" already exists`);
  }

  // Create directory structure
  fs.mkdirSync(routeDir, { recursive: true });

  // Create route.ts file with all selected HTTP methods
  const routeContent = getRouteTemplate(endpoint, httpVerbs);
  fs.writeFileSync(routeFile, routeContent);

  // Create middleware group if requested
  if (addMiddleware) {
    await createMiddlewareGroup(workspacePath, routeDir, endpoint, httpVerbs, addValidators);
  }
}

/**
 * Generate route.ts file template
 */
function getRouteTemplate(endpoint, httpVerbs) {
  const imports = `import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";`;
  
  let handlers = [];
  
  httpVerbs.forEach(verb => {
    if (verb === 'GET') {
      handlers.push(`export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

 // Use the query here

  res.json({message:"Return your entities"})
};`);
    } else if (verb === 'POST') {
      handlers.push(`export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  // Add your POST logic here
  res.status(201).json({ message: "[POST] Success" });
};`);
    } else if (verb === 'PUT') {
      handlers.push(`export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  // Add your PUT logic here
  res.json({ message: "[PUT] Success" });
};`);
    } else if (verb === 'PATCH') {
      handlers.push(`export const PATCH = async (req: MedusaRequest, res: MedusaResponse) => {
  // Add your PATCH logic here
  res.json({ message: "[PATCH] Success" });
};`);
    } else if (verb === 'DELETE') {
      handlers.push(`export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  // Add your DELETE logic here
  res.status(204).send();
};`);
    }
  });

  // Add ContainerRegistrationKeys import if GET is present
  const containerImport = httpVerbs.includes('GET') 
    ? `\n\nimport { ContainerRegistrationKeys } from "@medusajs/framework/utils";`
    : '';

  return `${imports}${containerImport}

${handlers.join('\n\n')}
`;
}

module.exports = {
  createApiEndpoint
};
