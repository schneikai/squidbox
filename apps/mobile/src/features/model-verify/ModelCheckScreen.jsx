import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModelCheckSection from './ModelCheckSection';
import ModelCheckSummary from './ModelCheckSummary';
import VerificationMenuOptions from './VerificationMenuOptions';
import confirmCheckAsync from './confirmCheckAsync';
import useModelCheck from './useModelCheck';

import EmptyState from '@/components/EmptyState';
import IconMenuButton from '@/components/IconMenuButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import TextButton from '@/components/TextButton';
import MenuDivider from '@/components/popup-menu-options/MenuDivider';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { SCREEN_PADDING } from '@/constants';
import useAiCatalog from '@/hooks/useAiCatalog';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useScrollY from '@/hooks/useScrollY';
import { colors, typography } from '@/styles/designTokens';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

const KIND_TITLE = { writing: 'Chat check', vision: 'Tagging check' };

// A model's check of a kind (route params `kind`, `modelId`, `name`; an ai_admin tool): its progress
// while it runs, then the totals and every turn to read, and in the header menu Run again and the
// model's marks, so the verdict is made right where the replies are.
export default function ModelCheckScreen({ navigation, route }) {
  const { kind, modelId, name } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  const { scrollY, onScroll } = useScrollY();
  const { bottom } = useSafeAreaInsets();
  const { models } = useAiCatalog();
  const { check, error, retry, start } = useModelCheck(kind, modelId);

  // The catalog's model, null once Venice no longer offers it (no new run, no marks).
  const model = models?.find(({ id }) => id === modelId) ?? null;
  const isRunning = check?.status === 'running';

  async function handleRunAgain() {
    if (!(await confirmCheckAsync(kind, model, models))) return;
    try {
      await start();
    } catch (startError) {
      Alert.alert("Couldn't start the check", apiErrorMessage(startError));
    }
  }

  function renderBody() {
    if (check === undefined) {
      if (error) {
        return (
          <View>
            <EmptyState icon="alert" title="Couldn't load the check" subtitle={error} />
            <TextButton label="Try again" onPress={retry} />
          </View>
        );
      }
      return <ActivityIndicator style={styles.loading} color={colors.text.secondary} />;
    }
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
  loading: {
    paddingVertical: 40,
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
