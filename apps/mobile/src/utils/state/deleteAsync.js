export default async function deleteAsync({ ids, setState }) {
  let updatedState;

  setState((state) => {
    updatedState = { ...state };
    for (const id of ids) {
      delete updatedState[id];
    }
    return updatedState;
  });
}
