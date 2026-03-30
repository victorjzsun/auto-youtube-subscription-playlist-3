# TODO Implementation Plan

This implementation plan documents the TODOs currently present in the codebase and describes the concrete code changes required to resolve them. Each item is written as a checklist so another agent can act on them directly.

## 1. `src/server/sheetScript.ts`
- [x] Replace the current `switch (source.type)` block with a dedicated factory or service lookup that returns the appropriate `VideoFetchService` for each source type.
  - Create a new `VideoFetchServiceFactory` or helper method in `src/server/services`.
  - Use a mapping from `source.type` to service instance: `subscriptions`, `username`, `channel`, `playlist`.
  - Wire `subscriptionsVideoService`, `userVideoService`, `channelVideoService`, and `playlistVideoService` through the factory.
  - Add a fallback for unsupported source types that logs an error and returns an empty result.
- [x] Remove the `// TODO: This should be a factory` comment.

## 2. `src/server/sheetScript.ts` — filter service integration
- [x] Confirm that `VideoFilterService` is the intended filter implementation and that it is used correctly.
  - If filtering is already implemented, remove the `// TODO: Add filter service` comment.
  - If additional configuration-driven filters are required, extend the service and config model accordingly.
- [x] Ensure `config.filters` is always non-null before calling `videoFilterService.filterVideos`.
- [x] Remove the corresponding `// TODO: Add filter service` comment from `src/server/sheetScript.ts`.

## 3. `src/server/services/SheetConfigService.ts`
- [x] Replace row-based config IDs (`config-${iRow}`) with stable configuration identifiers.
  - Add a persisted configuration ID column or a hidden mapping mechanism in the sheet.
  - Load and preserve that config ID for each playlist row during `getAllPlaylistConfigurations()`.
- [x] Update `updateLastTimestamp(id, timestamp)` to resolve the row from `idToRow` using the stable config ID.
- [x] Ensure row changes (insert/delete) do not invalidate persisted config IDs.
- [x] Remove the `TODO` comment from the class description.
- [x] Remove the corresponding `TODO` comment from `src/server/services/SheetConfigService.ts`.

## 4. `src/server/services/PlaylistUpdateService.ts` — error counting cleanup
- [x] Refactor `addVideos()` to remove the manual before/after playlist error count calculation.
  - Replace the current `errorCountBefore` / `errorCountAfter` logic with explicit counters for skipped duplicates and non-critical insert failures.
  - Ensure that duplicate video insertions with HTTP code `409` do not increment playlist error totals.
- [x] Remove the `// TODO: Clean up error counting here` comment.
- [x] Remove the corresponding `// TODO: Clean up error counting here` comment from `src/server/services/PlaylistUpdateService.ts`.

## 5. `src/server/services/PlaylistUpdateService.ts` — duplicate deletion efficiency
- [ ] Refactor duplicate detection in `deleteItems()`.
  - Replace the current nested `tempVideos.find(...)` approach with a faster `Set<string>` lookup.
  - Ensure only duplicate playlist entries are removed, preserving one instance of each video ID.
- [ ] Remove the `// TODO: Make more efficient` comment.

## 6. `src/server/services/PlaylistVideoService.ts`
- [ ] Break the large `getVideos()` method into smaller helper methods.
  - Extract playlist item pagination and ID collection into one helper method, e.g. `fetchPlaylistVideoIds()`.
  - Extract playlist existence validation into a separate helper method, e.g. `ensurePlaylistExists()`.
  - Keep the public `getVideos()` method responsible only for orchestration and error handling.
- [ ] Remove the `// TODO break into smaller methods` comment.

## 7. `src/server/services/SubscriptionsVideoService.ts`
- [ ] Replace the hard-coded `nextPageToken` array with correct YouTube API pagination using `result.nextPageToken`.
  - Use the response `nextPageToken` field to page through subscription results until no more pages remain.
  - Preserve same field selection and error handling behavior.
- [ ] Remove the `// TODO: Replace with nextPageToken provided in response` comment.

## 8. `src/server/services/UserVideoService.ts`
- [ ] Extract the username-to-channel lookup logic from `getVideos()` into a separate helper method.
  - Add a method such as `resolveChannelIdFromUsername(source.username, errorTracker)`.
  - Keep `getVideos()` focused on delegating to `ChannelVideoService` after the channel ID is resolved.
- [ ] Remove the `// TODO extract this to a separate method` comment.

## Verification and follow-up
- [ ] After implementing each change, remove the corresponding TODO comment.
- [ ] Run or add unit tests for factories, sheet config ID mapping, debug logging, playlist updates, playlist fetching, subscriptions paging, and username resolution.
- [ ] Review the updated code for consistency with the rest of the service-oriented architecture in `src/server/services`.

## Suggested file additions
- `src/server/services/VideoFetchServiceFactory.ts` (recommended)

---

This plan is designed for another agent to take direct action on the existing TODOs and remove them through targeted refactors and cleanup work.