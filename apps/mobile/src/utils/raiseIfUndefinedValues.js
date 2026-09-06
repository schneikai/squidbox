// Added this guard to prevent undefined values from being saved.
// For empty values use null.
export default function raiseIfUndefinedValues(obj) {
  const undefinedKeys = Object.keys(obj).filter((key) => obj[key] === undefined);

  if (undefinedKeys.length > 0) {
    throw new Error(`Undefined values found in: ${undefinedKeys.join(', ')}`);
  }
}
