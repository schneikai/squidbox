import { Alert } from 'react-native';

// react-native-web's Alert does nothing, so on web every confirmation (delete, log out, …) would be
// skipped without a word. Show them with the browser's dialogs instead: a cancel button plus one
// other maps to confirm(), more choices to a numbered prompt().
Alert.alert = (title, message, buttons = [{ text: 'OK' }]) => {
  const text = [title, message].filter(Boolean).join('\n\n');
  const cancel = buttons.find((button) => button.style === 'cancel');
  const choices = buttons.filter((button) => button !== cancel);

  if (choices.length <= 1 && !cancel) {
    window.alert(text);
    choices[0]?.onPress?.();
  } else if (choices.length <= 1) {
    (window.confirm(text) ? choices[0] : cancel)?.onPress?.();
  } else {
    const list = choices.map((button, i) => `${i + 1}. ${button.text}`).join('\n');
    const picked = choices[Number(window.prompt(`${text}\n\n${list}`)) - 1];
    (picked ?? cancel)?.onPress?.();
  }
};

Alert.prompt = (title, message, callbackOrButtons, type, defaultValue) => {
  const value = window.prompt([title, message].filter(Boolean).join('\n\n'), defaultValue ?? '');
  if (typeof callbackOrButtons === 'function') {
    if (value !== null) callbackOrButtons(value);
    return;
  }
  const buttons = callbackOrButtons ?? [];
  const cancel = buttons.find((button) => button.style === 'cancel');
  const confirm = buttons.find((button) => button !== cancel);
  if (value === null) cancel?.onPress?.();
  else confirm?.onPress?.(value);
};
