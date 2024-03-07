import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#f2f2f2",
    borderRadius: 30,
    padding: 5,
  },
  button: {
    backgroundColor: "lightgrey", 
    borderRadius: 30,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    margin: 5,
  },
  buttonActive: {
    backgroundColor: "turquoise",
  },
  buttonDanger: {
    backgroundColor: "red",
  },
  buttonWarning: {
    backgroundColor: "orange",
  },
  buttonText: {
    fontSize: 20,
  },
  buttonIcon: {
    fontSize: 20,
  },
  buttonIconWarning: {
    color: "darkred",
  },
});
