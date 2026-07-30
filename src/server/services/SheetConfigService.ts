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
import { onOpen } from '../ui';

/**
 * Service responsible for reading and writing playlist configurations to the sheet.
 */
export default class SheetConfigService {
  private readonly sheet: GoogleAppsScript.Spreadsheet.Sheet;

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

      const id = `row-${iRow}`;
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

      configs.push(config);
    }

    return configs;
  }

  /**
   * Update the last timestamp for a given config id.
   */
  updateLastTimestamp(id: string, timestamp: Date): void {
    const rowIndex = this.getRowIndexFromId(id);
    this.sheet
      .getRange(rowIndex + 1, reservedColumnTimestamp + 1)
      .setValue(timestamp.toISOString());
  }

  /**
   * Save a playlist configuration row.
   * If configId is provided and valid, update the existing row.
   * Otherwise append a new playlist configuration row.
   * @param configId - Optional internal config ID
   * @param playlistId - The YouTube playlist ID
   * @param name - Optional friendly playlist name
   * @param frequencyHours - Optional update frequency in hours
   * @param deleteDays - Optional delete age in days
   * @param lastTimestamp - Optional last update timestamp
   * @param sources - Optional array of source entries
   * @param filters - Optional filters
   */
  savePlaylistConfiguration(
    configId: string | null,
    playlistId: string,
    name?: string,
    frequencyHours?: number | null,
    deleteDays?: number | null,
    lastTimestamp?: string | Date | null,
    sources?: VideoSource[],
    filters?: { excludeShorts?: boolean }
  ): string {
    const playlistValue = name ? `${playlistId}@${name}` : playlistId;
    const shouldUseDefaultTimestamp =
      configId === null && (lastTimestamp === null || lastTimestamp === undefined);
    const timestampValue = lastTimestamp
      ? new Date(lastTimestamp).toISOString()
      : shouldUseDefaultTimestamp
      ? dateToIsoString(new Date(new Date().setHours(new Date().getHours() - 24)))
      : '';
    const frequencyValue =
      frequencyHours === null || frequencyHours === undefined
        ? ''
        : frequencyHours;
    const deleteDaysValue =
      deleteDays === null || deleteDays === undefined ? '' : deleteDays;
    const shortsValue = filters?.excludeShorts ? 'No' : '';
    const sourceValues: string[] = (sources ?? []).map((source) => {
      switch (source.type) {
        case 'channel':
          return source.channelId;
        case 'username':
          return source.username;
        case 'subscriptions':
          return 'ALL';
        case 'playlist':
          return source.playlistId;
        default:
          return '';
      }
    });

    const rowValues: Array<string | number> = [
      playlistValue,
      timestampValue,
      frequencyValue,
      deleteDaysValue,
      shortsValue,
      ...sourceValues,
    ];

    if (configId) {
      const rowIndex = this.getRowIndexFromId(configId);

      const totalColumns = this.sheet.getLastColumn();
      const clearColumns = totalColumns - reservedTableColumns;
      if (clearColumns > 0) {
        this.sheet
          .getRange(rowIndex + 1, reservedTableColumns + 1, 1, clearColumns)
          .clearContent();
      }

      this.sheet
        .getRange(rowIndex + 1, 1, 1, rowValues.length)
        .setValues([rowValues]);
      return configId;
    }

    this.sheet.appendRow(rowValues);
    const newRowIndex: number = this.sheet.getLastRow() - 1;
    return `row-${newRowIndex}`;
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

  private getRowIndexFromId(id: string): number {
    const rowIndex = id.split('-')[1] ? parseInt(id.split('-')[1], 10) : undefined;
    if (rowIndex === undefined) {
      throw new Error(`Config id ${id} not found`);
    }
    return rowIndex;
  }
}
