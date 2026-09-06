import FilterMenuOptions from '@/components/popup-menu-options/FilterMenuOptions';
import PopupMenu from '@/components/popup-menu-options/PopupMenu';

export default function FilterPostsAction({ activeFilter, onPress }) {
  return (
    <PopupMenu icon="filter" warning={!!activeFilter.length}>
      <FilterMenuOptions filters={['favorites']} onPress={onPress} activeFilter={activeFilter} />
    </PopupMenu>
  );
}
