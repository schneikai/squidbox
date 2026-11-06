/** Wraps a press handler, e.g. to drop a touch that dragged the details panel instead (useDetailsPanelDrag's). */
export type GuardPress = (onPress: () => void) => () => void;

/** The GuardPress that guards nothing: the default where no guard is passed. */
export default function unguarded(onPress: () => void) {
  return onPress;
}
