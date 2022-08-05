import { createContext } from "react";

export const initialState = {
  isPaused: true,
  totalNumber: 0,
  currentNumber: 1,
  statusMessage: "",
};

export function reducer(state, action) {
  switch (action.type) {
    case "setTotalNumber":
      return { ...state, totalNumber: action.payload };
    case "setCurrentNumber":
      return { ...state, currentNumber: action.payload };
    case "incrementCurrentNumber":
      return { ...state, currentNumber: Math.min(state.totalNumber, state.currentNumber + 1) };
    case "setIsPaused":
      return { ...state, isPaused: action.payload };
    case "setStatusMessage":
      return { ...state, statusMessage: action.payload };
    default:
      return state;
  }
}

export const Context = createContext();
