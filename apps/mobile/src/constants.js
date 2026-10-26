const APP_NAME = 'Squidbox';
export const SCREEN_PADDING = 16;
// A touch that moves further is a drag, not a tap.
export const TAP_SLOP = 10;
// A drag-to-reorder lifts after a hold longer than a slow tap, so a tap always opens what it lands on
// (UIKit's long press is 500 ms), and the lifted item pops to this scale.
export const DRAG_LONG_PRESS_MS = 400;
export const DRAG_LIFT_SCALE = 1.08;
// Live reads of stats are slow (a few hundred ms): during a write burst (a pull, a bulk action, a
// backup) they re-read at most about once a second.
export const MIN_REREAD_INTERVAL = 1000;
export const MEDIA_LIBRARY_ALBUM_NAME = APP_NAME;

export const UPLOAD_MEDIA_FROM_DEVICE = 'From Device';
export const UPLOAD_MEDIA_FROM_APP = `From ${APP_NAME}`;
