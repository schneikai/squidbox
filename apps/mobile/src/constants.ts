import { layout } from '@/styles/designTokens';

const APP_NAME = 'Squidbox';
export const SCREEN_PADDING = layout.sideGutter;
// A touch that moves further is a drag, not a tap.
export const TAP_SLOP = 10;
// While a grid's lifted cell peeks, the finger may drift this far before it drags or selects: a held
// finger moves more than a tap's slop in the time it takes to peek.
export const PEEK_DRAG_SLOP = 30;
// A drag-to-reorder lifts after a hold longer than a slow tap, so a tap always opens what it lands on
// (UIKit's long press is 500 ms), and the lifted item pops to this scale.
export const DRAG_LONG_PRESS_MS = 400;
// How long a grid's lifted cell (drag-reorder, drag-select) is held still before it peeks: after the
// lift, so a drag that starts right away never flashes the quick view first.
export const PEEK_AFTER_LIFT_MS = 400;
export const DRAG_LIFT_SCALE = 1.08;
// Live reads of stats are slow (a few hundred ms): during a write burst (a pull, a bulk action, a
// backup) they re-read at most about once a second.
export const MIN_REREAD_INTERVAL = 1000;

export const UPLOAD_MEDIA_FROM_DEVICE = 'From Device';
export const UPLOAD_MEDIA_FROM_APP = `From ${APP_NAME}`;
