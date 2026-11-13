import { DEFAULT_PROMPT_BUTTONS } from '@squidbox/shared';
import { useNavigation } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import ActionButtons from '@/components/ActionButtons';
import AssistantTray from '@/components/AssistantTray';
import Badge from '@/components/Badge';
import Bubble from '@/components/Bubble';
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
import Icon, { ICON_NAMES } from '@/components/Icon';
import IntroText from '@/components/IntroText';
import ModalHeader from '@/components/ModalHeader';
import Note from '@/components/Note';
import OptionCard from '@/components/OptionCard';
import Page from '@/components/Page';
import ProgressRing from '@/components/ProgressRing';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import SelectIndicator from '@/components/SelectIndicator';
import SheetSearchField from '@/components/SheetSearchField';
import Switch from '@/components/Switch';
import Text from '@/components/Text';
import TextInput from '@/components/TextInput';
import ThumbnailBadge from '@/components/ThumbnailBadge';
import WarningNote from '@/components/WarningNote';
import AccountButton from '@/components/floating-bars/AccountButton';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import FloatingPill from '@/components/floating-bars/FloatingPill';
import SegmentedPill, { type SegmentedPillItem } from '@/components/floating-bars/SegmentedPill';
import ToolbarTitle from '@/components/floating-bars/ToolbarTitle';
import MenuItemContent from '@/components/popup-menu-options/MenuItemContent';
import PopoverSurface from '@/components/popup-menu-options/PopoverSurface';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import ChannelBubbles from '@/features/channels/ChannelBubbles';
import ChannelLogo from '@/features/channels/ChannelLogo';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import IdeasCarousel from '@/features/post-ideas/IdeasCarousel';
import type { IdeasRun } from '@/features/post-ideas/ideasRun';
import PromptButtonRow from '@/features/prompt-buttons/PromptButtonRow';
import { colors, layout, radii, sizes, space } from '@/styles/designTokens';
import popupMenuStyles from '@/styles/popupMenuStyles';

type GalleryTab = 'library' | 'albums' | 'contacts' | 'posts';

const TAB_ITEMS: SegmentedPillItem<GalleryTab>[] = [
  { key: 'library', icon: 'image', label: 'Library' },
  { key: 'albums', icon: 'images', label: 'Albums' },
  { key: 'contacts', icon: 'contacts', label: 'Contacts' },
  { key: 'posts', icon: 'send', label: 'Posts' },
];

// The categories, in the order of the chips.
const CATEGORIES = ['Toolbars', 'Buttons', 'Surfaces', 'Lists', 'Inputs', 'Text', 'Status', 'Icons'] as const;
type Category = (typeof CATEGORIES)[number];

const noop = () => {};

// Tags a viewer can take off one by one; Add brings them back.
const GALLERY_TAGS = ['Hiking', 'Sunrise', 'Coast'];

// The prompt buttons a library starts with, for the AssistantTray's row.
const PROMPT_BUTTONS = DEFAULT_PROMPT_BUTTONS.slice(0, 4);

// The AssistantTray's Chat, and its ideas while written and once they came.
const CHAT_CHIP = <Chip variant="raised" icon="message-circle" label="Chat" onPress={noop} />;
const WRITING_RUN: IdeasRun = {
  name: 'Post ideas',
  prompt: '',
  isOwnIdeas: true,
  items: [],
  isWriting: true,
  error: null,
  canClose: false,
  isFolded: false,
};
const IDEAS_RUN: IdeasRun = {
  ...WRITING_RUN,
  isWriting: false,
  items: [
    'Golden hour on the ridge. Worth the 5 am start, every single time.',
    'Sunrise or sunset: which one gets you out of bed?',
    'The trail was empty, the coffee was cold, and then the fog lifted all at once.',
  ].map((text, index) => ({ replyId: 'gallery', index, text, isUsed: false })),
};

// A popover shown open, as if it had finished growing.
const POPOVER_SHOWN = new Animated.Value(1);

/**
 * Developer → Components: every shared component in its variants, one category at a time, to look
 * at a change to the design (a token, a component's look) across the app in one place and to
 * screenshot it.
 */
export default function ComponentGalleryScreen() {
  const navigation = useNavigation();
  const [category, setCategory] = useState<Category>('Toolbars');
  const [activeTab, setActiveTab] = useState<GalleryTab>('library');
  const [isOn, setIsOn] = useState(true);
  const [tags, setTags] = useState(GALLERY_TAGS);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');

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
          <PopoverSurface progress={POPOVER_SHOWN} origin="top left" style={styles.popover}>
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
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                onRemove={() => setTags(tags.filter((each) => each !== tag))}
                removeLabel={`Remove ${tag}`}
              />
            ))}
            <Chip
              label="Sam Rivera"
              leading={<ContactAvatar contact={{ name: 'Sam Rivera' }} size="chip" />}
              onPress={noop}
              onRemove={noop}
              removeLabel="Remove Sam Rivera"
            />
            <Chip variant="lead" icon="sparkle" label="Post ideas" onPress={noop} />
            <Chip variant="raised" icon="scissors" label="Shorter" onPress={noop} />
            <Chip variant="mixed" label="sunset" onPress={noop} onRemove={noop} removeLabel="Remove sunset" />
            <Chip variant="add" label="Add" onPress={() => setTags(GALLERY_TAGS)} />
            <Chip label="Disabled" disabled onPress={noop} />
          </ChipRow>
        </Specimen>
        <Specimen name="Bubble">
          <View accessibilityRole="tablist" style={styles.bubbles}>
            <Bubble label="X" mark={<ChannelLogo channelId="x" />} onPress={noop} />
            <Bubble label="Bluesky" mark={<ChannelLogo channelId="bluesky" />} isSelected onPress={noop} />
            <Bubble label="OnlyFans PPV" mark={<ChannelLogo channelId="onlyfans-ppv" />} onPress={noop} />
            <Bubble label="No channel" onPress={noop} />
            <Bubble variant="add" label="Add channel" accessibilityRole="button" onPress={noop} />
          </View>
          <View style={styles.bubbles}>
            <Bubble label="OnlyFans" mark={<ChannelLogo channelId="onlyfans" />} isSelected hasCaret onPress={noop} />
            <Bubble label="OnlyFans PPV" mark={<ChannelLogo channelId="onlyfans-ppv" />} isSelected />
          </View>
          <View style={styles.bubbles}>
            <ChannelBubbles channelIds={['bluesky', 'x', 'onlyfans-ppv']} />
          </View>
        </Specimen>
      </>
    );
  }

  function renderSurfaces() {
    return (
      <>
        <Specimen name="Card">
          <Card padded style={styles.fill}>
            <Text>A card resting on the page, with text inside it.</Text>
          </Card>
        </Specimen>
        <Specimen name="AssistantTray: pick">
          <AssistantTray title="Write with AI" trailing={CHAT_CHIP} style={styles.fill}>
            <PromptButtonRow
              buttons={PROMPT_BUTTONS}
              onPress={noop}
              lead={<Chip variant="lead" icon="sparkle" label="Post ideas" onPress={noop} />}
            />
          </AssistantTray>
        </Specimen>
        <Specimen name="AssistantTray: writing">
          <AssistantTray title="Writing ideas…" isWorking trailing={CHAT_CHIP} style={styles.fill}>
            <IdeasCarousel run={WRITING_RUN} onUse={null} onMore={noop} onRetry={noop} isBusy />
          </AssistantTray>
        </Specimen>
        <Specimen name="AssistantTray: ideas">
          <AssistantTray title="Ideas" trailing={CHAT_CHIP} style={styles.fill}>
            <IdeasCarousel run={IDEAS_RUN} onUse={noop} onMore={noop} onRetry={noop} isBusy={false} />
          </AssistantTray>
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
        <Specimen name="Note">
          <Note tone="tint" style={styles.fill}>
            <Text>Golden hour on the ridge, worth the early start.</Text>
          </Note>
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
        <ScreenSectionHeader title="With a link" link={{ label: 'See all 12', onPress: noop }} />
        <ScreenSectionHeader title="Tap the title" onTitlePress={noop} link={{ label: 'All lists', onPress: noop }} />
        <ScreenSectionHeader
          title="With the assistant's offer"
          trailing={<Button label="Tag it" icon="sparkle" size="small" onPress={noop} />}
        />
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
        <Field label="SheetSearchField, under a sheet's ModalHeader">
          {/* The top of a picker sheet, edge to edge: the field places itself under the header. */}
          <View style={styles.sheetTop}>
            <ModalHeader
              leading={<Button icon="close" accessibilityLabel="Close" onPress={noop} />}
              title="Add models"
            />
            <SheetSearchField value={search} onChangeText={setSearch} placeholder="Search models…" />
          </View>
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
        <Specimen name="Text · heading">
          <Text variant="heading">Setting up your library</Text>
        </Specimen>
        <Specimen name="Text · assistant">
          <Text variant="assistant">Write with AI</Text>
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
          <SelectIndicator isSelected="mixed" />
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

  // One per category.
  const renderers: Record<Category, () => ReactNode> = {
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
        <View style={styles.category}>{renderers[category]()}</View>
      </DetailScrollView>
    </Page>
  );
}

type SpecimenProps = { name: string; children: ReactNode };

// One component's name over its variants, side by side.
function Specimen({ name, children }: SpecimenProps) {
  return (
    <Field label={name} style={styles.specimen}>
      <View style={styles.variants}>{children}</View>
    </Field>
  );
}

const styles = StyleSheet.create({
  category: {
    marginTop: layout.sectionGap,
  },
  specimen: {
    marginBottom: space.xxl,
  },
  variants: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.md,
  },
  fill: {
    width: '100%',
  },
  bubbles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  fields: {
    width: '100%',
    gap: space.xl,
  },
  sheetTop: {
    marginHorizontal: -layout.sideGutter,
  },
  scrim: {
    padding: space.xxl,
    borderRadius: radii.card,
    backgroundColor: colors.overlay.scrim,
  },
  popover: {
    position: 'relative',
    width: sizes.popoverWidth,
  },
  media: {
    width: 64,
    height: 64,
    borderRadius: radii.cover,
    backgroundColor: colors.background.media,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  iconCell: {
    width: 76,
    alignItems: 'center',
    gap: layout.iconGap,
    paddingVertical: space.sm,
  },
  iconName: {
    textAlign: 'center',
  },
});
