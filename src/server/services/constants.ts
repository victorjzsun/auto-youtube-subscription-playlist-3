// Shared constants used across the Apps Script logic.

/** Maximum number of videos that can be added in a single run. */
export const MAX_VIDEO_COUNT = 200;

// Debug flags (used for local testing and debugging).
export const DEBUG_FLAG_DONT_UPDATE_TIMESTAMP = false;
export const DEBUG_FLAG_DONT_UPDATE_PLAYLISTS = false;
export const DEBUG_FLAG_LOG_WHEN_NO_NEW_VIDEOS_FOUND = false;

// Reserved Row and Column indices (zero-based).
export const reservedTableRows = 3; // Start of the range of the PlaylistID+ChannelID data
export const reservedTableColumns = 6; // Start of the range of the ChannelID data (0: A, 1: B, ...)
export const reservedColumnPlaylist = 0; // Column containing playlist to add to
export const reservedColumnTimestamp = 1; // Column containing last timestamp
export const reservedColumnFrequency = 2; // Column containing number of hours until new check
export const reservedColumnDeleteDays = 3; // Column containing number of days before today until videos get deleted
export const reservedColumnShortsFilter = 4; // Column containing switch for using shorts filter

// Debug sheet layout constants
export const reservedDebugNumRows = 900; // Number of rows to use in a column before moving on to the next column in debug sheet
export const reservedDebugNumColumns = 26; // Number of columns to use in debug sheet, must be at least 4 to allow infinite cycle
