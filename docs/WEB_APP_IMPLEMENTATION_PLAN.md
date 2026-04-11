# Web App Refactor Implementation Plan

**Project:** Auto YouTube Subscription Playlist - Web App UI Refactor  
**Target Design:** See [phase1-mvp.html](./mockups/phase1-mvp.html)  
**Status:** Planning Phase  
**Date Created:** April 2026

---

## Overview

This document outlines the step-by-step implementation plan to refactor the current Material UI demo app into a full-featured playlist management web app. The refactor maintains the existing backend business logic (YouTube video fetching, playlist operations) while building a new frontend that matches the phase1-mvp.html design.

**Current State:** Simple sheet manager (create/delete sheets, view list)  
**Target State:** Full playlist manager (view/create/edit/delete playlists, configure sources and filters)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    GOOGLE SHEETS (Data)                      │
├─────────────────────────────────────────────────────────────┤
│  Row 1-2: Headers                                            │
│  Row 3+:  Playlist Config (ID, Timestamp, Freq, Delete, ... │
│  Cols A-F: Core config | Cols G+: Video sources             │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ Read/Write
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              GOOGLE APPS SCRIPT (Server)                     │
├─────────────────────────────────────────────────────────────┤
│  SheetConfigService:  Read/write playlist configs from Sheet │
│  PlaylistUpdateService: Add/delete videos in playlists       │
│  VideoFetchService*:  Fetch videos from sources              │
│  VideoFilterService:  Filter videos by criteria              │
│  DebugLogService:     Logging and debugging                  │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ google.script.run / doGet()
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 REACT WEB APP (Client)                       │
├─────────────────────────────────────────────────────────────┤
│  PlaylistManager:     Main container                         │
│  PlaylistList:        Show playlists as cards                 │
│  PlaylistCard:        Individual playlist display             │
│  PlaylistEditor:      Create/edit playlist modal              │
│  SourceManagement:    Add/remove video sources                │
│  FilterConfiguration: Set video filters                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Playlist Name Storage Implementation

### Design Overview
Playlist names are stored inline with the Playlist ID in the sheet using a composite format: `playlistId@playlistName`

**Example:**
```
PLxxxxxxxxxxxxx@My Favorite Videos
PLyyyyyyyyyyyyyyy@Tech Channel
PLzzzzzzzzzzzzzz
```

### Format Specification
- **Delimiter:** `@` symbol (single occurrence expected)
- **Structure:** `playlistId@name`
- **Backward Compatibility:** If `@` is absent, the name is default to "Playlist"
- **Storage Location:** Column A (Playlist ID column), same as the playlist ID
- **No Sheet Schema Changes:** Existing sheet structure remains unchanged; name is embedded in the existing column

### SheetConfigService Implementation Details

#### Reading Playlist Names
In `getAllPlaylistConfigurations()`:

1. Extract raw value from column A: `data[iRow][reservedColumnPlaylist]`
2. Check if value contains `@` symbol
3. If `@` exists:
   - Split by `@` to separate playlist ID and name
   - **Important:** Use only the first `@` as delimiter (if name contains `@`, it's preserved in the name part)
   - Extract playlist ID (everything before `@`)
   - Extract name (everything after first `@`)
4. If `@` does not exist:
   - Treat entire value as playlist ID
   - Name defaults to "Playlist"

#### Code Pattern
```typescript
const rawPlaylistData: string = data[iRow][reservedColumnPlaylist];
let playlistId: string = rawPlaylistData;
let playlistName: string = '';

const atIndex = rawPlaylistData.indexOf('@');
if (atIndex > -1) {
  playlistId = rawPlaylistData.substring(0, atIndex);
  playlistName = rawPlaylistData.substring(atIndex + 1);
}

const config: PlaylistConfiguration = {
  id,
  name: playlistName || 'Playlist',  // Use provided name or fall back to literal
  playlistId,  // Store the YouTube playlist ID separately
  // ... rest of config
};
```

#### Updating Playlist Names (Web App Integration)
When the web app saves a playlist name:

1. Format the value as `playlistId@name`
2. Write to the appropriate row in column A via `sheet.getRange(rowIndex + 1, reservedColumnPlaylist + 1).setValue(newValue)`
3. No timestamp or other operations are affected

**Important:** This operation is non-destructive. A playlist without a name (`playlistId` only) is valid and continues to work normally.

#### Example Scenarios

| Sheet Cell (Column A)     | Parsed playlistId     | Parsed name         | Behavior                       |
|---------------------------|-----------------------|---------------------|--------------------------------|
| `PLxxxxxxxxxxxxx`         | `PLxxxxxxxxxxxxx`     | `'Playlist'`        | Works; name shows as in UI      |
| `PLxxxxxxxxxxxxx@Videos`  | `PLxxxxxxxxxxxxx`     | `Videos`            | Works; name shows in UI         |
| `PLxxxxxxxxxxxxx@My@List` | `PLxxxxxxxxxxxxx`     | `My@List`           | Works; only first `@` is split  |
| (empty cell)              | (skipped row)         | N/A                 | Row ignored per existing logic  |

### Integration Points

1. **SheetConfigService.getAllPlaylistConfigurations()** - Parse name from composite value
2. **Web App (PlaylistEditor/PlaylistCard)** - Display and allow editing playlist name
3. **Sheet column A writing** - Format value as `playlistId@name` when saving
4. **Backward Compatibility** - Playlists without names (legacy rows) continue to function

### No Impact on Existing Functionality
- Playlist ID extraction is unchanged (split before `@`)
- Video fetching logic is unaffected
- Update timestamps and other configurations operate normally
- Sheet layout requires no modifications
- Existing playlists without names continue to work

---

## Implementation Phases

### Phase 1: Core React Infrastructure (Foundation)
This phase sets up the basic structure without adding/editing features yet.

---

### Phase 2: Playlist Data Display (View/List)
Display current playlists with their configurations.

---

### Phase 3: Playlist Management Forms (CRUD)
Add ability to create, edit, and delete playlists.

---

### Phase 4: Source Management UI
Advanced playlist source configuration.

---

### Phase 5: Filter & Settings
Video filtering options and advanced features.

---

## Task Breakdown by Phase

---

# PHASE 1: CORE REACT INFRASTRUCTURE

## Task 1.1: Create PlaylistManager React Component Structure
**Objective:** Build the main component wrapper and establish component hierarchy  
**Files to Create/Modify:**
- `src/client/playlist-manager/` (NEW DIRECTORY)
  - `index.html` (NEW) - HTML template
  - `index.jsx` (NEW) - React entry point
  - `styles.css` (NEW) - Base styles matching MVP design
  - `components/PlaylistManager.tsx` (NEW) - Main container component
  - `components/PlaylistList.tsx` (NEW) - Displays playlist cards
  - `components/PlaylistCard.tsx` (NEW) - Single playlist card
  - `components/EmptyState.tsx` (NEW) - Empty playlists message
- `src/client/utils/serverFunctions.ts` (MODIFY) - Add new server function signatures
- `vite.config.ts` (MODIFY) - Add `playlist-manager` to `clientEntrypoints`
- `src/server/index.ts` (MODIFY) - Export `getPlaylists` server function

**Acceptance Criteria:**
- ✅ Component tree renders without errors
- ✅ CSS matches MVP color scheme and layout (header, action bar, card grid)
- ✅ TypeScript types for PlaylistConfiguration properly imported
- ✅ Vite builds new entry point without errors

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- Copy phase1-mvp.html structure (header, action bar, placeholder cards)
- Components are presentational only; data loading in next task

---

## Task 1.2: Create Server-Side Playlist Retrieval Endpoint
**Objective:** Expose playlist data to React frontend via `google.script.run`  
**Files to Create/Modify:**
- `src/server/sheetScript.ts` (MODIFY)
  - Add `getPlaylists()` function that calls `SheetConfigService.getAllPlaylistConfigurations()`
  - Return array of `PlaylistConfiguration` objects with serializable data
- `src/server/index.ts` (MODIFY) - Export `getPlaylists`

**Acceptance Criteria:**
- ✅ `getPlaylists()` returns array of playlist configs from sheet
- ✅ Date objects properly serialized to ISO strings (AppsScript limitation)
- ✅ TypeScript types match exported data shape
- ✅ Function works with empty playlists (returns `[]`)

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- Handle AppsScript serialization: dates → ISO strings, convert back on client
- Error handling: throw error back to client

---

## Task 1.3: Integrate Data Loading in React Components
**Objective:** Load playlist data from server and display in PlaylistManager  
**Files to Create/Modify:**
- `src/client/playlist-manager/components/PlaylistManager.tsx` (MODIFY)
  - Add `useEffect` hook to call `getPlaylists()` on mount
  - Manage loading/error states
  - Pass data to `PlaylistList` component
- `src/client/playlist-manager/components/PlaylistList.tsx` (MODIFY)
  - Accept loading/error/data props
  - Show loading spinner while fetching
  - Show error message if fetch fails
  - Show EmptyState if data is empty
  - Render PlaylistCard for each playlist

**Acceptance Criteria:**
- ✅ Loading spinner shows while fetching
- ✅ Playlists display once loaded
- ✅ Empty state shows when no playlists exist
- ✅ Error message displays on server error
- ✅ Data refreshes if component remounts

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- Use Material UI components (Skeleton for loading, Alert for errors)
- Handle Date deserialization (ISO string → Date object)

---

## Task 1.4: Update Google Apps Script Menu System
**Objective:** Add new "Playlist Manager" menu item pointing to web app  
**Files to Create/Modify:**
- `src/server/ui.ts` (MODIFY)
  - Add `openPlaylistManager()` function (similar to `openDialogMUI`)
  - Updates `onOpen()` to include new menu item
- Update menu label to something like "YouTube Controls > Manage Playlists"

**Acceptance Criteria:**
- ✅ New menu item appears in Google Sheets when script is loaded
- ✅ Clicking opens the playlist manager web app
- ✅ Web app displays playlists or empty state
- ✅ Manual "Update Playlists" and "Get Channel ID" menu items still work

**Build & Lint:**
```bash
npm run build
npm run lint
npm run deploy:dev
```

**Notes:**
- Keep existing menu items for backward compatibility
- Test in a test Google Sheet

---

# PHASE 2: PLAYLIST DATA DISPLAY (VIEW/LIST)

## Task 2.1: Build PlaylistCard Component with Real Data
**Objective:** Design and implement individual playlist card showing config details  
**Files to Create/Modify:**
- `src/client/playlist-manager/components/PlaylistCard.tsx` (MODIFY)
  - Display: playlist ID, name, status indicator, video count (if available)
  - Display: last update time, frequency, auto-delete days
  - Display: sources list (channels, subscriptions, playlists)
  - Show action buttons: "Configure", "View on YouTube", "Update Now"
  - Responsive grid layout (match MVP)

**Acceptance Criteria:**
- ✅ All playlist config fields display correctly
- ✅ Responsive layout (grid collapses on mobile)
- ✅ Sources render as tags/chips
- ✅ Colors/styling match phase1-mvp.html
- ✅ Timestamps formatted as human-readable (e.g., "2 hours ago")

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- Use relative time formatting: `dayjs().to(timestamp)` or similar
- Source tags: color-code by type (channel=blue, subscription=green, playlist=purple)
- Action buttons are placeholder; wiring comes in Phase 3

---

## Task 2.2: Implement Status Indicator & Stats Display
**Objective:** Show playlist health
**Files to Create/Modify:**
- `src/client/playlist-manager/components/PlaylistCard.tsx` (MODIFY)
  - Show health metrics: last update time, auto-delete after, next scheduled update

**Acceptance Criteria:**
- ✅ Last update time calculates based on last timestamp
- ✅ Next update time calculates based on frequency config

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- Next update = lastTimestamp + frequencyHours


---

# PHASE 3: PLAYLIST MANAGEMENT FORMS (CRUD)

## Task 3.1: Create Playlist Editor Modal Component
**Objective:** Build form for creating/editing playlist configuration  
**Files to Create/Modify:**
- `src/client/playlist-manager/components/PlaylistEditor.tsx` (NEW)
  - Modal with form fields:
    - Playlist ID (required, YouTube PL... format)
    - Playlist Name (optional, for UI display, defaults to "Playlist" in not provided)
    - Update Frequency (hours, optional)
    - Auto-delete (days, optional)
    - Last execution timestamp (ISO timestamp, optional)
  - Submit/Cancel buttons
  - Validation (playlist ID format)
- `src/client/playlist-manager/components/PlaylistManager.tsx` (MODIFY)
  - Add modal open/close state
  - Show modal when "Add Playlist" button clicked

**Acceptance Criteria:**
- ✅ Modal opens/closes correctly
- ✅ Form fields populate correctly in edit mode
- ✅ Form validation shows errors for invalid inputs
- ✅ Submit button disabled until valid
- ✅ Modal dimensions match MVP design

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- Use Material UI TextField, Checkbox, Button
- Validation: Playlist ID must start with "PL"
- When editing, populate form with existing values

---

## Task 3.2: Implement Create Playlist Server Function
**Objective:** Add new playlist row to sheet with user-provided config  
**Files to Create/Modify:**
- `src/server/sheetScript.ts` (NEW/MODIFY)
  - Add `createPlaylist(config: PlaylistConfiguration): string` function
  - Extracts sources from config
  - Writes new row to sheet with config data
  - Returns config ID on success, throws error on failure
- `src/server/index.ts` (MODIFY) - Export `createPlaylist`
- `src/client/playlist-manager/components/PlaylistEditor.tsx` (MODIFY)
  - Call `createPlaylist` on form submit
  - Handle success/error responses
  - Close modal and refresh playlist list on success

**Acceptance Criteria:**
- ✅ New row written to sheet with all config fields
- ✅ Sources written to columns G+
- ✅ Timestamp initialized to 24 hours ago if not specified
- ✅ Validation errors returned to client with helpful messages
- ✅ Playlist list refreshes after successful create

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- Reuse `SheetConfigService` for consistency
- Validate on server: playlist ID format, YouTube API access
- Null values passed for unused values (filters) to be implemented in future phases

---

## Task 3.3: Implement Update Playlist Server Function
**Objective:** Modify existing playlist configuration  
**Files to Create/Modify:**
- `src/server/sheetScript.ts` (NEW/MODIFY)
  - Add `updatePlaylist(id: string, config: PlaylistConfiguration): void` function
  - Resolves config ID to sheet row
  - Updates all config columns with new values
  - Clears and rewrites source columns
- `src/server/index.ts` (MODIFY) - Export `updatePlaylist`
- `src/client/playlist-manager/components/PlaylistCard.tsx` (MODIFY)
  - Open modal with existing config data populated when Settings button clicked
- `src/client/playlist-manager/components/PlaylistEditor.tsx` (MODIFY)
  - Detect edit vs. create mode (id param)
  - Change submit button text accordingly
  - Pre-populate form in edit mode

**Acceptance Criteria:**
- ✅ Existing row updated, no new rows created
- ✅ All fields updateable (playlist ID, frequency, delete days, filter)
- ✅ Sources correctly rewritten (old sources cleared)
- ✅ Timestamp NOT updated during config edit
- ✅ Client-side validation before submit

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- Editing playlist ID is allowed
- Timestamp editing is allowed (For manual backfill and other scenarios)
- No changes to values that are null, as they will be updated in future phases

---

## Task 3.4: Implement Delete Playlist Server Function
**Objective:** Remove playlist row from sheet  
**Files to Create/Modify:**
- `src/server/sheetScript.ts` (NEW/MODIFY)
  - Add `deletePlaylist(id: string): void` function
  - Resolves config ID to row, deletes row from sheet
  - Handles edge case: don't delete header rows (indices < 3)
- `src/server/index.ts` (MODIFY) - Export `deletePlaylist`
- `src/client/playlist-manager/components/PlaylistEditor.tsx` (MODIFY)
  - Add "Delete" button with confirmation dialog
  - Call `deletePlaylist` on confirm
  - Refresh list on success

**Acceptance Criteria:**
- ✅ Playlist row deleted from sheet
- ✅ Confirmation dialog prevents accidental deletes
- ✅ Playlist list refreshes after delete
- ✅ Error message shown if delete fails
- ✅ Cannot delete header rows

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- Show confirmation dialog with playlist name/ID for clarity
- Handle errors gracefully (e.g., if row already deleted)

---

# PHASE 4: SOURCE MANAGEMENT UI

## Task 4.1: Add functionality for adding/removing sources
**Objective:** Allow adding/removing video sources from playlist  
**Files to Create/Modify:**
- `src/client/playlist-manager/components/PlaylistCard.tsx` (NEW)
  - List existing sources as chips as shown in mockup
- `src/client/playlist-manager/components/PlaylistEditor.tsx` (MODIFY)
  - List existing sources as a list of text input boxes as shown in mockup, with delete button for removing
  - Have "Add source" button for adding new sources
  - Validation: prevent duplicate sources

**Acceptance Criteria:**
- ✅ Existing sources display as removable chips
- ✅ Add source input with type selector
- ✅ Validation: no duplicate sources
- ✅ Remove source button works
- ✅ "ALL" (subscriptions) displayed correctly

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- Source types: channel ID (UC...), username, playlist ID (PL...), "ALL" (subscriptions), auto-detected from input
- Validation of source formatting, but no using of YouTube API to actually verify
- Prevent duplicate sources (same identifier)
- Unlimited number of sources

---

# PHASE 5: OTHER CONFIGURATIONS

## Task 5.1: Add Action Button to PlaylistManager
**Objective:** Top-level actions for all playlists  
**Files to Create/Modify:**
- `src/client/playlist-manager/components/PlaylistManager.tsx` (MODIFY)
  - Add "Update All Playlists" button (trigger full update)
  - Show operation progress/loading state

**Acceptance Criteria:**
- ✅ Update All calls existing updatePlaylists function
- ✅ Progress indication while updating
- ✅ List refreshes after update completes

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- "Update All" uses existing `updatePlaylists()` function already in menu

---

# PHASE 6: TESTING PHASE

## Task 6.1: Build & Lint Final Verification
**Objective:** Ensure clean build with zero errors/warnings

```bash
npm run build
npm run lint
```

**Acceptance Criteria:**
- ✅ Zero TypeScript errors
- ✅ Zero ESLint errors (excluding "any" errors due to API)
- ✅ All assets bundled correctly
- ✅ No console warnings in web app
- ✅ Dist files ready for deployment

---

## Task 6.3: Update Documentation
**Objective:** Document new UI and features  
**Files to Create/Modify:**
- `README.md` (MODIFY)
  - Add section: "Using the Playlist Manager Web App"
  - Document UI features and navigation
- `src/client/playlist-manager/README.md` (NEW)
  - Component architecture overview
  - Data flow description
  - Development guide for future enhancements

**Acceptance Criteria:**
- ✅ New users can understand how to use web app
- ✅ Developer notes for adding new features

---

# Summary: Files to Create/Modify by Phase

## Phase 1 Files
- **Create:** `src/client/playlist-manager/` directory and all components
- **Create:** `src/client/playlist-manager/index.html`
- **Create:** `src/client/playlist-manager/index.jsx`
- **Create:** `src/client/playlist-manager/styles.css`
- **Create:** `src/client/playlist-manager/components/PlaylistManager.tsx`
- **Create:** `src/client/playlist-manager/components/PlaylistList.tsx`
- **Create:** `src/client/playlist-manager/components/PlaylistCard.tsx`
- **Create:** `src/client/playlist-manager/components/EmptyState.tsx`
- **Modify:** `src/server/sheetScript.ts` - Add `getPlaylists()` function
- **Modify:** `src/server/index.ts` - Export new functions
- **Modify:** `src/server/ui.ts` - Add `openPlaylistManager()`
- **Modify:** `src/client/utils/serverFunctions.ts` - Add TypeScript signatures
- **Modify:** `vite.config.ts` - Add entry point for playlist-manager

## Phase 2 Files
- **Modify:** `src/client/playlist-manager/components/PlaylistCard.tsx`
- **Modify:** `src/server/sheetScript.ts` - Extend `getPlaylists()` with stats

## Phase 3 Files
- **Create:** `src/client/playlist-manager/components/PlaylistEditor.tsx`
- **Modify:** `src/server/sheetScript.ts` - Add CRUD functions
- **Modify:** `src/client/utils/serverFunctions.ts` - Add CRUD signatures
- **Modify:** `src/client/playlist-manager/components/PlaylistManager.tsx`

## Phase 4 Files
- **Modify:** `src/client/playlist-manager/components/PlaylistCard.tsx`
- **Modify:** `src/client/playlist-manager/components/PlaylistEditor.tsx`

## Phase 5 Files
- **Modify:** `src/client/playlist-manager/components/PlaylistManager.tsx`

---

# Dependency Graph

```
Task 1.1 (Components)
  ↓
Task 1.2 (Server endpoint) → Task 1.3 (Data loading)
  ↓
Task 1.4 (Menu)
  ↓
Task 2.1 (PlaylistCard) → Task 2.2 (Stats)
  ↓
Task 3.1 (Editor modal) → Task 3.2 (Create) → Task 3.3 (Update) → Task 3.4 (Delete)
  ↓
Task 4.1 (Sources)
  ↓
Task 5.1 (Global Actions)
  ↓
Task 6.1 (Build) → Task 6.2 (Docs)
```

**Critical Path:** Most tasks must complete sequentially because each phase depends on previous infrastructure.

**Parallelizable:** Within Phase 3, Tasks 3.2-3.4 could potentially be worked on in parallel after 3.1 is merged.

---

# Known Gotchas & Considerations

### AppsScript Serialization
- Date objects don't serialize across `google.script.run`
- Solution: Server converts dates to ISO strings, client parses them
- Libraries: use `dayjs()` or `date-fns` for client-side date formatting

### Sheet Row Indexing
- Sheet uses 1-based indexing in UI, but code uses 0-based
- Always convert: `sheetRow = codeRowIndex + 1` when calling `getRange()`
- Potential bug source: off-by-one errors

### YouTube API Quota
- Default quota: 10,000 units/day
- `PlaylistItems.insert()`: 50 units each
- Fetching stats (task 2.2) adds overhead
- Current limit: 200 videos max per execution
- Mitigation: cache video counts in sheet, update only on demand

### AppsScript Runtime
- Execution time limit: 6 minutes for time-triggered, 30 minutes for manual
- Web app responses should be < 5 seconds
- Video fetching is slow; consider "Update Now" async with status polling

---

# Success Metrics

Upon completion of this plan, the following should be true:

1. ✅ React web app displays all playlist configurations from sheet
2. ✅ Users can create new playlists without editing the sheet directly
3. ✅ Users can modify playlist configurations (update frequency, filters, sources)
4. ✅ Users can delete playlists
5. ✅ Users can manually trigger updates
6. ✅ All UI elements match phase1-mvp.html design
7. ✅ No breaking changes to existing server functionality
8. ✅ Zero TypeScript/ESLint errors in production build
9. ✅ Menu system integrates seamlessly with new web app
10. ✅ Error handling is robust and user-friendly

---

**Document Version:** 1.0  
**Last Updated:** April 2026  
**Status:** Ready for Engineering Review
