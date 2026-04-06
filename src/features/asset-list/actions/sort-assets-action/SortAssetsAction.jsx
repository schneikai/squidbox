import PopupMenu from '@/components/popup-menu-options/PopupMenu';
import TwoChoiceMenuOption from '@/components/popup-menu-options/TwoChoiceMenuOption';
import popupMenuStyles from '@/styles/popupMenuStyles';

export default function SortAssetsAction({ sortOrder, onPress }) {
  return (
    <PopupMenu icon="sort">
      <TwoChoiceMenuOption
        label="Created at"
        onPressOptionA={() => onPress('createdAt:asc')}
        onPressOptionB={() => onPress('createdAt:desc')}
        optionASelected={sortOrder === 'createdAt:asc'}
        optionBSelected={sortOrder === 'createdAt:desc'}
      />
      <TwoChoiceMenuOption
        label="Last posted"
        onPressOptionA={() => onPress('lastPostedAt:asc')}
        onPressOptionB={() => onPress('lastPostedAt:desc')}
        optionASelected={sortOrder === 'lastPostedAt:asc'}
        optionBSelected={sortOrder === 'lastPostedAt:desc'}
        style={popupMenuStyles.menuOptionLast}
      />
    </PopupMenu>
  );
}
