import { useNavigation } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import ActionButtons from '@/components/ActionButtons';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import ChangedBadge from '@/components/ChangedBadge';
import ChatBubble from '@/components/ChatBubble';
import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import DetailScrollView from '@/components/DetailScrollView';
import Divider from '@/components/Divider';
import EmptyState from '@/components/EmptyState';
import Field from '@/components/Field';
import Icon from '@/components/Icon';
import IntroText from '@/components/IntroText';
import OptionCard from '@/components/OptionCard';
import Page from '@/components/Page';
import ProgressRing from '@/components/ProgressRing';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import SearchInput from '@/components/SearchInput';
import SelectIndicator from '@/components/SelectIndicator';
import Switch from '@/components/Switch';
import Text from '@/components/Text';
import TextInput from '@/components/TextInput';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import WarningNote from '@/components/WarningNote';
import AccountButton from '@/components/floating-bars/AccountButton';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import FloatingPill from '@/components/floating-bars/FloatingPill';
import SegmentedPill from '@/components/floating-bars/SegmentedPill';
import ToolbarTitle from '@/components/floating-bars/ToolbarTitle';
import MenuItemContent from '@/components/popup-menu-options/MenuItemContent';
import PopoverSurface from '@/components/popup-menu-options/PopoverSurface';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import { colors, sizes } from '@/styles/designTokens';
import popupMenuStyles from '@/styles/popupMenuStyles';

const CATEGORIES = ['Toolbars', 'Buttons', 'Surfaces', 'Lists', 'Inputs', 'Text', 'Status', 'Icons'];

const TAB_ITEMS = [
  { key: 'library', icon: 'grid', label: 'Library' },
  { key: 'albums', icon: 'folder', label: 'Albums' },
  { key: 'posts', icon: 'share-alt', label: 'Posts' },
];

const ICON_NAMES = [
  'add',
  'alert',
  'apps',
  'archive',
  'arrow-down',
  'arrow-up',
  'award',
  'calendar',
  'check',
  'check-circle',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'clock',
  'close',
  'close-circle',
  'cloud-check',
  'cloud-download',
  'cloud-offline',
  'copy',
  'document',
  'download',
  'edit',
  'eye',
  'eye-off',
  'filter',
  'flame',
  'folder',
  'grid',
  'hash',
  'heart',
  'image',
  'images',
  'info',
  'library',
  'link',
  'list',
  'lock',
  'map-pin',
  'megaphone',
  'menu',
  'message-circle',
  'mountain',
  'options',
  'pause',
  'pencil',
  'play',
  'prompt-buttons',
  'quote',
  'repeat',
  'search',
  'share',
  'share-alt',
  'sort',
  'sparkle',
  'star',
  'tag',
  'thread',
  'thumbs-up',
  'trash',
  'undo',
  'user',
  'video',
];

const noop = () => {};

/**
 * Developer → Components: every shared component in its variants, one category at a time, to look
 * at a change to the design (a token, a component's look) across the app in one place and to
 * screenshot it.
 */
export default function ComponentGalleryScreen() {
  const navigation = useNavigation();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [activeTab, setActiveTab] = useState('library');
  const [isOn, setIsOn] = useState(true);
  const [selectedTags, setSelectedTags] = useState(['Hiking']);
  const [text, setText] = useState('');
  const popoverProgress = useRef(new Animated.Value(1)).current;

  function toggleTag(tag) {
    setSelectedTags((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]));
  }

  function renderToolbars() {
    return (
      <>
        <Specimen name="FloatingPill">
          <FloatingPill>
            <Button icon="search" accessibilityLabel="Search" onPress={noop} />
            <Button icon="options" accessibilityLabel="Filter" onPress={noop} />
          </FloatingPill>
          <FloatingPill>
            <Button icon="check-circle" accessibilityLabel="Select" onPress={noop} />
            <Button variant="primary" icon="add" accessibilityLabel="Add" onPress={noop} />
          </FloatingPill>
          <FloatingPill>
            <Button icon="chevron-left" accessibilityLabel="Back" onPress={noop} />
          </FloatingPill>
        </Specimen>
        <Specimen name="SegmentedPill">
          <SegmentedPill items={TAB_ITEMS} activeKey={activeTab} onSelect={setActiveTab} />
        </Specimen>
        <Specimen name="ToolbarTitle">
          <ToolbarTitle title="Settings" />
          <ToolbarTitle title="Sunrise at the lake" subtitle="Jul 14 · Lake Tahoe" />
        </Specimen>
        <Specimen name="AccountButton">
          <AccountButton onPress={noop} />
        </Specimen>
        <Specimen name="PopoverSurface + MenuItemContent">
          <PopoverSurface progress={popoverProgress} origin="top left" style={styles.popover}>
            <View style={popupMenuStyles.row}>
              <MenuItemContent label="Sort" isHeader />
            </View>
            <View style={popupMenuStyles.row}>
              <MenuItemContent label="Newest first" icon="arrow-down" isSelected />
            </View>
            <View style={popupMenuStyles.row}>
              <MenuItemContent label="Oldest first" icon="arrow-up" />
            </View>
            <Divider variant="menu" />
            <View style={popupMenuStyles.row}>
              <MenuItemContent label="Delete" icon="trash" colorPalette="danger" />
            </View>
          </PopoverSurface>
        </Specimen>
      </>
    );
  }

  function renderButtons() {
    return (
      <>
        <Specimen name="Button · primary">
          <Button variant="primary" label="Save post" onPress={noop} style={styles.fill} />
        </Specimen>
        <Specimen name="Button · primary, small / icon / loading / disabled">
          <Button variant="primary" size="small" label="Save" onPress={noop} />
          <Button variant="primary" icon="add" accessibilityLabel="Add" onPress={noop} />
          <Button variant="primary" size="small" label="Save" loading onPress={noop} />
          <Button variant="primary" size="small" label="Save" disabled onPress={noop} />
        </Specimen>
        <Specimen name="Button · secondary">
          <Button variant="secondary" icon="close" accessibilityLabel="Close" onPress={noop} />
          <Button variant="secondary" icon="share" accessibilityLabel="Share" onPress={noop} />
          <Button variant="secondary" label="18+" onPress={noop} />
          <Button variant="secondary" icon="trash" colorPalette="danger" accessibilityLabel="Delete" onPress={noop} />
        </Specimen>
        <Specimen name="Button · tertiary icons">
          <Button icon="heart" colorPalette="favorite" accessibilityLabel="Favorite" onPress={noop} />
          <Button icon="heart" colorPalette="favorite" filled isSelected accessibilityLabel="Favorite" onPress={noop} />
          <Button icon="edit" colorPalette="neutral" accessibilityLabel="Edit" onPress={noop} />
          <Button icon="sparkle" colorPalette="accent" accessibilityLabel="Assistant" onPress={noop} />
          <Button icon="trash" colorPalette="danger" accessibilityLabel="Delete" onPress={noop} />
          <Button icon="star" iconCount={2} accessibilityLabel="Two stars" onPress={noop} />
        </Specimen>
        <Specimen name="Button · text links">
          <Button label="Show all" onPress={noop} />
          <Button icon="add" label="Add album" onPress={noop} />
          <Button label="Reset" size="small" onPress={noop} />
          <Button label="Delete" colorPalette="danger" onPress={noop} />
        </Specimen>
        <Specimen name="ActionButtons">
          <ActionButtons
            actions={[
              { label: 'Reset changes', onPress: noop },
              { label: 'Delete album', colorPalette: 'danger', onPress: noop },
            ]}
          />
        </Specimen>
        <Specimen name="Chip">
          <ChipRow>
            {['Hiking', 'Sunrise', 'Coast'].map((tag) => (
              <Chip key={tag} label={tag} isSelected={selectedTags.includes(tag)} onPress={() => toggleTag(tag)} />
            ))}
            <Chip variant="action" icon="sparkle" label="Make it shorter" onPress={noop} />
            <Chip variant="add" label="Add" onPress={noop} />
            <Chip label="Disabled" disabled onPress={noop} />
          </ChipRow>
        </Specimen>
      </>
    );
  }

  function renderSurfaces() {
    return (
      <>
        <Specimen name="Card">
          <Card style={styles.fill}>
            <View style={styles.cardContent}>
              <Text>A card resting on the page, with text inside it.</Text>
            </View>
          </Card>
        </Specimen>
        <Specimen name="OptionCard">
          <View style={styles.fill}>
            <OptionCard text="Golden hour on the ridge. Worth the 5 am start, every single time. 🌄">
              <Button icon="heart" colorPalette="favorite" accessibilityLabel="Favorite" onPress={noop} />
              <Button label="Use" onPress={noop} />
            </OptionCard>
          </View>
        </Specimen>
        <Specimen name="ChatBubble">
          <View style={styles.fill}>
            <ChatBubble side="user" label="New post" text="Write a post about the sunrise hike" />
            <ChatBubble side="assistant" text="Here are three takes on your sunrise hike." />
          </View>
        </Specimen>
        <Specimen name="WarningNote">
          <WarningNote style={styles.fill}>This instruction text is missing its {'{voice}'} placeholder.</WarningNote>
        </Specimen>
      </>
    );
  }

  function renderLists() {
    return (
      <View style={styles.fill}>
        <ScreenSectionHeader title="Section" />
        <Section>
          <Row label="Plain row" value="Value" />
          <Row label="Opens a screen" onPress={noop} hasChevron />
          <Row label="With description" description="Secondary text under the label" onPress={noop} hasChevron />
          <Row label="Selected" isSelected onPress={noop} />
          <Row label="With icon" leading={<Icon name="cloud-check" color={colors.accent.base} />} onPress={noop} />
          <Row label="A switch">
            <Switch value={isOn} onValueChange={setIsOn} accessibilityLabel="A switch" />
          </Row>
          <Row label="Small row" size="small" onPress={noop} hasChevron />
          <Row label="Sign out" colorPalette="danger" onPress={noop} hasChevron />
        </Section>
        <SectionFooter>A footer explains the section above it.</SectionFooter>
        <ScreenSectionHeader title="With trailing" trailing={<Button label="Edit" size="small" onPress={noop} />} />
        <Section>
          <Row label="Disabled" disabled onPress={noop} hasChevron />
        </Section>
      </View>
    );
  }

  function renderInputs() {
    return (
      <View style={styles.fields}>
        <Field label="Field" description="A description under the field explains what goes in it.">
          <TextInput variant="field" value={text} onChangeText={setText} placeholder="Type here" />
        </Field>
        <Field label="Multiline" onInfo={noop}>
          <TextInput variant="field" multiline placeholder="A longer text" />
        </Field>
        <Field label="Search">
          <SearchInput variant="field" placeholder="Search models" />
        </Field>
        <Specimen name="Switch">
          <Switch value={isOn} onValueChange={setIsOn} accessibilityLabel="On" />
          <Switch value={!isOn} onValueChange={(value) => setIsOn(!value)} accessibilityLabel="Off" />
        </Specimen>
      </View>
    );
  }

  function renderText() {
    return (
      <View style={styles.fill}>
        <IntroText isScreenIntro>IntroText says what a screen is for, above its content.</IntroText>
        <Specimen name="Text · reading">
          <Text>Long text someone reads: a post, a model's answer.</Text>
        </Specimen>
        <Specimen name="Text · hint">
          <Text variant="hint">Small grey text that explains.</Text>
        </Specimen>
        <Specimen name="Text · label">
          <Text variant="label">A field's name</Text>
        </Specimen>
        <Specimen name="Text · error">
          <Text variant="error">Couldn't save the post.</Text>
          <Text variant="error" size="small">
            A smaller error under another line.
          </Text>
        </Specimen>
        <Specimen name="IntroText with label">
          <IntroText label="Sees">coastline, tent, morning fog</IntroText>
        </Specimen>
      </View>
    );
  }

  function renderStatus() {
    return (
      <>
        <Specimen name="Badge">
          <Badge label="Archived" tone="danger" />
          <Badge label="Verified" tone="success" />
          <Badge label="New" tone="accent" />
          <Badge label="Beta" tone="info" />
          <ChangedBadge />
        </Specimen>
        <Specimen name="SelectIndicator">
          <SelectIndicator isSelected />
          <SelectIndicator isSelected={false} />
          <View style={styles.media}>
            <SelectIndicator isSelected={false} isOnMedia />
          </View>
        </Specimen>
        <Specimen name="ThumbnailBadge">
          <View style={styles.media}>
            <ThumbnailBadge label="0:11" />
          </View>
          <View style={styles.media}>
            <ThumbnailBadge icon="images" label="+3" />
          </View>
        </Specimen>
        <Specimen name="ProgressRing">
          <View style={styles.scrim}>
            <ProgressRing value={62} />
          </View>
        </Specimen>
        <Specimen name="EmptyState">
          <EmptyState icon="images" title="No photos yet" subtitle="Photos you add show up here." style={styles.fill} />
        </Specimen>
      </>
    );
  }

  function renderIcons() {
    return (
      <View style={styles.icons}>
        {ICON_NAMES.map((name) => (
          <View key={name} style={styles.iconCell}>
            <Icon name={name} size={sizes.icon} color={colors.text.primary} />
            <Text variant="hint" size="small" style={styles.iconName}>
              {name}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  const RENDERERS = {
    Toolbars: renderToolbars,
    Buttons: renderButtons,
    Surfaces: renderSurfaces,
    Lists: renderLists,
    Inputs: renderInputs,
    Text: renderText,
    Status: renderStatus,
    Icons: renderIcons,
  };

  return (
    <Page>
      <FloatingDetailHeader title="Components" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <ChipRow>
          {CATEGORIES.map((name) => (
            <Chip
              key={name}
              label={name}
              isSelected={name === category}
              onPress={() => setCategory(name)}
              accessibilityRole="tab"
            />
          ))}
        </ChipRow>
        <View style={styles.category}>{RENDERERS[category]()}</View>
      </DetailScrollView>
    </Page>
  );
}

// One component's name over its variants, side by side.
function Specimen({ name, children }) {
  return (
    <View style={styles.specimen}>
      <Text variant="label">{name}</Text>
      <View style={styles.variants}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  category: {
    marginTop: 20,
  },
  specimen: {
    marginBottom: 24,
    gap: 10,
  },
  variants: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  fill: {
    width: '100%',
  },
  fields: {
    width: '100%',
    gap: 20,
  },
  scrim: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: colors.overlay.scrim,
  },
  cardContent: {
    padding: 16,
  },
  popover: {
    position: 'relative',
    width: sizes.popoverWidth,
  },
  media: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.background.media,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconCell: {
    width: 76,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  iconName: {
    textAlign: 'center',
  },
});
