import PopupMenu from '@/components/popup-menu-options/PopupMenu';
import FilterMenuOptions from '@/components/popup-menu-options/FilterMenuOptions';

export default function FilterAlbumsAction({ activeFilter, onPress }) {
  return (
    <PopupMenu icon="filter" warning={!!activeFilter.length}>
      <FilterMenuOptions filters={['starred', 'archived']} onPress={onPress} activeFilter={activeFilter} />
    </PopupMenu>
  );
}
