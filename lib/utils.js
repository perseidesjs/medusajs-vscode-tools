/**
 * Utility functions for string transformations
 */

function toPascalCase(str) {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function toCamelCase(str) {
  return str
    .replace(/^\//, '') // Remove leading slash
    .replace(/[:\[\]]/g, '') // Remove path parameter markers
    .split(/[-_\/]/)
    .filter(word => word.length > 0) // Filter out empty strings
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}

function toKebabCase(str) {
  // Remove leading slash and convert to kebab-case
  return str
    .replace(/^\//, '')
    .replace(/[:\[\]]/g, '') // Remove path parameter markers
    .replace(/[\/_]/g, '-')
    .toLowerCase();
}

function generateValidatorName(endpoint, httpVerb) {
  // Pattern: <GROUP><SUBGROUP><VERB>Params
  // Example: /admin/custom -> AdminCustomGetParams
  // Example: /admin/custom/analytics -> AdminCustomAnalyticsGetParams
  // Example: /admin/resource/:id -> AdminResourceResourceParams (path param uses previous segment name)
  
  // Remove leading slash and split by /
  const parts = endpoint.replace(/^\//, '').split('/');
  
  // Convert each part to PascalCase
  const pascalParts = parts.map((part, index) => {
    if (part.startsWith(':')) {
      // Path parameter: use the previous segment's name
      // Example: /admin/resource/:id -> use "Resource" from previous segment
      if (index > 0) {
        const previousPart = parts[index - 1];
        return previousPart
          .split(/[-_]/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join('');
      }
      // If path param is first (shouldn't happen, but handle it)
      const paramName = part.substring(1);
      return paramName.charAt(0).toUpperCase() + paramName.slice(1).toLowerCase();
    }
    // Regular segment: convert to PascalCase
    return part
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  });
  
  // Convert HTTP verb to PascalCase (Get, Post, etc.)
  const verbPascal = httpVerb.charAt(0) + httpVerb.slice(1).toLowerCase();
  
  // Combine: <GROUP><SUBGROUP>...<VERB>Params
  return pascalParts.join('') + verbPascal + 'Params';
}

module.exports = {
  toPascalCase,
  toCamelCase,
  toKebabCase,
  generateValidatorName
};
