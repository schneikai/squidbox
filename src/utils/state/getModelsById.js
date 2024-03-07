export default function getModelsById(ids, models) {
  return ids.map((id) => models[id]);
}
