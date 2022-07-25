import { useReducer } from "react";
import { initialState, reducer, Context } from "components/AssetBackgroundUploader/Context";
import BackgroundUploader from "components/AssetBackgroundUploader/BackgroundUploader";

export default function Provider(props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = { state, dispatch };
  return (
    <Context.Provider value={value}>
      {props.children}
      <BackgroundUploader />
    </Context.Provider>
  );
}
