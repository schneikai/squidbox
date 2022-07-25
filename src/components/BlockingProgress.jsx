import { createContext, useReducer, useContext } from "react";
import { StyleSheet, View, Text } from "react-native";
import CircularProgress from "react-native-circular-progress-indicator";

const initialState = {
  isVisible: false,
  message: null,
  progress: 0,
};

function reducer(state, action) {
  switch (action.type) {
    case "show":
      return { ...state, isVisible: true, progress: 0, message: null };
    case "hide":
      return { ...state, isVisible: false, progress: 0, message: null };
    case "setMessage":
      return { ...state, message: action.payload };
    case "setProgress":
      return { ...state, progress: action.payload };
    default:
      return state;
  }
}

export const BlockingProgressContext = createContext();

export function BlockingProgressProvider(props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = { state, dispatch };
  return (
    <BlockingProgressContext.Provider value={value}>
      {state.isVisible && (
        <View style={styles.container}>
          <CircularProgress value={state.progress} />
          {state.message && <Text style={styles.message}>{state.message}</Text>}
        </View>
      )}
      {props.children}
    </BlockingProgressContext.Provider>
  );
}

export function useBlockingProgress() {
  const { state, dispatch } = useContext(BlockingProgressContext);

  function show() {
    dispatch({
      type: "show",
    });
  }

  function hide() {
    dispatch({
      type: "hide",
    });
  }

  function updateProgress(progress) {
    dispatch({
      type: "setProgress",
      payload: progress,
    });
  }

  function updateMessage(progress) {
    dispatch({
      type: "setMessage",
      payload: progress,
    });
  }

  return { show, hide, updateProgress, updateMessage };
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  message: {
    color: "#2ecc71",
    maxWidth: 200,
    textAlign: "center",
    marginTop: 10,
    fontWeight: "600",
  },
});
