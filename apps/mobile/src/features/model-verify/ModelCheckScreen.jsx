import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModelCheckSection from './ModelCheckSection';
import ModelCheckSummary from './ModelCheckSummary';
import VerificationMenuOptions from './VerificationMenuOptions';
import startCheckAsync from './startCheckAsync';
import useModelCheck from './useModelCheck';

import CatalogStatus from '@/components/CatalogStatus';
import EmptyState from '@/components/EmptyState';
import IconMenuButton from '@/components/IconMenuButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import MenuDivider from '@/components/popup-menu-options/MenuDivider';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { SCREEN_PADDING } from '@/constants';
import useAiCatalog from '@/hooks/useAiCatalog';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useScrollY from '@/hooks/useScrollY';
import { colors, typography } from '@/styles/designTokens';
import findCatalogModel from '@/utils/ai/findCatalogModel';

const KIND_TITLE = { writing: 'Chat check', vision: 'Tagging check' };

// A model's check of a kind (route params `kind`, `modelId`, `name`, and `check` when the caller just
// started it; an ai_admin tool): its progress
// while it runs, then the totals and every turn to read, and in the header menu Run again and the
// model's marks, so the verdict is made right where the replies are.
export default function ModelCheckScreen({ navigation, route }) {
  const { kind, modelId, name, check: startedCheck } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  const { scrollY, onScroll } = useScrollY();
  const { bottom } = useSafeAreaInsets();
  const { models } = useAiCatalog();
  const { check, error, retry, show } = useModelCheck(kind, modelId, startedCheck);

  // The catalog's model, null once Venice no longer offers it (no new run, no marks).
  const model = findCatalogModel(models, modelId);
  const isRunning = check?.status === 'running';

  async function handleRunAgain() {
    const started = await startCheckAsync(kind, model, models);
    if (started) show(started);
  }

  function renderBody() {
    if (check === undefined) return <CatalogStatus title="Couldn't load the check" error={error} retry={retry} />;
    if (check === null) {
      return <EmptyState icon="list-checks" title="Not checked yet" subtitle="Run a check from the menu." />;
    }
    return (
      <>
        {check.status === 'failed' && <EmptyState icon="alert" title="The check failed" subtitle={check.error} />}
        {isRunning && <CheckProgress kind={kind} check={check} />}
        {check.status === 'done' && <ModelCheckSummary kind={kind} check={check} />}
        {check.result?.sections.map((section) => (
          <ModelCheckSection key={section.id} kind={kind} section={section} />
        ))}
      </>
    );
  }

  if (!isAvailable) return null;

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot={name}
        subtitle={KIND_TITLE[kind]}
        scrollY={scrollY}
        rightSlot={
          model && (
            <IconMenuButton accessibilityLabel="Check options">
              {!isRunning && check !== undefined && (
                <>
                  <MenuOption label={check ? 'Run again' : 'Run check'} icon="repeat" onPress={handleRunAgain} />
                  <MenuDivider />
                </>
              )}
              <VerificationMenuOptions kind={kind} model={model} />
            </IconMenuButton>
          )
        }
      />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + SCREEN_PADDING }]}
      >
        {renderBody()}
      </Animated.ScrollView>
    </ModalSheet>
  );
}

// "Turn 7 of 21" / "Photo 2 of 4" with a spinner, above the turns so far.
function CheckProgress({ kind, check }) {
  const unit = kind === 'vision' ? 'Photo' : 'Turn';
  const current = Math.min(check.turnsDone + 1, check.turnsTotal);
  return (
    <View style={styles.progress}>
      <ActivityIndicator color={colors.text.secondary} />
      <Text style={styles.progressText}>
        {unit} {current} of {check.turnsTotal}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: MODAL_HEADER_HEIGHT,
    paddingHorizontal: SCREEN_PADDING,
    gap: 16,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  progressText: {
    fontSize: typography.subheadline,
    color: colors.text.secondary,
  },
});
