const APP_NAME = 'Squidbox';
export const SCREEN_PADDING = 16;
// A touch that moves further is a drag, not a tap.
export const TAP_SLOP = 10;
// Live reads of stats are slow (a few hundred ms): during a write burst (a pull, a bulk action, a
// backup) they re-read at most about once a second.
export const MIN_REREAD_INTERVAL = 1000;
export const MEDIA_LIBRARY_ALBUM_NAME = APP_NAME;

export const UPLOAD_MEDIA_FROM_DEVICE = 'From Device';
export const UPLOAD_MEDIA_FROM_APP = `From ${APP_NAME}`;
