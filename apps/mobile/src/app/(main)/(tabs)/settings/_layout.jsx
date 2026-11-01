import { Stack } from 'expo-router';

import sheetLayout from '@/components/sheet-route/sheetLayout';
import { SHEET_OPTIONS, STACK_SCREEN_OPTIONS } from '@/components/sheet-route/stackScreenOptions';

// Settings and its sections, pushed. The editors (a prompt button, a rule, instructions) and adding
// models open as sheets. `dangerouslySingular` keeps one screen per URL: one page per model, one
// editor per prompt button; opening one that is open goes back to it.
// A deep link into a section opens it over Settings.
export const unstable_settings = { anchor: 'index' };

export default function SettingsLayout() {
  return (
    <Stack screenOptions={STACK_SCREEN_OPTIONS}>
      <Stack.Screen name="assistant/models/[kind]/[modelId]/index" dangerouslySingular />
      <Stack.Screen name="assistant/models/[kind]/[modelId]/verify/index" dangerouslySingular />
      <Stack.Screen name="assistant/models/[kind]/[modelId]/verify/[sectionId]" dangerouslySingular />
      <Stack.Screen name="assistant/models/[kind]/add" options={SHEET_OPTIONS} layout={sheetLayout} />
      <Stack.Screen
        name="assistant/prompt-buttons/[id]"
        options={SHEET_OPTIONS}
        layout={sheetLayout}
        dangerouslySingular
      />
      <Stack.Screen name="assistant/prompt-buttons/new" options={SHEET_OPTIONS} layout={sheetLayout} />
      <Stack.Screen name="assistant/rules/[index]" options={SHEET_OPTIONS} layout={sheetLayout} dangerouslySingular />
      <Stack.Screen name="assistant/rules/new" options={SHEET_OPTIONS} layout={sheetLayout} />
      <Stack.Screen
        name="assistant/instructions/[kind]"
        options={SHEET_OPTIONS}
        layout={sheetLayout}
        dangerouslySingular
      />
    </Stack>
  );
}
