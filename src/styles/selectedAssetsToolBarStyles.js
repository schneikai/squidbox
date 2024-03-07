import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    padding: 20,
    alignItems: "center",
  },
  toolBar: {
    backgroundColor: "lightgrey",
    borderRadius: 30,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  infoText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "grey",
    marginTop: 8
  },
  toolBarButtons: {
    flexDirection: "row",
  },
  buttonIcon: {
    fontSize: 30,
    padding: 10,
    marginHorizontal: 5,
  },
  buttonIconDanger: {
    color: "darkred",
  }
});
