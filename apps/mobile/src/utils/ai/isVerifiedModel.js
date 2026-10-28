/** Whether Squidbox verified the model (a catalog model) for this kind: the server's marks. */
export default function isVerifiedModel(kind, model) {
  return model.verifiedKinds.includes(kind);
}
