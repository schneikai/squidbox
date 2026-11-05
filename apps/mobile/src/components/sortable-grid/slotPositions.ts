// The `positions` a sortable grid's cells read: each row id's slot in `ids`.
export default function slotPositions(ids: string[]) {
  return Object.fromEntries(ids.map((id, slot) => [id, slot]));
}
