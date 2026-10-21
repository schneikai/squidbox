import { openLibraryId } from './current';

// Whether a failed switch is the boot error (LibraryProvider): once booted, a switch that left no
// library open (the previous one wouldn't reopen either) asks for a restart, which opens the
// session's library again. During the boot it isn't: openLibraryForSession falls back to the
// session's own library, and bootLibrary's rejection is the boot error.
export function isFatalSwitchFailure(booted: boolean): boolean {
  return booted && openLibraryId() === null;
}
