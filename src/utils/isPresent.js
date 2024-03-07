export default function isPresent(value) {
  // Check for null or undefined
  if (value === null || value === undefined) {
    return false;
  }

  // Check for strings
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  // Check for arrays
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  // For numbers (including 0), return true
  if (typeof value === 'number') {
    return true;
  }

  // Check for objects (excluding null, arrays are already handled)
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  // For booleans and functions
  return true;
}
