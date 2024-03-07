import getTimestamp from '@/utils/date-time/getTimestamp';

export default async function updateAsync({ models, updates, schema, setState }) {
  if (!models.length) return;

  // Add updatedAt
  const updatesWithTimestamp = {
    updatedAt: getTimestamp(),
    ...updates,
  };

  // Validate updates
  for (const model of models) {
    const updatedModel = { ...model, ...updatesWithTimestamp };
    if (updatedModel.hasOwnProperty('updatedAt')) {
      updatedModel.updatedAt = getTimestamp();
    }
    await schema.validate(updatedModel, { strict: true });
  }

  // Write updates
  setState((prevState) => {
    const updatedState = { ...prevState };

    for (const id of models.map((model) => model.id)) {
      const model = updatedState[id];
      if (!model) continue;
      const updatedModel = {
        ...model,
        ...updatesWithTimestamp,
      };
      updatedState[id] = updatedModel;
    }

    return updatedState;
  });
}
