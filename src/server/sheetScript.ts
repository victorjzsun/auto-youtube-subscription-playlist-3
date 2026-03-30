/**
 * Auto Youtube Subscription Playlist (3)
 * This is a Google Apps Script that automatically adds new Youtube videos to playlists
 * (a replacement for Youtube Collections feature).
 * Code: https://github.com/Elijas/auto-youtube-subscription-playlist-2/
 * Copy Spreadsheet:
 * https://docs.google.com/spreadsheets/d/1sZ9U52iuws6ijWPQTmQkXvaZSV3dZ3W9JzhnhNTX9GU/copy
 */

import ErrorTracker from './ErrorTracker';
import { PlaylistChangeSet, Video } from './models';
import dateToIsoString from './services/dateUtils';
import {
  DEBUG_FLAG_DONT_UPDATE_PLAYLISTS,
  DEBUG_FLAG_DONT_UPDATE_TIMESTAMP,
  reservedTableRows,
  reservedColumnPlaylist,
} from './services/constants';
import SheetConfigService from './services/SheetConfigService';
import PlaylistUpdateService from './services/PlaylistUpdateService';
import DebugLogService from './services/DebugLogService';
import VideoFilterService from './services/VideoFilterService';
import VideoFetchServiceFactory from './services/VideoFetchServiceFactory';
import type { VideoFetchService } from './services/VideoFetchService';

/**
 * Main Function to update all Playlists
 * @param sheetParam - Optional sheet parameter, defaults to first sheet
 */
export function updatePlaylists(): void {
  const errorTracker = new ErrorTracker();

  const { service: sheetConfigService, spreadsheet } =
    SheetConfigService.initialize();

  const MILLIS_PER_HOUR: number = 1000 * 60 * 60;
  const MILLIS_PER_DAY: number = MILLIS_PER_HOUR * 24;
  const playlistUpdateService = new PlaylistUpdateService();
  const debugLogService = new DebugLogService();
  const videoFilterService = new VideoFilterService();

  const configs = sheetConfigService.getAllPlaylistConfigurations();

  const debugViewerSheetExists: boolean =
    debugLogService.initializeWithSpreadsheet(spreadsheet);

  if (!debugViewerSheetExists) {
    Logger.log('Debug viewer sheet not found');
  }

  configs.forEach((config) => {
    Logger.clear();
    Logger.log(`Updating config with name ${config.name}`);

    const dateDiff: number = Date.now() - config.lastTimestamp.getTime();
    const nextTime: number = (config.frequencyHours ?? 0) * MILLIS_PER_HOUR;
    if (nextTime && dateDiff <= nextTime) {
      Logger.log('Skipped: Not time yet');
      return;
    }

    const videosToAdd: Video[] = [];

    config.sources.forEach((source) => {
      const videoFetchService: VideoFetchService | null =
        VideoFetchServiceFactory.getServiceForSource(source, errorTracker);
      if (!videoFetchService) {
        errorTracker.addError(`Unsupported source type: ${source.type}`);
        return;
      }

      const sourceVideos: Video[] = videoFetchService.getVideos(
        source,
        config.lastTimestamp,
        errorTracker
      );

      videosToAdd.push(...sourceVideos);
    });

    Logger.log(`Acquired ${videosToAdd.length} videos`);

    const filteredVideos: Video[] = videoFilterService.filterVideos(
      videosToAdd,
      config.filters
    );

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
      sheetConfigService.updateLastTimestamp(config.id, new Date());
    }

    const newLogs: string[][] = Logger.getLog()
      .split('\n')
      .slice(0, -1)
      .map((log: string) => log.split(' INFO: '));
    debugLogService.appendLogs(newLogs);

    errorTracker.resetForNextPlaylist();
  });

  // Log finished script, only populate second column to signify end of execution when retrieving logs
  debugLogService.setCompletionMessage(errorTracker.getTotalErrorCount());
  debugLogService.cycleDebugColIfNeeded();
  debugLogService.loadLastDebugLog();

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
    updatePlaylists();
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
