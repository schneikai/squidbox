import FilterMenuOptions from '@/components/popup-menu-options/FilterMenuOptions';
import PopupMenu from '@/components/popup-menu-options/PopupMenu';

export default function FilterAlbumsAction({ activeFilter, onPress }) {
  return (
    <PopupMenu icon="filter" warning={!!activeFilter.length}>
      <FilterMenuOptions filters={['starred', 'archived']} onPress={onPress} activeFilter={activeFilter} />
    </PopupMenu>
  );
}
