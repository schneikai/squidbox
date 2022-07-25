import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 20,
  },
  columns: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  centerColumn: {
    justifyContent: "center",
  },
  rightColumn: {
    justifyContent: "flex-end",
  },
  headerLabel: {
    fontWeight: "500",
    fontSize: 16,
  },
});
