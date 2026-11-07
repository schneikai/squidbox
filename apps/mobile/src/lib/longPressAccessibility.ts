import type { AccessibilityActionEvent, ViewProps } from 'react-native';

/**
 * The props that let VoiceOver and Switch Control reach what a long press opens (a row's menu):
 * the standard `longpress` action, named `label`, calling `onLongPress`; nothing without one.
 * `actions` are the element's other actions, handled by `onOtherAction`.
 */
export default function longPressAccessibility(
  onLongPress: (() => void) | undefined,
  {
    label = 'Options',
    actions = [],
    onOtherAction,
  }: {
    label?: string;
    actions?: NonNullable<ViewProps['accessibilityActions']>;
    onOtherAction?: (event: AccessibilityActionEvent) => void;
  } = {},
): Pick<ViewProps, 'accessibilityActions' | 'onAccessibilityAction'> {
  const all = onLongPress ? [...actions, { name: 'longpress', label }] : actions;
  if (all.length === 0) return {};
  return {
    accessibilityActions: all,
    onAccessibilityAction: (event) => {
      if (event.nativeEvent.actionName === 'longpress') onLongPress?.();
      else onOtherAction?.(event);
    },
  };
}
