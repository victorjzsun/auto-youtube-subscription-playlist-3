import {
  reservedColumnDeleteDays,
  reservedColumnFrequency,
  reservedColumnPlaylist,
  reservedColumnTimestamp,
  reservedTableColumns,
  reservedTableRows,
} from './constants';
import { PlaylistConfiguration, VideoSource } from '../models';
import dateToIsoString from './dateUtils';

/**
 * Service responsible for reading and writing playlist configurations to the sheet.
 * TODO: Create a configuration ID and map to rows, to remove having to pass row around
 */
export default class SheetConfigService {
  private readonly sheet: GoogleAppsScript.Spreadsheet.Sheet;

  constructor(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
    this.sheet = sheet;
  }

  /**
   * Read all playlist configurations from the sheet.
   * Rows without a playlist ID are skipped.
   */
  getAllPlaylistConfigurations(): Array<{
    config: PlaylistConfiguration;
    rowIndex: number;
  }> {
    const data: any[][] = this.sheet.getDataRange().getValues();
    const configs: Array<{ config: PlaylistConfiguration; rowIndex: number }> =
      [];

    for (
      let iRow: number = reservedTableRows;
      iRow < this.sheet.getLastRow();
      iRow += 1
    ) {
      const playlistId: string = data[iRow][reservedColumnPlaylist];
      if (!playlistId) continue;

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

      const config: PlaylistConfiguration = {
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
      };

      configs.push({ config, rowIndex: iRow });
    }

    return configs;
  }

  /**
   * Update the last timestamp for a given row.
   * TODO: Do we need to passing timestamp?
   */
  updateLastTimestamp(rowIndex: number, timestamp: Date): void {
    this.sheet
      .getRange(rowIndex + 1, reservedColumnTimestamp + 1)
      .setValue(timestamp.toISOString());
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
