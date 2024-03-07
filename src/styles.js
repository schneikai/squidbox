import { StyleSheet } from 'react-native';

// TODO: Define colors, fonts, etc. here
// https://coolors.co/palette/ffbe0b-fb5607-ff006e-8338ec-3a86ff

export default StyleSheet.create({
  screenHeader: {
    marginTop: 60,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenHeaderTitle: {
    fontSize: 32,
  },

  screenHeaderNavigation: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    borderRadius: 30,
    padding: 5,
  },
  screenHeaderNavigationButton: {
    backgroundColor: 'lightgrey',
    borderRadius: 30,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 5,
  },
  screenHeaderNavigationButtonActive: {
    backgroundColor: 'turquoise',
  },
  screenHeaderNavigationButtonText: {},
  screenHeaderNavigationButtonIcon: {
    fontSize: 20,
  },
  screenHeaderNavigationButtonIconWarning: {
    color: 'darkred',
  },

  sortDropdown: {
    position: 'absolute',
    top: 60,
    right: 0,
    backgroundColor: 'lightgrey',
    borderRadius: 10,
    zIndex: 1,
    width: 200,
  },
  sortDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'grey',
  },
  sortDropdownOptionText: {
    fontSize: 15,
  },

  sortDropdownOptionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  sortDropdownOptionButton: {
    backgroundColor: 'grey',
    borderRadius: 40,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortDropdownOptionButtonActive: {
    backgroundColor: 'turquoise',
  },
  sortDropdownOptionButtonText: {
    fontSize: 16,
  },
});
