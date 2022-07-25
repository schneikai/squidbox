// This hook returns the height of the screen keyboard.
// I use this to position a toolbar above the keyboard just like on Twitter
// https://stackoverflow.com/questions/46587006/how-to-get-a-height-of-a-keyboard-in-react-native

import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

export default function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  function onKeyboardDidShow(e) {
    setKeyboardHeight(e.endCoordinates.height);
  }

  function onKeyboardDidHide() {
    setKeyboardHeight(0);
  }

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", onKeyboardDidShow);
    const hideSubscription = Keyboard.addListener("keyboardDidHide", onKeyboardDidHide);
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return keyboardHeight;
}
