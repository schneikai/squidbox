import { useNavigation } from '@react-navigation/native';
import { aiModelKindSchema, INSTRUCTION_KINDS } from '@squidbox/shared';
import { StyleSheet } from 'react-native';

import personaSummary from './personaSummary';
import useVeniceBalance from './useVeniceBalance';

import DetailScrollView from '@/components/DetailScrollView';
import GradientFill from '@/components/GradientFill';
import Icon from '@/components/Icon';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import modelKindText from '@/features/model-compare/modelKindText';
import useAiCatalog from '@/hooks/useAiCatalog';
import useChosenModels from '@/hooks/useChosenModels';
import useHasFeature from '@/hooks/useHasFeature';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import usePersona from '@/hooks/usePersona';
import useSeedPromptButtons from '@/hooks/useSeedPromptButtons';
import useLibrary from '@/library/useLibrary';
import { colors, radii, sizes } from '@/styles/designTokens';
import { schema } from '@/sync/db/client';
import { countFavorites } from '@/sync/favoritesRepository';
import { readInstructions } from '@/sync/instructionsRepository';
import { countPromptButtons } from '@/sync/promptButtonsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';
import modelsOfKind from '@/utils/ai/modelsOfKind';

// Settings → Assistant: how the assistant writes as you, its prompt buttons, the posts it writes like
// (Favorites), its Rules, and for an ai_admin account the Admin section (the models it uses, what it
// is told before each request: Instructions, what is left on the Venice account). Every other account
// uses the default models, which the Adult content switch picks between.
export default function AssistantScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const persona = usePersona();
  const favoriteCount = useLiveQuery((db) => countFavorites(db), [schema.favorites]);
  const promptButtonCount = useLiveQuery((db) => countPromptButtons(db), [schema.promptButtons]);
  const instructions = useLiveQuery((db) => readInstructions(db, userId), [schema.instructions], [userId]);
  useSeedPromptButtons();
  const isAiAdmin = useHasFeature('ai_admin');

  const changedCount = INSTRUCTION_KINDS.filter((kind) => instructions?.[kind] != null).length;

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title="Assistant" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <Section>
          <Row
            leading={<AssistantMark />}
            label="Writing as you"
            description={persona === undefined ? null : personaSummary(persona)}
            onPress={() => navigation.navigate('VoiceScreen')}
            chevron
          />
        </Section>
        <Section isHeaderless>
          <Row
            leading={<Icon name="prompt-buttons" color={colors.text.secondary} />}
            label="Prompt buttons"
            value={promptButtonCount === undefined ? null : String(promptButtonCount)}
            onPress={() => navigation.navigate('PromptButtonsScreen')}
            chevron
          />
          <Row
            leading={<Icon name="heart" color={colors.status.danger} />}
            label="Favorites"
            value={favoriteCount === undefined ? null : String(favoriteCount)}
            onPress={() => navigation.navigate('FavoritesScreen')}
            chevron
          />
          <Row
            leading={<Icon name="list-checks" color={colors.text.secondary} />}
            label="Rules"
            value={persona === undefined ? null : String(persona?.rules.length ?? 0)}
            onPress={() => navigation.navigate('RulesScreen')}
            chevron
          />
        </Section>
        {isAiAdmin && (
          <AdminSection persona={persona}>
            <Row
              label="Instructions"
              value={instructions === undefined ? null : changedCount > 0 ? `${changedCount} changed` : 'Default'}
              onPress={() => navigation.navigate('InstructionsScreen')}
              chevron
            />
          </AdminSection>
        )}
      </DetailScrollView>
    </Page>
  );
}

// Admin, for an ai_admin account only: the models the assistant uses (for `persona`, usePersona's),
// then `children` (Instructions). Rendered only for one, so no other account reads its model choices
// or loads Venice's models here.
function AdminSection({ persona, children }) {
  const navigation = useNavigation();
  const { models: catalog, defaults } = useAiCatalog();
  const { chosen, usedId } = useChosenModels(persona, defaults);

  // The chosen model's name, or a muted "No longer available" once Venice dropped it (its list
  // says which; a catalog still loading or failed to load leaves the plain name). The name and the
  // label together would wrap the row's label. Without a choice, the default it uses (for the
  // persona's Adult content switch), once the catalog names it.
  function chosenText(kind) {
    if (chosen === undefined || persona === undefined) return { value: null, isGone: false };
    const model = chosen[kind];
    if (!model) {
      const defaultId = usedId(kind);
      const name = catalog && modelsOfKind(catalog, kind).find(({ id }) => id === defaultId)?.name;
      return { value: name ?? null, isGone: false };
    }
    const isGone = !!catalog && !modelsOfKind(catalog, kind).some(({ id }) => id === model.id);
    return { value: isGone ? 'No longer available' : model.name, isGone };
  }

  return (
    <>
      <ScreenSectionHeader title="Admin" />
      <Section>
        {aiModelKindSchema.options.map((kind) => {
          const { value, isGone } = chosenText(kind);
          return (
            <Row
              key={kind}
              label={modelKindText[kind].title}
              value={value}
              isValueMuted={isGone}
              onPress={() => navigation.navigate('ModelListScreen', { kind })}
              chevron
            />
          );
        })}
        {children}
      </Section>
      <VeniceBalanceFooter />
    </>
  );
}

// What is left on the Venice account, read each time the screen comes into focus.
function VeniceBalanceFooter() {
  const balance = useVeniceBalance();
  return <SectionFooter isMuted={balance.isError}>Venice balance: {balance.value ?? '…'}</SectionFooter>;
}

// The assistant's mark: its sparkle on an accent disc.
function AssistantMark() {
  return (
    <GradientFill style={styles.mark}>
      <Icon name="sparkle" size={sizes.icon} color={colors.text.inverse} />
    </GradientFill>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
