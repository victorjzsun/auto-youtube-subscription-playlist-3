# Error Tracker Refactoring Plan

## Overview
This document outlines a step-by-step plan to refactor the error handling in `sheetScript.ts` from global variables to a class-based approach using a new `ErrorTracker` class.

## Current State Analysis

### Global Variables (to be replaced)
- `errorflag: boolean` - Indicates if any error occurred for the current playlist
- `plErrorCount: number` - Count of errors for the current playlist
- `totalErrorCount: number` - Cumulative count of errors across all playlists

### Current Error Handling Function
```typescript
function addError(s: string): void {
  Logger.log(s);
  errorflag = true;
  plErrorCount += 1;
}
```

### Error Handling Locations
The current implementation has error handling in approximately 31 locations throughout the file:
- `getAllChannelIds()` - 2 calls
- Channel ID retrieval from usernames - 5 calls
- `getVideoIdsWithLessQueries()` - 4 calls
- `getPlaylistVideoIds()` - 3 calls
- `addVideosToPlaylist()` - 6 calls
- `deletePlaylistItems()` - 2 calls
- Various other locations in `updatePlaylists()` - 9 calls

### Error Flow in `updatePlaylists()`
1. Initialize all error counters to 0 at start
2. For each playlist row:
   - Process channels and videos
   - Check `errorflag` before updating playlists/timestamps
   - Reset `errorflag` to false after processing row
   - Add `plErrorCount` to `totalErrorCount`
   - Reset `plErrorCount` to 0
3. After all playlists processed, check `totalErrorCount` and throw error if > 0

---

## Proposed ErrorTracker Class Design

### Class Structure

```typescript
class ErrorTracker {
  private playlistErrorCount: number;
  private totalErrorCount: number;

  constructor() {
    this.playlistErrorCount = 0;
    this.totalErrorCount = 0;
  }

  /**
   * Add an error for the current playlist
   * @param message - Error message to log
   */
  addError(message: string): void {
    Logger.log(message);
    this.playlistErrorCount += 1;
  }

  /**
   * Check if any errors occurred for the current playlist
   * @returns true if errors occurred, false otherwise
   */
  hasErrors(): boolean {
    return this.playlistErrorCount > 0;
  }

  /**
   * Get the current playlist error count
   * @returns Number of errors for current playlist
   */
  getPlaylistErrorCount(): number {
    return this.playlistErrorCount;
  }

  /**
   * Get the total error count across all playlists
   * @returns Total number of errors
   */
  getTotalErrorCount(): number {
    return this.totalErrorCount;
  }

  /**
   * Reset playlist error tracking and add current count to total
   * Call this when moving to the next playlist
   */
  resetForNextPlaylist(): void {
    this.totalErrorCount += this.playlistErrorCount;
    this.playlistErrorCount = 0;
  }

  /**
   * Reset all error counters
   * Call this at the start of updatePlaylists()
   */
  reset(): void {
    this.playlistErrorCount = 0;
    this.totalErrorCount = 0;
  }
}
```

---

## Step-by-Step Implementation Plan

### Phase 1: Create the ErrorTracker Class

#### Step 1.1: Create new file
- Create `src/server/ErrorTracker.ts`
- Add the `ErrorTracker` class with all methods as defined above
- Include JSDoc comments for all methods

#### Step 1.2: Add exports
- Export the `ErrorTracker` class as default export
- Ensure TypeScript compilation includes this file

### Phase 2: Integrate ErrorTracker into sheetScript.ts

#### Step 2.1: Import the class
- Add import statement at the top of `sheetScript.ts`:
  ```typescript
  import ErrorTracker from './ErrorTracker';
  ```

#### Step 2.2: Remove global variables
- Remove lines 16-18:
  ```typescript
  let errorflag: boolean = false;
  let plErrorCount: number = 0;
  let totalErrorCount: number = 0;
  ```

#### Step 2.3: Create ErrorTracker instance
- Add near the top of the file (after imports):
  ```typescript
  const errorTracker = new ErrorTracker();
  ```

### Phase 3: Update updatePlaylists() Function

#### Step 3.1: Replace initial reset (lines 62-64)
- **Location:** Start of `updatePlaylists()` function
- **Replace:**
  ```typescript
  errorflag = false;
  plErrorCount = 0;
  totalErrorCount = 0;
  ```
- **With:**
  ```typescript
  errorTracker.reset();
  ```

#### Step 3.2: Replace errorflag check (line 222)
- **Location:** Before adding videos to playlist
- **Replace:**
  ```typescript
  if (!errorflag) {
  ```
- **With:**
  ```typescript
  if (!errorTracker.hasErrors()) {
  ```

#### Step 3.3: Replace errorflag check (line 241)
- **Location:** Before updating timestamp
- **Replace:**
  ```typescript
  if (!errorflag && !DEBUG_FLAG_DONT_UPDATE_TIMESTAMP) {
  ```
- **With:**
  ```typescript
  if (!errorTracker.hasErrors() && !DEBUG_FLAG_DONT_UPDATE_TIMESTAMP) {
  ```

#### Step 3.4: Replace end-of-loop reset (lines 258-260)
- **Location:** End of playlist row processing loop
- **Replace:**
  ```typescript
  errorflag = false;
  totalErrorCount += plErrorCount;
  plErrorCount = 0;
  ```
- **With:**
  ```typescript
  errorTracker.resetForNextPlaylist();
  ```

#### Step 3.5: Replace final error check (lines 264-287)
- **Location:** After processing all playlists
- **Replace:**
  ```typescript
  if (totalErrorCount === 0) {
    debugSheet
      .getRange(nextDebugRow + 1, nextDebugCol + 2)
      .setValue('Updated all rows, script successfully finished');
  } else {
    debugSheet
      .getRange(nextDebugRow + 1, nextDebugCol + 2)
      .setValue('Script did not successfully finish');
  }
  // ... later ...
  if (totalErrorCount > 0) {
    throw new Error(
      `${totalErrorCount} video(s) were not added to playlists correctly, please check Debug sheet. Timestamps for respective rows has not been updated.`
    );
  }
  ```
- **With:**
  ```typescript
  if (errorTracker.getTotalErrorCount() === 0) {
    debugSheet
      .getRange(nextDebugRow + 1, nextDebugCol + 2)
      .setValue('Updated all rows, script successfully finished');
  } else {
    debugSheet
      .getRange(nextDebugRow + 1, nextDebugCol + 2)
      .setValue('Script did not successfully finish');
  }
  // ... later ...
  if (errorTracker.getTotalErrorCount() > 0) {
    throw new Error(
      `${errorTracker.getTotalErrorCount()} video(s) were not added to playlists correctly, please check Debug sheet. Timestamps for respective rows has not been updated.`
    );
  }
  ```

### Phase 4: Replace All addError Calls

#### Step 4.1: Remove addError function (lines 965-969)
- **Location:** Near end of file
- **Action:** Delete the entire `addError()` function:
  ```typescript
  function addError(s: string): void {
    Logger.log(s);
    errorflag = true;
    plErrorCount += 1;
  }
  ```

#### Step 4.2: Replace all addError() calls with errorTracker.addError()
- **Action:** Find and replace all 31 instances of `addError(` with `errorTracker.addError(`
- **Locations:** Throughout the file including:
  - `getAllChannelIds()` - 2 calls
  - Channel ID retrieval from usernames - 5 calls
  - `getVideoIdsWithLessQueries()` - 4 calls
  - `getPlaylistVideoIds()` - 3 calls
  - `addVideosToPlaylist()` - 6 calls
  - `deletePlaylistItems()` - 2 calls
  - Various locations in `updatePlaylists()` - 9 calls

**Note:** This approach eliminates the wrapper function entirely and makes all code directly use the ErrorTracker instance. While this requires updating all call sites, it provides cleaner architecture and makes the error tracking mechanism more explicit.

### Phase 5: Refactor addVideosToPlaylist Function

#### Step 5.1: Convert from recursion to loop
- **Location:** `addVideosToPlaylist()` function (lines ~623-730)
- **Current signature:**
  ```typescript
  function addVideosToPlaylist(
    playlistId: string,
    videoIds: string[],
    idx: number = 0,
    successCount: number = 0,
    errorCount: number = 0
  ): void
  ```
- **New signature:**
  ```typescript
  function addVideosToPlaylist(
    playlistId: string,
    videoIds: string[]
  ): void
  ```
- **Action:** Refactor to use a for loop instead of recursion

#### Step 5.2: Implement new loop-based logic
- **Replace entire function body with:**
  ```typescript
  function addVideosToPlaylist(
    playlistId: string,
    videoIds: string[]
  ): void {
    const totalVids: number = videoIds.length;
    
    if (totalVids === 0) {
      Logger.log('No new videos yet.');
      return;
    }
    
    if (totalVids >= MAX_VIDEO_COUNT) {
      errorTracker.addError(
        `The query contains ${totalVids} videos. Script cannot add more than ${MAX_VIDEO_COUNT} videos. Try moving the timestamp closer to today.`
      );
      return;
    }
    
    let successCount: number = 0;
    const errorCountBefore: number = errorTracker.getPlaylistErrorCount();
    
    for (let idx = 0; idx < totalVids; idx += 1) {
      try {
        YouTube.PlaylistItems!.insert(
          {
            snippet: {
              playlistId,
              resourceId: {
                videoId: videoIds[idx],
                kind: 'youtube#video',
              },
            },
          },
          'snippet'
        );
        successCount += 1;
      } catch (e: any) {
        if (e.details.code === 404) {
          // Check if video is private
          try {
            const results: GoogleAppsScript.YouTube.Schema.VideoListResponse =
              YouTube.Videos!.list('snippet', {
                id: videoIds[idx],
              });
            if (results.items!.length === 0) {
              // Private video - log but don't count as error
              Logger.log(
                `Couldn't update playlist with video (${videoIds[idx]}), ERROR: Cannot find video, most likely private`
              );
            } else {
              errorTracker.addError(
                `Couldn't update playlist with video (${videoIds[idx]}), 404 on update, but found video with API, not sure what to do`
              );
            }
          } catch (e2: any) {
            errorTracker.addError(
              `Couldn't update playlist with video (${
                videoIds[idx]
              }), 404 on update (got ${
                e.message
              }), tried to search for video with id, got ERROR: Message: [${
                e2.message
              }] Details: ${JSON.stringify(e.details)}`
            );
          }
        } else if (
          e.details.code === 400 &&
          e.details.errors[0].reason === 'playlistOperationUnsupported'
        ) {
          errorTracker.addError(
            "Couldn't update watch later or watch history playlist with video, functionality deprecated; try adding videos to a different playlist"
          );
        } else if (e.details.code === 409) {
          // Duplicate video - log but don't count as error
          Logger.log(
            `Couldn't update playlist with video (${videoIds[idx]}), ERROR: Video already exists`
          );
        } else {
          errorTracker.addError(
            `Couldn't update playlist with video (${
              videoIds[idx]
            }), ERROR: Message: [${e.message}] Details: ${JSON.stringify(
              e.details
            )}`
          );
        }
      }
    }
    
    const errorCountAfter: number = errorTracker.getPlaylistErrorCount();
    const errorCount: number = errorCountAfter - errorCountBefore;
    Logger.log(
      `Added ${successCount} video(s) to playlist. Error for ${errorCount} video(s).`
    );
  }
  ```

**Rationale:**
- Eliminates recursion and parameter passing for counts
- Clearer control flow with a standard for loop
- Uses ErrorTracker methods directly for error tracking
- Private videos and duplicates use `Logger.log()` only (not counted as errors)
- Actual errors call `errorTracker.addError()` which affects the error state
- Calculates error count by comparing before/after values from ErrorTracker

### Phase 6: Testing Strategy

#### Step 6.1: Unit testing preparation
- Ensure the ErrorTracker class can be tested in isolation
- Consider adding test methods if needed

#### Step 6.2: Integration testing points
- Test that errors are logged correctly
- Test that playlist processing skips updates when errors occur
- Test that total error count is accumulated correctly
- Test that the final error message contains the correct count
- Test that error state resets properly between playlists

#### Step 6.3: Manual testing scenarios
1. Run with no errors - verify success message
2. Run with error in first playlist - verify error count and timestamp not updated
3. Run with errors in multiple playlists - verify total count is correct
4. Run with mix of successful and failed playlists - verify partial updates

### Phase 7: Documentation

#### Step 7.1: Update code comments
- Update JSDoc comments in `updatePlaylists()` to reference ErrorTracker
- Add comments explaining error tracking flow

#### Step 7.2: Update README if needed
- Document the error tracking mechanism if user-facing
- Note any changes to error handling behavior

---

## Migration Checklist

- [ ] Create ErrorTracker.ts file with class implementation
- [ ] Add import to sheetScript.ts
- [ ] Remove global error variables
- [ ] Create ErrorTracker instance
- [ ] Update updatePlaylists() function (5 changes)
- [ ] Replace all addError() calls with errorTracker.addError()
- [ ] Delete addError() function
- [ ] Refactor addVideosToPlaylist() to use loop instead of recursion
- [ ] Update addVideosToPlaylist() to use ErrorTracker methods
- [ ] Run TypeScript compilation to check for errors
- [ ] Perform integration testing
- [ ] Update documentation
- [ ] Review and commit changes

---

## Areas Requiring Clarification

### 1. ~~addVideosToPlaylist Error Counting Logic~~ (RESOLVED)

**Status:** ✅ Resolved in Phase 5 - line 709 will be removed entirely.

The local `errorCount` tracking in `addVideosToPlaylist()` serves a different purpose (tracking success rate for logging) and will remain separate from the ErrorTracker's error tracking. Only actual errors that should prevent playlist updates will call `errorTracker.addError()`.

### 2. ~~Error Counting for Private/Duplicate Videos~~ (RESOLVED)

**Status:** ✅ Resolved in Phase 5 - handled through refactored `addVideosToPlaylist()`.

The refactored function will:
- Use `Logger.log()` directly for private videos (404 errors where video can't be found)
- Use `Logger.log()` directly for duplicate videos (409 errors)
- Call `errorTracker.addError()` for all actual errors that should prevent playlist updates
- This preserves the current behavior where soft errors don't affect timestamp updates

### 3. ~~Error State vs Error Count~~ (RESOLVED)

**Status:** ✅ Resolved - error state derived from count.

The ErrorTracker class eliminates redundant state by:
- Removing the separate `hasPlaylistError` boolean flag
- Deriving error state from `playlistErrorCount > 0` in the `hasErrors()` method
- This is cleaner and eliminates the possibility of the flag and count being out of sync

### 4. ~~Recursive Error Handling in addVideosToPlaylist~~ (RESOLVED)

**Status:** ✅ Resolved in Phase 5 - converted to iterative loop.

The refactored function uses a standard for loop instead of recursion, eliminating:
- Parameter passing for counts
- Recursive call stack concerns
- Complex state management across calls

Error tracking is now straightforward: compare ErrorTracker's playlist count before and after the loop.
1. **Global instance** (recommended in plan): Create one instance in sheetScript.ts
2. **Parameter passing**: Pass ErrorTracker instance through function calls
3. **Singleton pattern**: Make ErrorTracker a singleton

**Questions:**
- Does the code architecture allow parameter passing easily?
- Are there other functions outside `updatePlaylists()` that need error tracking?
- Is there any concurrent execution to worry about?

**Recommendation:**
- Use global instance (option 1) for simplicity
- Google Apps Script typically doesn't have concurrency issues
- This minimizes changes to function signatures
- The instance is effectively scoped to a single execution of `updatePlaylists()`

---

## Benefits of This Refactoring

1. **Encapsulation:** Error tracking logic is contained in one class
2. **Testability:** ErrorTracker can be unit tested independently
3. **Type Safety:** TypeScript methods replace loose variable access
4. **Clarity:** Method names (`hasErrors()`, `resetForNextPlaylist()`) are self-documenting
5. **Maintainability:** Future error tracking features can be added to the class
6. **Reduced Global State:** Eliminates three global variables

---

## Potential Future Enhancements

Once the basic refactoring is complete, consider:

1. **Error categorization:** Track different types of errors (channel errors, video errors, API errors)
2. **Error details:** Store error messages in the class for detailed reporting
3. **Error limits:** Add methods to check if error threshold is exceeded
4. **Structured logging:** Return structured error data instead of throwing generic errors
5. **Per-playlist error tracking:** Maintain a history of which playlists had errors
6. **Retry logic:** Add methods to support retry attempts for failed operations

---

## Estimated Time

- **Phase 1** (Create class): 30 minutes
- **Phase 2** (Import and setup): 15 minutes
- **Phase 3** (Update updatePlaylists): 45 minutes
- **Phase 4** (Update addError): 10 minutes
- **Phase 5** (Update addVideosToPlaylist): 30 minutes
- **Phase 6** (Testing): 1-2 hours
- **Phase 7** (Documentation): 30 minutes

**Total estimated time:** 3.5-4.5 hours

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing behaviour | High | Thorough testing with various error scenarios |
| Missing error tracking locations | Medium | Careful grep search and code review |
| Complex addVideosToPlaylist logic | Medium | Keep local error counting, document interaction |
| TypeScript compilation issues | Low | Incremental changes, compile frequently |
| Regression in error messages | Low | Compare log output before and after |

---

## Rollback Plan

If issues are discovered after implementation:Refactor to loop-based approach, use ErrorTracker methods

1. **Immediate rollback:** Revert commits using git
2. **Partial rollback:** Comment out ErrorTracker usage, restore global variables
3. **Debug in place:** ErrorTracker methods can be instrumented with additional logging
