import {
  reservedColumnDeleteDays,
  reservedColumnFrequency,
  reservedColumnPlaylist,
  reservedColumnShortsFilter,
  reservedColumnTimestamp,
  reservedTableColumns,
  reservedTableRows,
} from './constants';
import { PlaylistConfiguration, VideoSource } from '../models';
import dateToIsoString from './dateUtils';
import { makeid, onOpen } from '../ui';

/**
 * Service responsible for reading and writing playlist configurations to the sheet.
 */
export default class SheetConfigService {
  private readonly sheet: GoogleAppsScript.Spreadsheet.Sheet;

  private readonly idToRow: Map<string, number> = new Map();

  private constructor(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
    this.sheet = sheet;
  }

  /**
   * Initialize the SheetConfigService by retrieving and validating the playlist sheet
   * @param sheetFromCaller - Optional sheet parameter, defaults to first sheet
   * @returns An object containing the SheetConfigService instance and the spreadsheet
   */
  static initialize(sheetFromCaller?: GoogleAppsScript.Spreadsheet.Sheet): {
    service: SheetConfigService;
    spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
  } {
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

    return { service: new SheetConfigService(sheet), spreadsheet };
  }

  /**
   * Read all playlist configurations from the sheet.
   * Rows without a playlist ID are skipped.
   *
   * Playlist names can be stored inline with the playlist ID using the format:
   * playlistId@playlistName
   *
   * If @ is present, it splits the playlist ID and name.
   * If @ is absent, the entire value is treated as the playlist ID.
   */
  getAllPlaylistConfigurations(): PlaylistConfiguration[] {
    const data: any[][] = this.sheet.getDataRange().getValues();
    const configs: PlaylistConfiguration[] = [];

    for (
      let iRow: number = reservedTableRows;
      iRow < this.sheet.getLastRow();
      iRow += 1
    ) {
      const rawPlaylistData: string = data[iRow][reservedColumnPlaylist];
      if (!rawPlaylistData) continue;

      // Parse playlist name from composite format: playlistId@name
      const { playlistId, playlistName } =
        this.parsePlaylistIdAndName(rawPlaylistData);

      const lastTimestampStr: string = data[iRow][reservedColumnTimestamp];
      let lastTimestamp: Date;
      if (!lastTimestampStr) {
        lastTimestamp = new Date();
        lastTimestamp.setHours(lastTimestamp.getHours() - 24); // Subscriptions added starting with the last day
        this.sheet
          .getRange(iRow + 1, reservedColumnTimestamp + 1)
          .setValue(dateToIsoString(lastTimestamp));
      } else {
        lastTimestamp = new Date(lastTimestampStr);
      }

      const id = makeid();
      const config: PlaylistConfiguration = {
        id,
        name: playlistName || 'Playlist',
        playlistId,
        lastTimestamp,
        frequencyHours:
          data[iRow][reservedColumnFrequency] === '' ||
          data[iRow][reservedColumnFrequency] == null
            ? null
            : Number(data[iRow][reservedColumnFrequency]),
        deleteDays:
          data[iRow][reservedColumnDeleteDays] === '' ||
          data[iRow][reservedColumnDeleteDays] == null
            ? null
            : Number(data[iRow][reservedColumnDeleteDays]),
        sources: this.parseVideoSourcesFromRow(data[iRow]),
        filters: {
          excludeShorts: data[iRow][reservedColumnShortsFilter] === 'No',
        },
      };

      this.idToRow.set(id, iRow);
      configs.push(config);
    }

    return configs;
  }

  /**
   * Update the last timestamp for a given config id.
   */
  updateLastTimestamp(id: string, timestamp: Date): void {
    const rowIndex = this.idToRow.get(id);
    if (rowIndex === undefined) {
      throw new Error(`Config id ${id} not found`);
    }
    this.sheet
      .getRange(rowIndex + 1, reservedColumnTimestamp + 1)
      .setValue(timestamp.toISOString());
  }

  /**
   * Update the playlist name for a given config id.
   * The name is stored inline with the playlist ID using the format: playlistId@name
   * @param id - The internal config ID
   * @param playlistId - The YouTube playlist ID
   * @param name - The playlist name (empty string removes the name)
   */
  updatePlaylistName(id: string, playlistId: string, name: string): void {
    const rowIndex = this.idToRow.get(id);
    if (rowIndex === undefined) {
      throw new Error(`Config id ${id} not found`);
    }

    const newValue = name ? `${playlistId}@${name}` : playlistId;
    this.sheet
      .getRange(rowIndex + 1, reservedColumnPlaylist + 1)
      .setValue(newValue);
  }

  /**
   * Parse the playlist ID and name from the composite format: playlistId@name
   * If @ is absent, the entire value is treated as the playlist ID.
   * @param rawPlaylistData - Raw playlist data from the sheet
   * @returns Object with parsed playlistId and playlistName
   */
  private parsePlaylistIdAndName(rawPlaylistData: string): {
    playlistId: string;
    playlistName: string;
  } {
    const atIndex = rawPlaylistData.indexOf('@');
    if (atIndex > -1) {
      return {
        playlistId: rawPlaylistData.substring(0, atIndex),
        playlistName: rawPlaylistData.substring(atIndex + 1),
      };
    }
    return {
      playlistId: rawPlaylistData,
      playlistName: '',
    };
  }

  private parseVideoSourcesFromRow(row: any[]): VideoSource[] {
    const sources: VideoSource[] = [];

    for (
      let iColumn: number = reservedTableColumns;
      iColumn < row.length;
      iColumn += 1
    ) {
      const cell: unknown = row[iColumn];
      if (!cell) continue;
      const channel: string = `${cell}`.trim();
      if (!channel) continue;

      if (channel === 'ALL') {
        sources.push({ type: 'subscriptions' });
      } else if (channel.substring(0, 2) === 'PL' && channel.length > 10) {
        sources.push({ type: 'playlist', playlistId: channel });
      } else if (channel.substring(0, 2) === 'UC' && channel.length > 10) {
        sources.push({ type: 'channel', channelId: channel });
      } else {
        sources.push({ type: 'username', username: channel });
      }
    }

    return sources;
  }
}
