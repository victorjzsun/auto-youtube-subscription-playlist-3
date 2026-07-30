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

## Pre-Implementation Investigation

**These items need clarification from an engineer before execution:**

### 1. Sheet Structure Modifications
**Question:** Should we preserve the current 0-indexed column layout (Cols A-F reserved + G+ for sources) when building the web UI?

**Context:**
- Current sheet layout: `[Playlist ID, Timestamp, Freq Hours, Delete Days, Shorts Filter, UNUSED, Channel1, Channel2, ...]`
- `SheetConfigService.parseVideoSourcesFromRow()` reads sources from column index 6 onward
- The MVP design doesn't show how to add multiple sources in the UI

**Investigation Tasks:**
- [ ] Determine if the UI should support unlimited sources (current sheet does)
- [ ] Decide: should modal support dynamic source field addition like the mockup suggests?
- [ ] Clarify: should we add a "name" column for playlists, or keep using auto-generated `config-{rowIndex}` IDs?

**Blocking:** Phase 2+ playlist editing (task #4)

---

### 2. Google Apps Script Deployment Model
**Question:** How will the new web app be deployed vs. the existing Menu?

**Context:**
- Current ui.ts has two entry points: `openDialogMUI()` and `openAboutSidebar()`
- Phase1 MVP shows a full-page web app interface
- Apps Script can deploy as: modal dialog, sidebar, or full-width web app

**Investigation Tasks:**
- [ ] Confirm target deployment: modal dialog, sidebar, or `doGet()` web app?
- [ ] If web app (doGet): What URL pattern? (e.g., `?view=playlists`, `?view=logs`)
- [ ] Should the menu system change? (replace current MUI demo or add new playlist manager menu item?)

**Blocking:** Tasks #1, #2, #8

---

### 3. Playlist Name/Identifier Strategy
**Question:** How should playlists be identified and named in the UI?

**Context:**
- Current code uses auto-generated IDs: `config-${iRow}`
- SheetConfigService stores ID-to-row mapping in memory only (lost on page reload)
- UI needs stable identifiers for edit/delete operations
- MVP design shows "Playlist Name" in card titles

**Investigation Tasks:**
- [ ] Should we add a "Playlist Name" column to the sheet for user-friendly display?
- [ ] Or use the YouTube playlist ID/name fetched from the API?
- [ ] How to persist config IDs across sheet changes (row insert/delete)?

**Blocking:** Tasks #3, #4, #5

---

### 4. Error Handling & Validation Strategy
**Question:** What validation should happen on the client vs. server?

**Context:**
- Server has YouTube API error handling (404 private videos, 409 duplicates)
- Current UI has minimal validation
- Phase1 MVP doesn't show error states/messages

**Investigation Tasks:**
- [ ] Which form fields are required? (Playlist ID, at least one source?)
- [ ] Should client validate playlist ID format (PL...)?
- [ ] Should client validate channel ID/username before saving?
- [ ] What error messages to show for API failures? (return from server)

**Blocking:** Tasks #3, #4, #5

---

### 5. Pagination & Large Playlist Lists
**Question:** How should the UI handle playlists if user has 20+, 50+, 100+ playlists?

**Context:**
- `SheetConfigService.getAllPlaylistConfigurations()` loads all rows
- Phase1 MVP shows simple card grid with no pagination
- Current sheet has 900 debug rows (potential large data)

**Investigation Tasks:**
- [ ] Load all playlists on startup, or paginate after N?
- [ ] If pagination: what page size?
- [ ] Should search/filter be added in future phases?

**Blocking:** Task #2 (minor)

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
    - Playlist Name (optional, for UI display)
    - Update Frequency (hours, optional)
    - Auto-delete (days, optional)
    - Exclude Shorts filter (toggle)
  - Submit/Cancel buttons
  - Validation (playlist ID format, at least one source)
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
- Validation: Playlist ID must start with "PL" or be a valid YouTube URL
- When editing, populate form with existing values

**⚠️ INVESTIGATE BEFORE STARTING:**
- Should playlist name be editable? (Currently not in sheet schema)
- Required validation: must have at least one source before saving?

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
- `src/client/utils/serverFunctions.ts` (MODIFY)
  - Add signature: `createPlaylist(config): Promise<string>`
- `src/client/playlist-manager/components/PlaylistEditor.tsx` (MODIFY)
  - Call `createPlaylist` on form submit
  - Handle success/error responses
  - Close modal and refresh playlist list on success

**Acceptance Criteria:**
- ✅ New row written to sheet with all config fields
- ✅ Sources written to columns G+
- ✅ Timestamp initialized to 24 hours ago (standard behavior)
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
- Handle edge case: if sources array empty, reject with error

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
- `src/client/utils/serverFunctions.ts` (MODIFY)
  - Add signature: `updatePlaylist(id, config): Promise<void>`
- `src/client/playlist-manager/components/PlaylistManager.tsx` (MODIFY)
  - Pass `onEdit` callback to PlaylistCard
  - Open modal with existing config data populated
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
- IMPORTANT: Do NOT update lastTimestamp during config edit (only on successful video add)
- Re-validate sources: at least one required

**⚠️ INVESTIGATE BEFORE STARTING:**
- Should editing playlist ID be allowed? (Changes what videos added to)
- Should we allow timestamp editing? (For manual backfill scenarios)

---

## Task 3.4: Implement Delete Playlist Server Function
**Objective:** Remove playlist row from sheet  
**Files to Create/Modify:**
- `src/server/sheetScript.ts` (NEW/MODIFY)
  - Add `deletePlaylist(id: string): void` function
  - Resolves ID to row, deletes row from sheet
  - Handles edge case: don't delete header rows (indices < 3)
- `src/server/index.ts` (MODIFY) - Export `deletePlaylist`
- `src/client/utils/serverFunctions.ts` (MODIFY)
  - Add signature: `deletePlaylist(id): Promise<void>`
- `src/client/playlist-manager/components/PlaylistCard.tsx` (MODIFY)
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

## Task 4.1: Create SourceManager Component
**Objective:** Allow adding/removing video sources from playlist  
**Files to Create/Modify:**
- `src/client/playlist-manager/components/SourceManager.tsx` (NEW)
  - List existing sources as removable items/chips
  - Input section for adding new sources
  - Source type selector (channel ID, username, subscription, playlist)
  - Validation: prevent duplicate sources
  - UI matches mockup source management section
- `src/client/playlist-manager/components/PlaylistEditor.tsx` (MODIFY)
  - Include SourceManager component
  - Pass sources array to SourceManager
  - Receive updated sources from SourceManager in onSave

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
- Source types: channel ID (UC...), username, playlist ID (PL...), "ALL" (subscriptions)
- Prevent duplicate sources (same type + identifier)
- Show helpful placeholder text for each source type

**⚠️ INVESTIGATE BEFORE STARTING:**
- Should there be a maximum number of sources per playlist?
- Should we validate channel IDs/usernames against YouTube API?
- Should we show a source type selector, or auto-detect from input?

---

## Task 4.2: Server-Side Source Parsing & Validation
**Objective:** Validate and normalize video sources  
**Files to Create/Modify:**
- `src/server/services/SheetConfigService.ts` (MODIFY)
  - Extract `parseVideoSourcesFromRow()` logic to new `normalizeVideoSource()` function
  - Add validation for each source type (format checks)
- `src/server/sheetScript.ts` (MODIFY)
  - In `createPlaylist`/`updatePlaylist`, call validation function
  - Return client-side error if sources invalid

**Acceptance Criteria:**
- ✅ Source format validation (PL... for playlists, UC... for channels)
- ✅ Username validation (non-empty string)
- ✅ "ALL" keyword recognized
- ✅ Error messages clear for invalid sources
- ✅ Normalization applied (trailing spaces removed)

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- Reuse existing parsing logic from SheetConfigService
- Don't require YouTube API validation (too slow for form submission)

---

# PHASE 5: FILTER & SETTINGS

## Task 5.1: Create FilterConfiguration Component
**Objective:** Allow user to set video filtering options  
**Files to Create/Modify:**
- `src/client/playlist-manager/components/FilterConfiguration.tsx` (NEW)
  - Toggle for "Exclude Shorts" filter
  - Display description of each filter
  - Show preview of how filter affects videos (optional, Phase 2)
- `src/client/playlist-manager/components/PlaylistEditor.tsx` (MODIFY)
  - Include FilterConfiguration component
  - Pass filters to/from component

**Acceptance Criteria:**
- ✅ Exclude Shorts toggle visible
- ✅ Toggle state reflects current config
- ✅ Filter description clear and helpful
- ✅ Integrates with save flow

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- Currently only "excludeShorts" filter exists
- Future filters: duration (videos > 1 min), premiere (exclude live), etc.

---

## Task 5.2: Implement Update Now / Manual Trigger
**Objective:** Allow user to manually trigger playlist update from UI  
**Files to Create/Modify:**
- `src/client/playlist-manager/components/PlaylistCard.tsx` (MODIFY)
  - Add "Update Now" button
  - Show updating spinner during operation
  - Display success/error message
- `src/server/sheetScript.ts` (MODIFY)
  - Add `updatePlaylistNow(playlistId: string): {success: bool, message: string}` function
  - Calls existing `updatePlaylists()` logic but for single playlist
  - Resets frequency check (ignores time interval)

**Acceptance Criteria:**
- ✅ Button triggers update for single playlist
- ✅ Loading spinner shows during update
- ✅ Success message shows videos added count
- ✅ Error message displays on failure
- ✅ Button disabled while updating

**Build & Lint:**
```bash
npm run build
npm run lint
```

**Notes:**
- Reuse PlaylistUpdateService for consistency
- Don't update timestamp if user wants dry-run? (investigate)

---

## Task 5.3: Add Refresh & Action Buttons to PlaylistManager
**Objective:** Top-level actions for all playlists  
**Files to Create/Modify:**
- `src/client/playlist-manager/components/PlaylistManager.tsx` (MODIFY)
  - Add "Refresh List" button (reload all playlists from sheet)
  - Add "Update All Playlists" button (trigger full update)
  - Show operation progress/loading state
- `src/server/sheetScript.ts` (MODIFY, if needed)
  - Ensure `updatePlaylists()` callable with same async pattern

**Acceptance Criteria:**
- ✅ Refresh List reloads playlists from sheet
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
- Consider: should "Update All" show progress for each playlist?

---

# Integration & Testing Phase

## Task 6.1: Comprehensive Testing Checklist
**Objective:** Verify all features work end-to-end  

**Test Scenarios:**

### Playlist List View
- [ ] Load playlist manager, verify playlists display
- [ ] Empty state shows when no playlists exist
- [ ] Card displays all config fields correctly
- [ ] Status indicators show correct colors
- [ ] Responsive layout works on mobile/tablet

### Create Playlist
- [ ] Open "Add Playlist" modal
- [ ] Form fields visible and functional
- [ ] Validation shows error for invalid playlist ID
- [ ] Submit creates new row in sheet
- [ ] Playlist appears in list after create
- [ ] Can add sources and filters before saving

### Edit Playlist
- [ ] Click edit button on playlist card
- [ ] Modal opens with existing data populated
- [ ] Modify fields and save
- [ ] Sheet row updated with new values
- [ ] List refreshes with updated data

### Delete Playlist
- [ ] Click delete button
- [ ] Confirmation dialog shows
- [ ] Cancel prevents deletion
- [ ] Confirm removes playlist from sheet and list

### Update Now
- [ ] Click "Update Now" on card
- [ ] Spinner shows during operation
- [ ] Success message displays (or error)
- [ ] Timestamp updates in sheet
- [ ] YouTube playlists updated with new videos

### Menu Integration
- [ ] Google Sheets menu shows "Manage Playlists" item
- [ ] Clicking opens web app correctly
- [ ] Manual "Update Playlists" still works
- [ ] Manual "Get Channel ID" still works

### Error Handling
- [ ] Invalid playlist ID shows validation error
- [ ] Network errors show error message
- [ ] Sheet access errors handled gracefully
- [ ] YouTube API errors logged and user notified

---

## Task 6.2: Build & Lint Final Verification
**Objective:** Ensure clean build with zero errors/warnings

```bash
npm run build
npm run lint
```

**Acceptance Criteria:**
- ✅ Zero TypeScript errors
- ✅ Zero ESLint errors
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
- **Create:** `src/client/playlist-manager/components/SourceManager.tsx`
- **Modify:** `src/server/services/SheetConfigService.ts` - Add validation

## Phase 5 Files
- **Create:** `src/client/playlist-manager/components/FilterConfiguration.tsx`
- **Modify:** `src/client/playlist-manager/components/PlaylistCard.tsx`

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
Task 4.1 (SourceManager) → Task 4.2 (Validation)
  ↓
Task 5.1 (Filters) → Task 5.2 (Update Now) → Task 5.3 (Refresh/Actions)
  ↓
Task 6.1 (Testing) → Task 6.2 (Build) → Task 6.3 (Docs)
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

### Config ID Stability
- Current ID scheme: `config-${rowIndex}` (loses stability on row insert/delete)
- MUST investigate better approach (task investigation item #3)
- Blocks all CRUD operations if not resolved

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

# Post-Implementation Roadmap (Future Phases)

### Phase 6: Advanced Features
- [ ] Playlist search/filter in UI
- [ ] Batch operations (update multiple playlists)
- [ ] Video filters UI preview
- [ ] Logs viewer (error tracking)
- [ ] Settings panel (quota limits, debug flags)

### Phase 7: Performance & Polish
- [ ] Pagination for large playlist lists
- [ ] Async/background updates with status polling
- [ ] Caching for video counts
- [ ] Dark mode support
- [ ] Keyboard navigation/accessibility

### Phase 8: Additional Features (from GitHub issues)
- [ ] Duplicate video detection/removal
- [ ] Video recommendations
- [ ] Playlist templates
- [ ] Advanced filtering (duration, premiere status, etc.)

---

**Document Version:** 1.0  
**Last Updated:** April 2026  
**Status:** Ready for Engineering Review
