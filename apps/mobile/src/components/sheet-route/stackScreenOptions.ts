import type { NativeStackNavigationOptions } from 'expo-router';

// Every stack's screens draw their own headers.
export const STACK_SCREEN_OPTIONS = { headerShown: false } satisfies NativeStackNavigationOptions;

// A screen of a stack presented as a sheet, framed by SheetRoute (sheetScreenLayout).
export const SHEET_OPTIONS = { presentation: 'modal' } satisfies NativeStackNavigationOptions;

// A screen a sheet's stack shows as a page over the whole sheet, not pushed inside it: the photo
// screen, which wants the whole screen, as it has in the main app (pageOverSheetLayout).
export const PAGE_OVER_SHEET_OPTIONS = { presentation: 'fullScreenModal' } satisfies NativeStackNavigationOptions;
