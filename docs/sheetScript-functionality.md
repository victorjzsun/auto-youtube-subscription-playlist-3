# SheetScript.gs Functionality Documentation

## Overview

This is a Google Apps Script that automatically adds new YouTube videos to playlists, serving as a replacement for YouTube's deprecated Collections feature. The script monitors YouTube channels and playlists, adding new videos to user-defined playlists based on configurable rules.

**GitHub**: https://github.com/Elijas/auto-youtube-subscription-playlist-2/  
**Template Spreadsheet**: https://docs.google.com/spreadsheets/d/1sZ9U52iuws6ijWPQTmQkXvaZSV3dZ3W9JzhnhNTX9GU/copy

---

## Configuration Variables

### API Quota Management
- **`maxVideos`**: Maximum number of videos that can be added (default: 200)

### Error Tracking
- **`errorflag`**: Boolean flag indicating if an error occurred in current playlist processing
- **`plErrorCount`**: Counter for errors in current playlist
- **`totalErrorCount`**: Counter for total errors across all playlists

### Debug Flags
- **`debugFlag_dontUpdateTimestamp`**: If true, prevents timestamp updates (for testing)
- **`debugFlag_dontUpdatePlaylists`**: If true, prevents playlist updates (for testing)
- **`debugFlag_logWhenNoNewVideosFound`**: If true, logs when channels have no new videos

### Sheet Structure Constants (Zero-Based Indices)

#### Row and Column Configuration
- **`reservedTableRows`**: Starting row for playlist data (row 3, index: 3)
- **`reservedTableColumns`**: Starting column for channel IDs (column F, index: 5)
- **`reservedColumnPlaylist`**: Column for playlist ID (column A, index: 0)
- **`reservedColumnTimestamp`**: Column for last check timestamp (column B, index: 1)
- **`reservedColumnFrequency`**: Column for check frequency in hours (column C, index: 2)
- **`reservedColumnDeleteDays`**: Column for video deletion age in days (column D, index: 3)

#### Debug Sheet Configuration
- **`reservedDebugNumRows`**: Number of rows per debug column (900)
- **`reservedDebugNumColumns`**: Total debug columns available (26)

---

## Date Extension

### `Date.prototype.toIsoString()`
Extends JavaScript's Date object to format dates with timezone information in ISO 8601 format required by YouTube API.

**Format**: `YYYY-MM-DDTHH:MM:SS+HH:MM`

**Example**: `2024-01-15T14:30:00+05:30`

---

## Core Functions

### 1. `updatePlaylists(sheet)`
**Main orchestration function** that processes all playlists in the spreadsheet.

**Process Flow**:
1. Retrieves or initializes sheet ID from script properties
2. Validates the spreadsheet structure
3. Sets up debug logging infrastructure
4. Iterates through each row (playlist) in the sheet:
   - Skips empty rows
   - Initializes timestamp if missing (last 24 hours)
   - Checks if update frequency threshold is met
   - Collects channel IDs and playlist IDs from columns
   - Fetches new videos from channels and playlists
   - Adds videos to target playlist
   - Deletes old videos based on retention policy
   - Updates timestamp on success
   - Logs all operations to debug sheet
5. Finalizes debug logs and reports errors

**Parameters**:
- `sheet`: Optional - The spreadsheet sheet to process (defaults to first sheet)

**Error Handling**: Throws error if total error count > 0

---

## Channel ID Collection Functions

### 2. `getAllChannelIds()`
Retrieves channel IDs from the user's YouTube subscriptions when "ALL" keyword is used.

**Features**:
- Handles pagination with predefined page tokens (supports up to 1000 subscriptions)
- Fetches 50 subscriptions per API call
- Orders results alphabetically

**Returns**: Array of channel IDs

**API Used**: `YouTube.Subscriptions.list()`

**Quota Cost**: 1 unit per 50 subscriptions

---

## Video Retrieval Functions

### 3. `getVideoIds(channelId, lastTimestamp)`
Fetches new video IDs from a channel using YouTube Search API (higher quota cost).

**Parameters**:
- `channelId`: The YouTube channel ID
- `lastTimestamp`: ISO timestamp to fetch videos published after

**Features**:
- Fetches up to 50 videos per page
- Orders results by date (newest first)
- Validates channel existence if no videos found
- Handles pagination

**Returns**: Array of video IDs

**API Used**: `YouTube.Search.list()`, `YouTube.Channels.list()`

**Quota Cost**: 100 units per page + 1 unit for validation

---

### 4. `getVideoIdsWithLessQueries(channelId, lastTimestamp)`
**Preferred method** - Fetches videos from a channel's uploads playlist (lower quota cost).

**Parameters**:
- `channelId`: The YouTube channel ID
- `lastTimestamp`: ISO timestamp to filter videos

**Process**:
1. Gets channel's uploads playlist ID
2. Fetches playlist items
3. Filters videos by publish date
4. Stops pagination when encountering older videos

**Features**:
- More efficient quota usage
- Handles channels with no uploads (404 error)
- Returns videos in ascending date order (reversed)

**Returns**: Array of video IDs

**API Used**: `YouTube.Channels.list()`, `YouTube.PlaylistItems.list()`

**Quota Cost**: 1 unit for channel + 1 unit per page of playlist items

---

### 5. `getPlaylistVideoIds(playlistId, lastTimestamp)`
Fetches video IDs from a specified playlist.

**Parameters**:
- `playlistId`: The YouTube playlist ID
- `lastTimestamp`: ISO timestamp to filter videos

**Features**:
- Fetches up to 50 videos per page
- Filters by publish date
- Validates playlist existence
- Handles pagination

**Returns**: Array of video IDs

**API Used**: `YouTube.PlaylistItems.list()`, `YouTube.Playlists.list()`

**Quota Cost**: 1 unit per page + 1 unit for validation

---

## Playlist Management Functions

### 6. `addVideosToPlaylist(playlistId, videoIds, idx, successCount, errorCount)`
Recursively adds videos to a playlist with error handling.

**Parameters**:
- `playlistId`: Target playlist ID
- `videoIds`: Array of video IDs to add
- `idx`: Current index (default: 0)
- `successCount`: Success counter (default: 0)
- `errorCount`: Error counter (default: 0)

**Features**:
- Recursive implementation for sequential adding
- Special error handling for:
  - Private videos (404) - skips without counting error
  - Watch Later/Watch History playlists (deprecated)
  - Duplicate videos (409) - skips without counting error
- Respects `maxVideos` limit
- Logs success and error counts

**API Used**: `YouTube.PlaylistItems.insert()`, `YouTube.Videos.list()`

**Quota Cost**: 50 units per video + 1 unit for validation if needed

---

### 7. `deletePlaylistItems(playlistId, deleteBeforeTimestamp)`
Removes old videos from a playlist based on publish date.

**Parameters**:
- `playlistId`: Playlist to clean up
- `deleteBeforeTimestamp`: ISO timestamp - videos older than this are deleted

**Features**:
- Fetches videos published before timestamp
- Double-checks video publish date vs. playlist addition date
- Removes duplicate videos based on video ID
- Handles pagination

**Process**:
1. Fetches playlist items with `publishedBefore` filter
2. Verifies `videoPublishedAt` for each item
3. Deletes qualifying items
4. Identifies and removes duplicates

**API Used**: `YouTube.PlaylistItems.list()`, `YouTube.PlaylistItems.remove()`

**Quota Cost**: 1 unit per page + 50 units per deletion

---

## Debug Logging Functions

### 8. `getNextDebugCol(debugSheet)`
Determines the next available column for debug logs in the DebugData sheet.

**Logic**:
- Returns column 0 if sheet has < 900 rows
- Iterates through column pairs (0, 2, 4, ... 24)
- Finds first unfilled column
- Clears and returns column 0 if all columns full

**Returns**: Column index (0-24, even numbers only)

---

### 9. `getNextDebugRow(debugSheet, nextDebugCol)`
Determines the next available row in the current debug column.

**Parameters**:
- `debugSheet`: The DebugData sheet
- `nextDebugCol`: The column to check

**Logic**:
- Returns 0 for empty sheet
- Returns data length for single unfilled column
- Finds first empty row in the specified column

**Returns**: Row index (0-899)

---

### 10. `clearDebugCol(debugSheet, colIndex)`
Clears a debug column for reuse.

**Parameters**:
- `debugSheet`: The DebugData sheet
- `colIndex`: Column to clear

**Process**:
1. Clears first 900 rows
2. Continues clearing until finding empty cells
3. Clears both timestamp and log columns

---

### 11. `initDebugEntry(debugViewer, nextDebugCol, nextDebugRow)`
Initializes a new execution entry in the Debug viewer sheet.

**Parameters**:
- `debugViewer`: The Debug sheet (user-facing)
- `nextDebugCol`: Column for new logs in DebugData
- `nextDebugRow`: Row for new logs in DebugData

**Process**:
1. Clears current viewing cell
2. Shifts existing execution entries down
3. Removes oldest entries if exceeding limit (from B1)
4. Creates formula linking to new execution logs

---

### 12. `loadLastDebugLog(debugViewer)`
Sets the Debug sheet to display the most recent execution logs.

**Parameters**:
- `debugViewer`: The Debug sheet

**Action**: Copies formula from A3 to B3 to display latest logs

---

### 13. `getLogs(timestamp)`
Retrieves execution logs by timestamp from the DebugData sheet.

**Parameters**:
- `timestamp`: ISO timestamp of the execution

**Returns**: 
- Array of log messages if found
- Empty string if not found or timestamp empty
- Error if DebugData sheet doesn't exist

**Logic**:
- Searches all columns for matching timestamp
- Returns all logs from that execution (until empty row)

---

## Utility Functions

### 14. `addError(s)`
Logs an error message and updates error counters.

**Parameters**:
- `s`: Error message string

**Side Effects**:
- Logs to Logger
- Sets `errorflag = true`
- Increments `plErrorCount`

---

### 15. `onOpen()`
Initialization function triggered when spreadsheet opens.

**Actions**:
1. Adds custom menu: "Youtube Controls" → "Update Playlists"
2. Validates spreadsheet structure (checks for "Playlist ID" in A3)
3. Stores spreadsheet ID in script properties

**Error Handling**: Throws error if invalid sheet structure

---

## Web App Functions

### 16. `doGet(e)`
Handles HTTP GET requests when script is deployed as a web app.

**Parameters**:
- `e`: Event object with URL parameters

**Functionality**:
- If `e.parameter.update == "True"`: Triggers `updatePlaylists()`
- Creates HTML template from `index.html`
- Passes playlist data and sheet ID to template
- Returns evaluated HTML output

**Returns**: HtmlOutput object

---

### 17. `playlist(pl, sheetID)`
Retrieves a playlist ID by row number from the spreadsheet.

**Parameters**:
- `pl`: Playlist row number (1-based, user perspective)
- `sheetID`: Spreadsheet ID

**Logic**:
- Converts user row number to zero-based index
- Defaults to first data row if undefined
- Caps at last row if out of bounds
- Returns playlist ID from column A

**Returns**: String - Playlist ID

---

## Data Flow Example

### Example Workflow for One Playlist Row:

1. **Row Detection**: Script reads row 4 (playlist row 1)
   - Playlist ID: `PLxxxxxx` (column A)
   - Last timestamp: `2024-01-15T12:00:00Z` (column B)
   - Frequency: `24` hours (column C)
   - Delete days: `7` days (column D)
   - Channel IDs: `UC123`, `UC456`, `ALL` (columns F+)

2. **Frequency Check**: 
   - Current time - last timestamp > 24 hours? → Proceed

3. **Channel Collection**:
   - `UC123` → Direct channel ID
   - `UC456` → Direct channel ID
   - `ALL` → Calls `getAllChannelIds()` → Returns subscribed channels

4. **Video Fetching**:
   - For each channel: `getVideoIdsWithLessQueries(channelId, timestamp)`
   - Returns new videos published after timestamp

5. **Playlist Update**:
   - `addVideosToPlaylist(playlistId, videoIds)`
   - Adds each video, handles errors

6. **Cleanup**:
   - `deletePlaylistItems(playlistId, deleteBeforeTimestamp)`
   - Removes videos older than 7 days

7. **Finalization**:
   - Updates timestamp to current time
   - Logs all operations to DebugData sheet

---

## Error Handling Strategy

### Error Types:
1. **YouTube API Errors**:
   - 404: Private videos, non-existent channels/playlists
   - 409: Duplicate videos
   - 400: Unsupported playlist operations (Watch Later)
   - Quota exceeded: Detected in logs

2. **Data Validation Errors**:
   - Invalid sheet structure
   - Missing required data
   - Invalid channel/playlist IDs

3. **Debug Errors**:
   - Stored in DebugData sheet
   - Displayed in Debug viewer sheet
   - Prevents timestamp update on failure

### Error Recovery:
- Individual video failures don't stop playlist processing
- Playlist errors don't stop other playlists
- Total error count tracked and reported at end
- Detailed error messages logged with context

---

## API Quota Considerations

### Quota Costs (per operation):
- **Search.list**: 100 units
- **PlaylistItems.list**: 1 unit  
- **PlaylistItems.insert**: 50 units
- **PlaylistItems.remove**: 50 units
- **Channels.list**: 1 unit
- **Playlists.list**: 1 unit
- **Videos.list**: 1 unit
- **Subscriptions.list**: 1 unit

### Optimization Strategy:
- Uses `getVideoIdsWithLessQueries()` by default (1-2 units vs 100 units)
- Batches operations where possible
- Validates channels/playlists only when no results found
- Frequency setting prevents excessive API calls

### Daily Quota:
- YouTube Data API v3: 10,000 units/day by default
- Script designed to respect quota limits
- `maxVideos` setting prevents runaway API usage

---

## Sheet Structure Requirements

### Main Sheet (First Sheet):
```
Row 1: [Header/Instructions]
Row 2: [Header/Instructions]
Row 3: Headers - A3="Playlist ID", B3="Last Updated", C3="Frequency", D3="Delete After", E3+="Channels"
Row 4+: Data rows with playlist configurations
```

### DebugData Sheet (Hidden):
- Auto-created if missing
- Stores execution logs in column pairs
- 900 rows per column pair
- 26 columns total (13 executions before cycling)

### Debug Sheet (Visible):
- User-facing log viewer
- Cell A3: Latest execution timestamp (formula)
- Cell B3: Currently viewed execution (formula)
- Cell B1: Max executions to keep
- Rows 4+: Historical execution timestamps

---

## Special Keywords and Patterns

### Channel Identifiers:
- **`ALL`**: Fetches all subscribed channels
- **`UC...`** (>10 chars): Direct channel ID
- **`PL...`** (>10 chars): Playlist ID (not channel)
- **Other**: Treated as username, resolved via API

### Timestamp Format:
- ISO 8601 with timezone: `YYYY-MM-DDTHH:MM:SS±HH:MM`
- Generated by custom `Date.prototype.toIsoString()`

### Debug Flags:
Can be set at top of script for testing:
- `debugFlag_dontUpdateTimestamp = true`: Test without affecting timestamps
- `debugFlag_dontUpdatePlaylists = true`: Test without modifying playlists
- `debugFlag_logWhenNoNewVideosFound = true`: Verbose logging

---

## Integration Points

### Google Sheets Integration:
- `SpreadsheetApp`: Accesses and modifies spreadsheet data
- Custom menu creation via `onOpen()`
- Range manipulation for reading/writing data

### YouTube API Integration:
- `YouTube.Subscriptions`: Fetches user subscriptions
- `YouTube.Search`: Searches for videos (high quota)
- `YouTube.Channels`: Validates and retrieves channel info
- `YouTube.PlaylistItems`: Manages playlist contents
- `YouTube.Playlists`: Validates playlists
- `YouTube.Videos`: Validates video existence

### Script Properties:
- `PropertiesService.getScriptProperties()`: Persistent storage
- Stores `sheetID` for cross-invocation access

### HTML Service:
- `HtmlService.createTemplateFromFile()`: Web app interface
- Template evaluation with data binding

### Logger:
- `Logger.log()`: Logs operations
- `Logger.clear()`: Resets logs per row
- `Logger.getLog()`: Retrieves logs for debug sheet

---

## Performance Characteristics

### Time Complexity:
- O(R × C × V) where:
  - R = number of playlist rows
  - C = number of channels per row
  - V = average new videos per channel

### API Call Patterns:
- Per Channel: 1-2 calls (channel lookup + playlist items)
- Per Video: 1 call (playlist insert)
- Subscriptions ("ALL"): 1 call per 50 subscriptions

### Execution Limits:
- Google Apps Script: 6 minutes max execution time
- Recommendation: Use time-based triggers for regular updates
- Large configurations may need optimization

---

## Best Practices & Recommendations

1. **Frequency Setting**: 
   - Set based on channel upload frequency
   - Higher frequency = more API quota usage
   - Recommended: 12-24 hours for most use cases

2. **Channel Management**:
   - Use channel IDs instead of usernames (fewer API calls)
   - Group similar upload schedules together
   - Use "ALL" sparingly (high API quota)

3. **Deletion Policy**:
   - Set realistic retention periods
   - Consider playlist purpose (archive vs. recent)
   - Deletion uses significant quota (50 units each)

4. **Debug Management**:
   - Regularly review Debug sheet for errors
   - Adjust B1 value based on troubleshooting needs
   - Archive old DebugData periodically

5. **Error Handling**:
   - Check Debug logs after failures
   - Common issues: quota exceeded, private videos, invalid IDs
   - Don't panic on occasional 404/409 errors (usually benign)

6. **Testing**:
   - Use debug flags to test without side effects
   - Start with few channels before scaling up
   - Monitor quota usage in Google Cloud Console
