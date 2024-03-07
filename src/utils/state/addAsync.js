// Heads-up: data must be an array of objects or a single object (not a map)
export default async function addAsync({ data: initialData, schema, setState }) {
  const newModels = {};
  let data, hasOneData;

  if (Array.isArray(initialData)) {
    data = initialData;
    hasOneData = false;
  } else {
    data = [initialData];
    hasOneData = true;
  }

  if (!Array.isArray(data)) throw new Error('data must be an array of objects');
  if (!data.length) return;

  for (const modelData of data) {
    const model = schema.cast(modelData);
    await schema.validate(model, { strict: true });
    newModels[model.id] = model;
  }

  setState((state) => {
    const updatedState = { ...state, ...newModels };
    return updatedState;
  });

  return hasOneData ? Object.values(newModels)[0] : Object.values(newModels);
}
