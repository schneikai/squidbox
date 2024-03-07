export default function arrayOrMapToArray(arrayOrMap) {
  if (Array.isArray(arrayOrMap)) {
    return arrayOrMap;
  } else {
    return Object.values(arrayOrMap);
  }
}
