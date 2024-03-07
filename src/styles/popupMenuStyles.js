import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  menuOptions : { 
    optionsContainer: {  
      marginTop: 52, 
      backgroundColor: 'rgba(220, 220, 220, 0.96)', 
      borderRadius: 10, 
      shadowColor: "transparent"
    }, 
    optionsWrapper: { }
  },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "silver",
  },
  menuOptionLast: {
    borderBottomWidth: 0,
  },
  menuOptionText: {
    fontSize: 16,
  },
  menuOptionIcon: {
    fontSize: 20,
  }
});
