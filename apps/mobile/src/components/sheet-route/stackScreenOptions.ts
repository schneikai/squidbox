import type { NativeStackNavigationOptions } from 'expo-router/native-stack';

// Every stack's screens draw their own headers.
export const STACK_SCREEN_OPTIONS = { headerShown: false } satisfies NativeStackNavigationOptions;

// A screen of a stack presented as a sheet, framed by SheetRoute (sheetScreenLayout).
export const SHEET_OPTIONS = { presentation: 'modal' } satisfies NativeStackNavigationOptions;
