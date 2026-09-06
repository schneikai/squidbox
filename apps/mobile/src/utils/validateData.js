export default function validateData(value, type, propName, { defaultValue = null, allowNull = false } = {}) {
  // If value is undefined, use defaultValue (which itself is null by default)
  const valueOrDefault = value === undefined || value === null ? defaultValue : value;

  // Check for null after considering defaultValue
  if (valueOrDefault === null && !allowNull) {
    throw new Error(`Property ${propName} is null and null is not allowed.`);
  }

  // Type checking should only occur if the value is not null
  if (valueOrDefault !== null && detailedTypeOf(valueOrDefault) !== type) {
    throw new Error(`Invalid type for ${propName}. Expected ${type}, got ${typeof valueOrDefault}.`);
  }

  return valueOrDefault;
}

function detailedTypeOf(value) {
  // Check if the value is an array
  if (Array.isArray(value)) {
    return 'array';
  }
  // For all other types, return the result of the typeof operator
  return typeof value;
}
