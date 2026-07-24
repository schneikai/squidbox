import getTimestamp from '@/utils/date-time/getTimestamp';

// Applies per-model partial updates in a single state write.
// updatesById: { [id]: partialUpdates }
export default async function updateManyAsync({ updatesById, setState }) {
  const ids = Object.keys(updatesById);
  if (ids.length === 0) return;

  const updatedAt = getTimestamp();

  setState((prevState) => {
    const updatedState = { ...prevState };

    for (const id of ids) {
      const model = updatedState[id];
      if (!model) continue;
      updatedState[id] = { ...model, ...updatesById[id], updatedAt };
    }

    return updatedState;
  });
}
