import PopupMenu from '@/components/popup-menu-options/PopupMenu';
import TwoChoiceMenuOption from '@/components/popup-menu-options/TwoChoiceMenuOption';
import popupMenuStyles from '@/styles/popupMenuStyles';

export default function SortPostsAction({ sortOrder, onPress }) {
  return (
    <PopupMenu icon="sort">
      <TwoChoiceMenuOption
        label="Posted"
        onPressOptionA={() => onPress('postedAt:asc')}
        onPressOptionB={() => onPress('postedAt:desc')}
        optionASelected={sortOrder === 'postedAt:asc'}
        optionBSelected={sortOrder === 'postedAt:desc'}
        style={popupMenuStyles.menuOptionLast}
      />
    </PopupMenu>
  );
}
