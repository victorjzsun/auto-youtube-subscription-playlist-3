/**
 * Auto Youtube Subscription Playlist (3)
 * This is a Google Apps Script that automatically adds new Youtube videos to playlists
 * (a replacement for Youtube Collections feature).
 * Code: https://github.com/Elijas/auto-youtube-subscription-playlist-2/
 * Copy Spreadsheet:
 * https://docs.google.com/spreadsheets/d/1sZ9U52iuws6ijWPQTmQkXvaZSV3dZ3W9JzhnhNTX9GU/copy
 */

import { onOpen } from './ui';
import ErrorTracker from './ErrorTracker';
import { PlaylistChangeSet, Video } from './models';
import dateToIsoString from './services/dateUtils';
import {
  DEBUG_FLAG_DONT_UPDATE_PLAYLISTS,
  DEBUG_FLAG_DONT_UPDATE_TIMESTAMP,
  DEBUG_FLAG_LOG_WHEN_NO_NEW_VIDEOS_FOUND,
  reservedColumnShortsFilter,
  reservedTableRows,
  reservedColumnPlaylist,
  reservedDebugNumRows,
  reservedDebugNumColumns,
} from './services/constants';
import SheetConfigService from './services/SheetConfigService';
import ChannelVideoService from './services/ChannelVideoService';
import SubscriptionsVideoService from './services/SubscriptionsVideoService';
import UserVideoService from './services/UserVideoService';
import PlaylistVideoService from './services/PlaylistVideoService';
import PlaylistUpdateService from './services/PlaylistUpdateService';
import DebugLogService from './services/DebugLogService';

/**
 * Main Function to update all Playlists
 * @param sheetParam - Optional sheet parameter, defaults to first sheet
 */
export function updatePlaylists(
  sheetFromCaller?: GoogleAppsScript.Spreadsheet.Sheet
): void {
  const errorTracker = new ErrorTracker();

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

  const sheetConfigService = new SheetConfigService(sheet);
  const channelVideoService = new ChannelVideoService();
  const subscriptionsVideoService = new SubscriptionsVideoService(
    channelVideoService
  );
  const userVideoService = new UserVideoService(channelVideoService);
  const playlistVideoService = new PlaylistVideoService();
  const playlistUpdateService = new PlaylistUpdateService();
  const debugLogService = new DebugLogService();

  const configsWithRows = sheetConfigService.getAllPlaylistConfigurations();

  let debugSheet: GoogleAppsScript.Spreadsheet.Sheet | null =
    spreadsheet.getSheetByName('DebugData');
  if (!debugSheet) {
    debugSheet = spreadsheet.insertSheet('DebugData').hideSheet();
  }
  const nextDebugCol: number = debugLogService.getNextDebugCol(debugSheet);
  let nextDebugRow: number = debugLogService.getNextDebugRow(
    debugSheet,
    nextDebugCol
  );
  const debugViewerSheet: GoogleAppsScript.Spreadsheet.Sheet | null =
    spreadsheet.getSheetByName('Debug');
  if (debugViewerSheet) {
    debugLogService.initDebugEntry(
      debugViewerSheet,
      nextDebugCol,
      nextDebugRow
    );
  } else {
    Logger.log('Debug viewer sheet not found');
  }

  configsWithRows.forEach(({ config, rowIndex }) => {
    Logger.clear();
    Logger.log(`Row: ${rowIndex + 1}`);

    const dateDiff: number = Date.now() - config.lastTimestamp.getTime();
    const nextTime: number = (config.frequencyHours ?? 0) * MILLIS_PER_HOUR;
    if (nextTime && dateDiff <= nextTime) {
      Logger.log('Skipped: Not time yet');
      return;
    }

    const videosToAdd: Video[] = [];

    config.sources.forEach((source) => {
      let sourceVideos: Video[] = [];

      // TODO: This should be a factory
      switch (source.type) {
        case 'subscriptions':
          sourceVideos = subscriptionsVideoService.getVideos(
            source,
            config.lastTimestamp,
            errorTracker
          );
          break;
        case 'username':
          sourceVideos = userVideoService.getVideos(
            source,
            config.lastTimestamp,
            errorTracker
          );
          break;
        case 'channel':
          sourceVideos = channelVideoService.getVideos(
            source,
            config.lastTimestamp,
            errorTracker
          );
          break;
        case 'playlist':
          sourceVideos = playlistVideoService.getVideos(
            source,
            config.lastTimestamp,
            errorTracker
          );
          if (
            DEBUG_FLAG_LOG_WHEN_NO_NEW_VIDEOS_FOUND &&
            sourceVideos.length === 0
          ) {
            Logger.log(
              `Playlist with id ${source.playlistId} has no new videos`
            );
          }
          break;
        default:
          break;
      }

      videosToAdd.push(...sourceVideos);
    });

    Logger.log(`Acquired ${videosToAdd.length} videos`);

    // TODO: Add filter service
    const filteredVideos: Video[] = applyFilters(videosToAdd, sheet, rowIndex);

    Logger.log(`Filtering finished, left with ${filteredVideos.length} videos`);

    const changeSet: PlaylistChangeSet = {
      videosToAdd: filteredVideos,
      playlistItemsToDelete: [],
    };

    if (!errorTracker.hasErrors()) {
      if (!DEBUG_FLAG_DONT_UPDATE_PLAYLISTS) {
        playlistUpdateService.addVideos(
          config.playlistId,
          changeSet.videosToAdd,
          errorTracker
        );
      } else {
        errorTracker.addError("Don't Update Playlists debug flag is set");
      }

      const daysBack: number | null = config.deleteDays;
      if (daysBack && daysBack > 0) {
        const deleteBeforeDate: Date = new Date(
          Date.now() - daysBack * MILLIS_PER_DAY
        );
        Logger.log(`Delete before: ${dateToIsoString(deleteBeforeDate)}`);
        playlistUpdateService.deleteItems(
          config.playlistId,
          deleteBeforeDate,
          errorTracker
        );
      }
    }

    if (!errorTracker.hasErrors() && !DEBUG_FLAG_DONT_UPDATE_TIMESTAMP) {
      sheetConfigService.updateLastTimestamp(rowIndex, new Date());
    }

    // TODO: Add to debug service
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
    errorTracker.resetForNextPlaylist();
  });

  // Log finished script, only populate second column to signify end of execution when retrieving logs
  if (errorTracker.getTotalErrorCount() === 0) {
    debugSheet
      .getRange(nextDebugRow + 1, nextDebugCol + 2)
      .setValue('Updated all rows, script successfully finished');
  } else {
    debugSheet
      .getRange(nextDebugRow + 1, nextDebugCol + 2)
      .setValue('Script did not successfully finish');
  }
  nextDebugRow += 1;

  if (nextDebugRow > reservedDebugNumRows - 1) {
    let colIndex: number = 0;
    if (nextDebugCol < reservedDebugNumColumns - 2) {
      colIndex = nextDebugCol + 2;
    }
    debugLogService.clearDebugCol(debugSheet, colIndex);
  }
  if (debugViewerSheet) {
    debugLogService.loadLastDebugLog(debugViewerSheet);
  }
  if (errorTracker.getTotalErrorCount() > 0) {
    throw new Error(
      `${errorTracker.getTotalErrorCount()} video(s) were not added to playlists correctly, please check Debug sheet. Timestamps for respective rows has not been updated.`
    );
  }
}

//
// Functions to obtain channel IDs to check
//

export function getChannelId(): void {
  const ui = SpreadsheetApp.getUi();

  const result = ui.prompt(
    'Get Channel ID',
    'Please input a channel name:',
    ui.ButtonSet.OK_CANCEL
  );
  const button = result.getSelectedButton();
  const text = result.getResponseText();

  if (button === ui.Button.OK) {
    const results: GoogleAppsScript.YouTube.Schema.SearchListResponse =
      YouTube.Search!.list('id', {
        q: text,
        type: 'channel',
        maxResults: 50,
      });
    if (!results || !results.items) {
      ui.alert(`No results found for ${text}.`);
      return;
    }

    for (let i = 0; i < results.items.length; i += 1) {
      const item = results.items[i];
      if (!item.id || !item.id.channelId) {
        continue;
      }
      const confirmation = ui.alert(
        'Please confirm',
        `Is this the link to the channel you want?\n\nhttps://youtube.com/channel/${item.id.channelId}`,
        ui.ButtonSet.YES_NO
      );

      if (confirmation === ui.Button.YES) {
        ui.alert(`The channel ID is ${item.id.channelId}`);
        return;
      }
      if (confirmation === ui.Button.NO) {
        continue;
      }
      return;
    }

    ui.alert(`No results found for ${text}.`);
  }
}

// Returns a new filtered array of videos based on the filters selected in the sheet
function applyFilters(
  videos: Video[],
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  iRow: number
): Video[] {
  const filters: Array<(videoId: string) => boolean> = [];

  // Removes all shorts if enabled
  if (
    sheet.getRange(iRow + 1, reservedColumnShortsFilter + 1).getValue() === 'No'
  ) {
    Logger.log('Removing shorts');
    filters.push(removeShortsFilter);
  }

  return videos.filter((video) => filters.every((filter) => filter(video.id)));
}

// Returns false if video is a short by checking if its length is less than three minutes
// There might be better/more accurate ways
function removeShortsFilter(videoId: string): boolean {
  const response = YouTube.Videos!.list('contentDetails', {
    id: videoId,
  });

  const items = response.items;
  if (!items || items.length === 0) return false;

  const [firstItem] = items;
  const duration = firstItem.contentDetails?.duration;
  if (!duration) return false;

  return !isLessThanThreeMinutes(duration);
}

// Checks if an ISO 8601 duration is less or equal than three minutes.
// Verifying the duration is of the form PT1M or PTXXX.XXXS where X represents digits.
function isLessThanThreeMinutes(duration: string): boolean {
  // Check if duration is 3 minutes
  // Since there can be a 1 second variation, we check for 3 minutes + 1 second too, due to following bug
  // https://stackoverflow.com/questions/72459082/yt-api-pulling-different-video-lengths-for-youtube-videos
  if (duration === 'PT3M' || duration === 'PT3M1S') return true;
  if (duration.slice(0, 2) !== 'PT') return false;
  // match one or two groups of this, so e.g. "2M", "59S" or "2M5S"
  return duration.match('^PT([12]M|[1-5]?[0-9]S){1,2}$') != null;
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
  const data: string[][] = debugSheet.getDataRange().getValues();
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
// Makes Web App, function call from Google Sheets, etc
//

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
  const data: string[][] = sheet.getDataRange().getValues();
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
