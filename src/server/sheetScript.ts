/**
 * Auto Youtube Subscription Playlist (3)
 * This is a Google Apps Script that automatically adds new Youtube videos to playlists
 * (a replacement for Youtube Collections feature).
 * Code: https://github.com/Elijas/auto-youtube-subscription-playlist-2/
 * Copy Spreadsheet:
 * https://docs.google.com/spreadsheets/d/1sZ9U52iuws6ijWPQTmQkXvaZSV3dZ3W9JzhnhNTX9GU/copy
 */

import { onOpen } from "./ui";

// Adjustable to quota of Youtube API
const maxVideos: number = 200;

// Error flags
let errorflag: boolean = false;
let plErrorCount: number = 0;
let totalErrorCount: number = 0;
const DEBUG_FLAG_DONT_UPDATE_TIMESTAMP: boolean = false;
const DEBUG_FLAG_DONT_UPDATE_PLAYLISTS: boolean = false;
const DEBUG_FLAG_LOG_WHEN_NO_NEW_VIDEOS_FOUND: boolean = false;

// Reserved Row and Column indices (zero-based)
// If you use getRange remember those indices are one-based, so add + 1 in that call i.e.
// sheet.getRange(iRow + 1, reservedColumnTimestamp + 1).setValue(isodate);
const reservedTableRows: number = 3; // Start of the range of the PlaylistID+ChannelID data
const reservedTableColumns: number = 5; // Start of the range of the ChannelID data (0: A, 1: B, 2: C, 3: D, 4: E, 5: F, ...)
const reservedColumnPlaylist: number = 0; // Column containing playlist to add to
const reservedColumnTimestamp: number = 1; // Column containing last timestamp
const reservedColumnFrequency: number = 2; // Column containing number of hours until new check
const reservedColumnDeleteDays: number = 3; // Column containing number of days before today until videos get deleted

// Reserved lengths
const reservedDebugNumRows: number = 900; // Number of rows to use in a column before moving on to the next column in debug sheet
const reservedDebugNumColumns: number = 26; // Number of columns to use in debug sheet, must be at least 4 to allow infinite cycle

/**
 * Extend Date with Iso String with timezone support (Youtube needs IsoDates)
 * https://stackoverflow.com/questions/17415579/how-to-iso-8601-format-a-date-with-timezone-offset-in-javascript
 */
function toIsoString(date: Date): string {
  const tzo: number = -date.getTimezoneOffset();
  const dif: string = tzo >= 0 ? '+' : '-';
  const pad = (num: number): string => {
    const norm: number = Math.floor(Math.abs(num));
    return (norm < 10 ? '0' : '') + norm;
  };
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}${dif}${pad(tzo / 60)}:${pad(tzo % 60)}`;
}

/**
 * Main Function to update all Playlists
 * @param sheetParam - Optional sheet parameter, defaults to first sheet
 */
export function updatePlaylists(
  sheetFromCaller?: GoogleAppsScript.Spreadsheet.Sheet
): void {
  errorflag = false;
  plErrorCount = 0;
  totalErrorCount = 0;

  let sheet: GoogleAppsScript.Spreadsheet.Sheet | undefined = sheetFromCaller;
  let sheetID: string | null =
    PropertiesService.getScriptProperties().getProperty('sheetID');
  if (!sheetID) onOpen();
  sheetID = PropertiesService.getScriptProperties().getProperty('sheetID');
  if (!sheetID) throw new Error('Sheet ID not found in script properties');

  const spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet =
    SpreadsheetApp.openById(sheetID);
  if (!sheet || !sheet.toString || sheet.toString() !== 'Sheet') {
    sheet = spreadsheet.getSheets()[0];
  }
  if (!sheet || sheet.getRange('A3').getValue() !== 'Playlist ID') {
    const additional: string = sheet
      ? `, instead found sheet with name ${sheet.getName()}`
      : '';
    throw new Error(
      `Cannot find playlist sheet, make sure the sheet with playlist IDs and channels is the first sheet (leftmost)${additional}`
    );
  }

  const MILLIS_PER_HOUR: number = 1000 * 60 * 60;
  const MILLIS_PER_DAY: number = MILLIS_PER_HOUR * 24;
  const data: any[][] = sheet.getDataRange().getValues();
  let debugSheet: GoogleAppsScript.Spreadsheet.Sheet | null =
    spreadsheet.getSheetByName('DebugData');
  if (!debugSheet) {
    debugSheet = spreadsheet.insertSheet('DebugData').hideSheet();
  }
  const nextDebugCol: number = getNextDebugCol(debugSheet);
  let nextDebugRow: number = getNextDebugRow(debugSheet, nextDebugCol);
  const debugViewerSheet: GoogleAppsScript.Spreadsheet.Sheet | null =
    spreadsheet.getSheetByName('Debug');
  if (debugViewerSheet) {
    initDebugEntry(debugViewerSheet, nextDebugCol, nextDebugRow);
  } else {
    Logger.log('Debug viewer sheet not found');
  }

  /// For each playlist...
  for (
    let iRow: number = reservedTableRows;
    iRow < sheet.getLastRow();
    iRow += 1
  ) {
    Logger.clear();
    Logger.log(`Row: ${iRow + 1}`);
    const playlistId: string = data[iRow][reservedColumnPlaylist];
    if (!playlistId) continue;

    let lastTimestamp: string = data[iRow][reservedColumnTimestamp];
    if (!lastTimestamp) {
      const date: Date = new Date();
      date.setHours(date.getHours() - 24); // Subscriptions added starting with the last day
      const isodate: string = toIsoString(date);
      sheet.getRange(iRow + 1, reservedColumnTimestamp + 1).setValue(isodate);
      lastTimestamp = isodate;
    }

    // Check if it's time to update already
    const freqDate: Date = new Date(lastTimestamp);
    const dateDiff: number = Date.now() - freqDate.getTime();
    const nextTime: number =
      data[iRow][reservedColumnFrequency] * MILLIS_PER_HOUR;
    if (nextTime && dateDiff <= nextTime) {
      Logger.log('Skipped: Not time yet');
    } else {
      /// ...get channels...
      const channelIds: string[] = [];
      const playlistIds: string[] = [];
      for (
        let iColumn: number = reservedTableColumns;
        iColumn < sheet.getLastColumn();
        iColumn += 1
      ) {
        const channel: string = data[iRow][iColumn];
        if (!channel) continue;
        else if (channel === 'ALL') {
          const newChannelIds: string[] = getAllChannelIds();
          if (!newChannelIds || newChannelIds.length === 0) {
            addError('Could not find any subscriptions');
          } else {
            channelIds.push(...newChannelIds);
          }
        } else if (channel.substring(0, 2) === 'PL' && channel.length > 10) {
          // Add videos from playlist. MaybeTODO: better validation, since might interpret a channel with a name "PL..." as a playlist ID
          playlistIds.push(channel);
        } else if (!(channel.substring(0, 2) === 'UC' && channel.length > 10)) {
          // Check if it is not a channel ID (therefore a username). MaybeTODO: do a better validation, since might interpret a channel with a name "UC..." as a channel ID
          try {
            const user: GoogleAppsScript.YouTube.Schema.ChannelListResponse =
              YouTube.Channels!.list('id', {
                forUsername: channel,
                maxResults: 1,
              });
            if (!user || !user.items) {
              addError(`Cannot query for user ${channel}`);
            } else if (user.items.length === 0) {
              addError(`No user with name ${channel}`);
            } else if (user.items.length !== 1) {
              addError(`Multiple users with name ${channel}`);
            } else if (!user.items[0].id) {
              addError(`Cannot get id from user ${channel}`);
            } else {
              channelIds.push(user.items[0].id);
            }
          } catch (e: any) {
            addError(
              `Cannot search for channel with name ${channel}, ERROR: Message: [${
                e.message
              }] Details: ${JSON.stringify(e.details)}`
            );
            continue;
          }
        } else {
          channelIds.push(channel);
        }
      }

      /// ...get videos from the channels...
      const newVideoIds: string[] = [];
      for (let i: number = 0; i < channelIds.length; i += 1) {
        const videoIds: string[] = getVideoIdsWithLessQueries(
          channelIds[i],
          lastTimestamp
        );
        if (!videoIds || typeof videoIds !== 'object') {
          addError(`Failed to get videos with channel id ${channelIds[i]}`);
        } else if (
          DEBUG_FLAG_LOG_WHEN_NO_NEW_VIDEOS_FOUND &&
          videoIds.length === 0
        ) {
          Logger.log(`Channel with id ${channelIds[i]} has no new videos`);
        } else {
          newVideoIds.push(...videoIds);
        }
      }
      for (let i: number = 0; i < playlistIds.length; i += 1) {
        const videoIds: string[] = getPlaylistVideoIds(
          playlistIds[i],
          lastTimestamp
        );
        if (!videoIds || typeof videoIds !== 'object') {
          addError(`Failed to get videos with playlist id ${playlistIds[i]}`);
        } else if (
          DEBUG_FLAG_LOG_WHEN_NO_NEW_VIDEOS_FOUND &&
          videoIds.length === 0
        ) {
          Logger.log(`Playlist with id ${playlistIds[i]} has no new videos`);
        } else {
          newVideoIds.push(...videoIds);
        }
      }

      Logger.log(`Acquired ${newVideoIds.length} videos`);

      if (!errorflag) {
        // ...add videos to playlist...
        if (!DEBUG_FLAG_DONT_UPDATE_PLAYLISTS) {
          addVideosToPlaylist(playlistId, newVideoIds);
        } else {
          addError("Don't Update Playlists debug flag is set");
        }

        /// ...delete old videos in playlist
        const daysBack: number = data[iRow][reservedColumnDeleteDays];
        if (daysBack && daysBack > 0) {
          const deleteBeforeTimestamp: string = toIsoString(
            new Date(new Date().getTime() - daysBack * MILLIS_PER_DAY)
          );
          Logger.log(`Delete before: ${deleteBeforeTimestamp}`);
          deletePlaylistItems(playlistId, deleteBeforeTimestamp);
        }
      }
      // Update timestamp
      if (!errorflag && !DEBUG_FLAG_DONT_UPDATE_TIMESTAMP) {
        sheet
          .getRange(iRow + 1, reservedColumnTimestamp + 1)
          .setValue(toIsoString(new Date()));
      }
    }
    // Prints logs to Debug sheet
    const newLogs: string[][] = Logger.getLog()
      .split('\n')
      .slice(0, -1)
      .map((log: string) => log.split(' INFO: '));
    if (newLogs.length > 0) {
      debugSheet
        .getRange(nextDebugRow + 1, nextDebugCol + 1, newLogs.length, 2)
        .setValues(newLogs);
    }
    nextDebugRow += newLogs.length;
    errorflag = false;
    totalErrorCount += plErrorCount;
    plErrorCount = 0;
  }

  // Log finished script, only populate second column to signify end of execution when retrieving logs
  if (totalErrorCount === 0) {
    debugSheet
      .getRange(nextDebugRow + 1, nextDebugCol + 2)
      .setValue('Updated all rows, script successfully finished');
  } else {
    debugSheet
      .getRange(nextDebugRow + 1, nextDebugCol + 2)
      .setValue('Script did not successfully finish');
  }
  nextDebugRow += 1;
  // Clear next debug column if filled reservedDebugNumRows rows
  if (nextDebugRow > reservedDebugNumRows - 1) {
    let colIndex: number = 0;
    if (nextDebugCol < reservedDebugNumColumns - 2) {
      colIndex = nextDebugCol + 2;
    }
    clearDebugCol(debugSheet, colIndex);
  }
  if (debugViewerSheet) {
    loadLastDebugLog(debugViewerSheet);
  }
  if (totalErrorCount > 0) {
    throw new Error(
      `${totalErrorCount} video(s) were not added to playlists correctly, please check Debug sheet. Timestamps for respective rows has not been updated.`
    );
  }
}

//
// Functions to obtain channel IDs to check
//

/**
 * Get Channel IDs from Subscriptions (ALL keyword)
 * Source: https://www.reddit.com/r/youtube/comments/3br98c/a_way_to_automatically_add_subscriptions_to/
 * @returns Array of channel IDs from user's subscriptions
 */
function getAllChannelIds(): string[] {
  let AboResponse: GoogleAppsScript.YouTube.Schema.SubscriptionListResponse;
  const AboList: [string[], string[]] = [[], []];
  // Workaround: nextPageToken API-Bug (these Tokens are limited to 1000 Subscriptions... but you can add more Tokens.)
  const nextPageToken: string[] = [
    '',
    'CDIQAA',
    'CGQQAA',
    'CJYBEAA',
    'CMgBEAA',
    'CPoBEAA',
    'CKwCEAA',
    'CN4CEAA',
    'CJADEAA',
    'CMIDEAA',
    'CPQDEAA',
    'CKYEEAA',
    'CNgEEAA',
    'CIoFEAA',
    'CLwFEAA',
    'CO4FEAA',
    'CKAGEAA',
    'CNIGEAA',
    'CIQHEAA',
    'CLYHEAA',
  ];
  let nptPage: number = 0;
  try {
    do {
      AboResponse = YouTube.Subscriptions!.list('snippet', {
        mine: true,
        maxResults: 50,
        order: 'alphabetical',
        pageToken: nextPageToken[nptPage],
        fields: 'items(snippet(title,resourceId(channelId)))',
      });
      for (let i = 0, ix = AboResponse.items!.length; i < ix; i += 1) {
        AboList[0].push(AboResponse.items![i].snippet!.title!);
        AboList[1].push(AboResponse.items![i].snippet!.resourceId!.channelId!);
      }
      nptPage += 1;
    } while (AboResponse.items!.length > 0 && nptPage < 20);
    if (AboList[0].length !== AboList[1].length) {
      addError(
        `While getting subscriptions, the number of titles (${AboList[0].length}) did not match the number of channels (${AboList[1].length}).`
      );
      return [];
    }
  } catch (e: any) {
    addError(
      `Could not get subscribed channels, ERROR: Message: [${
        e.message
      }] Details: ${JSON.stringify(e.details)}`
    );
    return [];
  }

  Logger.log(`Acquired subscriptions ${AboList[1].length}`);
  return AboList[1];
}

//
// Functions to get Videos
//

/**
 * Get new videos from Channels using YouTube Search API
 * @param channelId - The YouTube channel ID
 * @param lastTimestamp - ISO timestamp to fetch videos published after
 * @returns Array of video IDs
 */
// @ts-ignore
function getVideoIds(channelId: string, lastTimestamp: string): string[] {
  const videoIds: string[] = [];
  let nextPageToken: string | undefined = '';
  do {
    try {
      const results: GoogleAppsScript.YouTube.Schema.SearchListResponse =
        YouTube.Search!.list('id', {
          channelId,
          maxResults: 50,
          order: 'date',
          publishedAfter: lastTimestamp,
          pageToken: nextPageToken,
          type: 'video',
        });
      if (!results || !results.items) {
        addError(
          `YouTube video search returned invalid response for channel with id ${channelId}`
        );
        return [];
      }
      for (let j = 0; j < results.items.length; j += 1) {
        const item: GoogleAppsScript.YouTube.Schema.SearchResult =
          results.items[j];
        if (!item.id) {
          Logger.log(`YouTube search result (${item}) doesn't have id`);
          continue;
        } else if (!item.id.videoId) {
          Logger.log(`YouTube search result (${item}) doesn't have videoId`);
          continue;
        }
        videoIds.push(item.id.videoId);
      }
      nextPageToken = results.nextPageToken;
    } catch (e: any) {
      Logger.log(
        `Cannot search YouTube with channel id ${channelId}, ERROR: Message: [${
          e.message
        }] Details: ${JSON.stringify(e.details)}`
      );
      break;
    }
  } while (nextPageToken != null);

  if (videoIds.length === 0) {
    try {
      // Check Channel validity
      const results: GoogleAppsScript.YouTube.Schema.ChannelListResponse =
        YouTube.Channels!.list('id', {
          id: channelId,
        });
      if (!results || !results.items) {
        addError(
          `YouTube channel search returned invalid response for channel with id ${channelId}`
        );
        return [];
      }
      if (results.items.length === 0) {
        addError(`Cannot find channel with id ${channelId}`);
        return [];
      }
    } catch (e: any) {
      addError(
        `Cannot search YouTube for channel with id ${channelId}, ERROR: Message: [${
          e.message
        }] Details: ${JSON.stringify(e.details)}`
      );
      return [];
    }
  }

  return videoIds;
}

/**
 * Get videos from Channels but with less Quota use
 * Slower and date ordering is a bit messy but less quota costs
 * @param channelId - The YouTube channel ID
 * @param lastTimestamp - ISO timestamp to filter videos
 * @returns Array of video IDs
 */
function getVideoIdsWithLessQueries(
  channelId: string,
  lastTimestamp: string
): string[] {
  const videoIds: string[] = [];
  let uploadsPlaylistId: string;
  try {
    // Check Channel validity
    const results: GoogleAppsScript.YouTube.Schema.ChannelListResponse =
      YouTube.Channels!.list('contentDetails', {
        id: channelId,
      });
    if (!results || !results.items) {
      addError(
        `YouTube channel search returned invalid response for channel with id ${channelId}`
      );
      return [];
    }
    if (results.items.length === 0) {
      addError(`Cannot find channel with id ${channelId}`);
      return [];
    }
    uploadsPlaylistId =
      results.items[0].contentDetails!.relatedPlaylists!.uploads!;
  } catch (e: any) {
    addError(
      `Cannot search YouTube for channel with id ${channelId}, ERROR: Message: [${
        e.message
      }] Details: ${JSON.stringify(e.details)}`
    );
    return [];
  }

  let nextPageToken: string | undefined = '';
  do {
    try {
      const results: GoogleAppsScript.YouTube.Schema.PlaylistItemListResponse =
        YouTube.PlaylistItems!.list('contentDetails', {
          playlistId: uploadsPlaylistId,
          maxResults: 50,
          pageToken: nextPageToken,
        });
      const videosToBeAdded: GoogleAppsScript.YouTube.Schema.PlaylistItem[] =
        results.items!.filter(
          (vid: GoogleAppsScript.YouTube.Schema.PlaylistItem) =>
            new Date(lastTimestamp) <=
            new Date(vid.contentDetails!.videoPublishedAt!)
        );
      if (videosToBeAdded.length === 0) {
        break;
      } else {
        videoIds.push(
          ...videosToBeAdded.map(
            (vid: GoogleAppsScript.YouTube.Schema.PlaylistItem) =>
              vid.contentDetails!.videoId!
          )
        );
      }
      nextPageToken = results.nextPageToken;
    } catch (e: any) {
      if (e.details.code !== 404) {
        // Skip error count if Playlist isn't found, then channel is empty
        addError(
          `Cannot search YouTube with playlist id ${uploadsPlaylistId}, ERROR: Message: [${
            e.message
          }] Details: ${JSON.stringify(e.details)}`
        );
      } else {
        Logger.log(
          `Channel ${channelId} does not have any uploads in ${uploadsPlaylistId}, Failed with error Message: [${
            e.message
          }] Details: ${JSON.stringify(e.details)}`
        );
      }
      return [];
    }
  } while (nextPageToken != null);

  return videoIds.reverse(); // Reverse to get videos in ascending order by date
}

/**
 * Get Video IDs from Playlist
 * @param playlistId - The YouTube playlist ID
 * @param lastTimestamp - ISO timestamp to filter videos
 * @returns Array of video IDs
 */
function getPlaylistVideoIds(
  playlistId: string,
  lastTimestamp: string
): string[] {
  const videoIds: string[] = [];
  let nextPageToken: string | undefined = '';
  while (nextPageToken != null) {
    try {
      const results: GoogleAppsScript.YouTube.Schema.PlaylistItemListResponse =
        YouTube.PlaylistItems!.list('snippet', {
          playlistId,
          maxResults: 50,
          order: 'date',
          publishedAfter: lastTimestamp,
          pageToken: nextPageToken,
        });
      if (!results || !results.items) {
        addError(
          `YouTube playlist search returned invalid response for playlist with id ${playlistId}`
        );
        return [];
      }
      for (let j = 0; j < results.items.length; j += 1) {
        const item: GoogleAppsScript.YouTube.Schema.PlaylistItem =
          results.items[j];
        if (item.snippet!.publishedAt! > lastTimestamp) {
          videoIds.push(item.snippet!.resourceId!.videoId!);
        }
      }
      nextPageToken = results.nextPageToken;
    } catch (e: any) {
      Logger.log(
        `Cannot search YouTube with playlist id ${playlistId}, ERROR: Message: [${
          e.message
        }] Details: ${JSON.stringify(e.details)}`
      );
      break;
    }
  }

  if (videoIds.length === 0) {
    try {
      // Check Playlist validity
      const results: GoogleAppsScript.YouTube.Schema.PlaylistListResponse =
        YouTube.Playlists!.list('id', {
          id: playlistId,
        });
      if (!results || !results.items) {
        addError(
          `YouTube channel search returned invalid response for playlist with id ${playlistId}`
        );
        return [];
      }
      if (results.items.length === 0) {
        addError(`Cannot find playlist with id ${playlistId}`);
        return [];
      }
    } catch (e: any) {
      addError(
        `Cannot lookup playlist with id ${playlistId} on YouTube, ERROR: Message: [${
          e.message
        }] Details: ${JSON.stringify(e.details)}`
      );
      return [];
    }
  }

  return videoIds;
}

//
// Functions to Add and Delete videos to playlist
//

/**
 * Add Videos to Playlist using Video IDs obtained before
 * @param playlistId - Target playlist ID
 * @param videoIds - Array of video IDs to add
 * @param idx - Current index (default: 0)
 * @param successCount - Success counter (default: 0)
 * @param errorCount - Error counter (default: 0)
 */
function addVideosToPlaylist(
  playlistId: string,
  videoIds: string[],
  idx: number = 0,
  successCount: number = 0,
  errorCount: number = 0
): void {
  const totalVids: number = videoIds.length;
  let newIdx: number = idx;
  let newSuccessCount: number = successCount;
  let newErrorCount: number = errorCount;
  if (totalVids > 0 && totalVids < maxVideos) {
    let success: number = 0;
    try {
      YouTube.PlaylistItems!.insert(
        {
          snippet: {
            playlistId,
            resourceId: {
              videoId: videoIds[newIdx],
              kind: 'youtube#video',
            },
          },
        },
        'snippet'
      );
      success = 1;
    } catch (e: any) {
      if (e.details.code === 404) {
        // Skip error count if video is private (found when using getPlaylistVideoIds)
        try {
          const results: GoogleAppsScript.YouTube.Schema.VideoListResponse =
            YouTube.Videos!.list('snippet', {
              id: videoIds[newIdx],
            });
          if (results.items!.length === 0) {
            Logger.log(
              `Couldn't update playlist with video (${videoIds[newIdx]}), ERROR: Cannot find video, most likely private`
            );
            newErrorCount -= 1;
          } else {
            addError(
              `Couldn't update playlist with video (${videoIds[newIdx]}), 404 on update, but found video with API, not sure what to do`
            );
          }
        } catch (e2: any) {
          addError(
            `Couldn't update playlist with video (${
              videoIds[newIdx]
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
        addError(
          "Couldn't update watch later or watch history playlist with video, functionality deprecated; try adding videos to a different playlist"
        );
      } else if (e.details.code === 409) {
        // Skip error count if Video exists in playlist already
        Logger.log(
          `Couldn't update playlist with video (${videoIds[newIdx]}), ERROR: Video already exists`
        );
      } else {
        addError(
          `Couldn't update playlist with video (${
            videoIds[newIdx]
          }), ERROR: Message: [${e.message}] Details: ${JSON.stringify(
            e.details
          )}`
        );
      }
      newErrorCount += 1;
      // TODO remove
      success = 0;
    } finally {
      newIdx += 1;
      newSuccessCount += success;
      if (totalVids === newIdx) {
        Logger.log(
          `Added ${newSuccessCount} video(s) to playlist. Error for ${newErrorCount} video(s).`
        );
        errorflag = newErrorCount > 0;
      } else {
        addVideosToPlaylist(
          playlistId,
          videoIds,
          newIdx,
          newSuccessCount,
          newErrorCount
        );
      }
    }
  } else if (totalVids === 0) {
    Logger.log('No new videos yet.');
  } else {
    addError(
      `The query contains ${totalVids} videos. Script cannot add more than ${maxVideos} videos. Try moving the timestamp closer to today.`
    );
  }
}

/**
 * Delete Videos from Playlist if they're older than the defined time
 * @param playlistId - Playlist to clean up
 * @param deleteBeforeTimestamp - ISO timestamp - videos older than this are deleted
 */
function deletePlaylistItems(
  playlistId: string,
  deleteBeforeTimestamp: string
): void {
  let nextPageToken: string | undefined = '';
  const allVideos: GoogleAppsScript.YouTube.Schema.PlaylistItem[] = [];
  while (nextPageToken !== undefined) {
    try {
      const results: GoogleAppsScript.YouTube.Schema.PlaylistItemListResponse =
        YouTube.PlaylistItems!.list('contentDetails', {
          playlistId,
          maxResults: 50,
          order: 'date',
          publishedBefore: deleteBeforeTimestamp, // this compares the timestamp when the video was added to playlist
          pageToken: nextPageToken,
        });

      for (let j = 0; j < results.items!.length; j += 1) {
        const item: GoogleAppsScript.YouTube.Schema.PlaylistItem =
          results.items![j];
        if (item.contentDetails!.videoPublishedAt! < deleteBeforeTimestamp) {
          // this compares the timestamp when the video was published
          Logger.log(`Del: | ${item.contentDetails!.videoPublishedAt}`);
          YouTube.PlaylistItems!.remove(item.id!);
        } else {
          allVideos.push(item);
        }
      }

      nextPageToken = results.nextPageToken;
    } catch (e: any) {
      addError(
        `Problem deleting existing videos from playlist with id ${playlistId}, ERROR: Message: [${
          e.message
        }] Details: ${JSON.stringify(e.details)}`
      );
      break;
    }
  }

  // Delete Duplicates Videos by videoId
  try {
    const tempVideos: GoogleAppsScript.YouTube.Schema.PlaylistItem[] = [];
    const duplicateVideos: GoogleAppsScript.YouTube.Schema.PlaylistItem[] = [];

    allVideos.forEach((x: GoogleAppsScript.YouTube.Schema.PlaylistItem) => {
      if (
        tempVideos.find(
          (y: GoogleAppsScript.YouTube.Schema.PlaylistItem) =>
            y.contentDetails!.videoId === x.contentDetails!.videoId
        )
      ) {
        duplicateVideos.push(x);
      } else {
        tempVideos.push(x);
      }
    });

    duplicateVideos.forEach(
      (x: GoogleAppsScript.YouTube.Schema.PlaylistItem) => {
        YouTube.PlaylistItems!.remove(x.id!);
      }
    );
  } catch (e: any) {
    addError(
      `Problem deleting duplicate videos from playlist with id ${playlistId}, ERROR: Message: [${
        e.message
      }] Details: ${JSON.stringify(e.details)}`
    );
  }
}

//
// Functions for maintaining debug logs
//

/**
 * Parse debug sheet to find column of cell to write debug logs to
 * @param debugSheet - The DebugData sheet
 * @returns Column index (0-24, even numbers only)
 */
function getNextDebugCol(
  debugSheet: GoogleAppsScript.Spreadsheet.Sheet
): number {
  const data: any[][] = debugSheet.getDataRange().getValues();
  // Only one column, not filled yet, return this column
  if (data.length < reservedDebugNumRows) return 0;
  // Need to iterate since next col might be in middle of data
  for (let col = 0; col < reservedDebugNumColumns; col += 2) {
    // New column
    // Necessary check since data is list of lists and col might be out of bounds
    if (data[0].length < col + 1) return col;
    // Unfilled column
    if (data[reservedDebugNumRows - 1][col + 1] === '') return col;
  }
  clearDebugCol(debugSheet, 0);
  return 0;
}

/**
 * Parse debug sheet to find row of cell to write debug logs to
 * @param debugSheet - The DebugData sheet
 * @param nextDebugCol - The column to check
 * @returns Row index (0-899)
 */
function getNextDebugRow(
  debugSheet: GoogleAppsScript.Spreadsheet.Sheet,
  nextDebugCol: number
): number {
  const data: any[][] = debugSheet.getDataRange().getValues();
  // Empty sheet, return first row
  if (data.length === 1 && data[0].length === 1 && data[0][0] === '') return 0;
  // Only one column, not filled yet, return last row + 1
  // Second check needed in case reservedDebugNumRows has expanded while other columns are filled
  if (data.length < reservedDebugNumRows && data[0][0] !== '')
    return data.length;
  for (let row = 0; row < reservedDebugNumRows; row += 1) {
    // Found empty row
    if (data[row][nextDebugCol + 1] === '') return row;
  }
  return 0;
}

/**
 * Clear column in debug sheet for next execution's logs
 * @param debugSheet - The DebugData sheet
 * @param colIndex - Column to clear
 */
function clearDebugCol(
  debugSheet: GoogleAppsScript.Spreadsheet.Sheet,
  colIndex: number
): void {
  // Clear first reservedDebugNumRows rows
  debugSheet.getRange(1, colIndex + 1, reservedDebugNumRows, 2).clear();
  // Clear as many additional rows as necessary
  let rowIndex: number = reservedDebugNumRows;
  while (
    debugSheet.getRange(rowIndex + 1, colIndex + 1, 1, 2).getValues()[0][1] !==
    ''
  ) {
    debugSheet.getRange(rowIndex + 1, colIndex + 1, 1, 2).clear();
    rowIndex += 1;
  }
}

/**
 * Add execution entry to debug viewer, shift previous executions and remove earliest if too many
 * @param debugViewer - The Debug sheet (user-facing)
 * @param nextDebugCol - Column for new logs in DebugData
 * @param nextDebugRow - Row for new logs in DebugData
 */
function initDebugEntry(
  debugViewer: GoogleAppsScript.Spreadsheet.Sheet,
  nextDebugCol: number,
  nextDebugRow: number
): void {
  // Clear currently viewing logs to get proper last row
  debugViewer.getRange('B3').clear();
  // Calculate number of existing executions
  const numExecutionsRecorded: number =
    debugViewer.getDataRange().getLastRow() - 2;
  const maxToCopy: number =
    (debugViewer.getRange('B1').getValue() as number) - 1;
  let numToCopy: number = numExecutionsRecorded;
  if (numToCopy > maxToCopy) {
    numToCopy = maxToCopy;
  }
  // Shift existing executions
  debugViewer
    .getRange(4, 1, numToCopy, 1)
    .setValues(debugViewer.getRange(3, 1, numToCopy, 1).getValues());
  if (numExecutionsRecorded - numToCopy > 0) {
    debugViewer
      .getRange(4 + numToCopy, 1, numExecutionsRecorded - numToCopy, 1)
      .clear();
  }
  // Copy new execution
  debugViewer
    .getRange(3, 1)
    .setValue(
      `=DebugData!${debugViewer
        .getRange(nextDebugRow + 1, nextDebugCol + 1)
        .getA1Notation()}`
    );
}

/**
 * Set currently viewed execution logs to most recent execution
 * @param debugViewer - The Debug sheet
 */
function loadLastDebugLog(
  debugViewer: GoogleAppsScript.Spreadsheet.Sheet
): void {
  debugViewer.getRange('B3').setValue(debugViewer.getRange('A3').getValue());
}

/**
 * Given an execution's (first log's) timestamp, return an array with the execution's logs
 * @param timestamp - ISO timestamp of the execution
 * @returns Array of log messages if found, empty string if not found, or Error if DebugData sheet doesn't exist
 */
export function getLogs(timestamp: string): string[][] | string {
  if (timestamp === '') return '';
  const debugSheet: GoogleAppsScript.Spreadsheet.Sheet | null =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DebugData');
  if (!debugSheet) throw Error('No debug logs');
  const data: any[][] = debugSheet.getDataRange().getValues();
  const results: string[][] = [];
  for (let col = 0; col < data[0].length; col += 2) {
    for (let row = 0; row < data.length; row += 1) {
      if (data[row][col] === timestamp) {
        for (; row < data.length; row += 1) {
          if (data[row][col] === '') break;
          results.push([data[row][col + 1]]);
        }
        return results;
      }
    }
  }
  return '';
}

//
// Functions for Housekeeping
// Makes Web App, function call from Google Sheets, add errors, etc
//

/**
 * Log errors in debug sheet and throw an error
 * @param s - Error message string
 */
function addError(s: string): void {
  Logger.log(s);
  errorflag = true;
  plErrorCount += 1;
}

/**
 * Extended DoGet event interface with URL parameters
 */
interface DoGetEvent extends GoogleAppsScript.Events.DoGet {
  parameter: {
    pl?: string;
    update?: string;
  };
}

/**
 * Function to publish Script as Web App
 * Handles HTTP GET requests
 * @param e - Event object with URL parameters
 * @returns HtmlOutput object
 */
export function doGet(e: DoGetEvent): GoogleAppsScript.HTML.HtmlOutput {
  const sheetID: string | null =
    PropertiesService.getScriptProperties().getProperty('sheetID');
  if (!sheetID) throw new Error('Sheet ID not found in script properties');

  if (e.parameter.update === 'True') {
    const sheet: GoogleAppsScript.Spreadsheet.Sheet =
      SpreadsheetApp.openById(sheetID).getSheets()[0];
    if (!sheet || sheet.getRange('A3').getValue() !== 'Playlist ID') {
      const additional: string = sheet
        ? `, instead found sheet with name ${sheet.getName()}`
        : '';
      throw new Error(
        `Cannot find playlist sheet, make sure the sheet with playlist IDs and channels is the first sheet (leftmost)${additional}`
      );
    }
    updatePlaylists(sheet);
  }

  const t: GoogleAppsScript.HTML.HtmlTemplate =
    HtmlService.createTemplateFromFile('index.html');
  (t as any).data = e.parameter.pl;
  (t as any).sheetID = sheetID;
  return t.evaluate();
}

/**
 * Function to select playlist for Web App
 * @param pl - Playlist row number (1-based, user perspective)
 * @param sheetID - Spreadsheet ID
 * @returns Playlist ID
 */
export function playlist(pl: number | undefined, sheetID: string): string {
  const sheet: GoogleAppsScript.Spreadsheet.Sheet =
    SpreadsheetApp.openById(sheetID).getSheets()[0];
  const data: any[][] = sheet.getDataRange().getValues();
  let plRow: number;
  if (pl === undefined) {
    plRow = reservedTableRows;
  } else {
    plRow = Number(pl) + reservedTableRows - 1; // I like to think of the first playlist as being number 1.
  }
  if (plRow > sheet.getLastRow()) {
    plRow = sheet.getLastRow();
  }
  const playlistId: string = data[plRow][reservedColumnPlaylist];
  return playlistId;
}
