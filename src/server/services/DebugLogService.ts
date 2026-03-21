import { reservedDebugNumColumns, reservedDebugNumRows } from './constants';

/**
 * Manages writing logs into the DebugData and Debug sheets.
 * TODO: make more efficient and abstract away spreadsheet functions
 */
export default class DebugLogService {
  private debugSheet: GoogleAppsScript.Spreadsheet.Sheet | null = null;

  private debugViewerSheet: GoogleAppsScript.Spreadsheet.Sheet | null = null;

  private nextDebugCol: number = 0;

  private nextDebugRow: number = 0;

  /**
   * Initialize the debug service by retrieving/creating debug sheets from a spreadsheet
   * @param spreadsheet - The spreadsheet to retrieve/create debug sheets from
   * @returns Whether the Debug viewer sheet exists
   */
  initializeWithSpreadsheet(
    spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet
  ): boolean {
    // Get or create the DebugData sheet
    let debugSheet: GoogleAppsScript.Spreadsheet.Sheet | null =
      spreadsheet.getSheetByName('DebugData');
    if (!debugSheet) {
      debugSheet = spreadsheet.insertSheet('DebugData').hideSheet();
    }

    // Get the Debug viewer sheet (optional)
    this.debugViewerSheet = spreadsheet.getSheetByName('Debug');

    this.initialize(debugSheet, this.debugViewerSheet);
    return this.debugViewerSheet !== null;
  }

  /**
   * Initialize the debug service with the DebugData sheet and optional Debug viewer sheet
   * @param sheet - The DebugData sheet
   * @param debugViewerSheet - Optional Debug viewer sheet for displaying logs
   */
  initialize(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    debugViewerSheet?: GoogleAppsScript.Spreadsheet.Sheet | null
  ): void {
    this.debugSheet = sheet;
    this.debugViewerSheet = debugViewerSheet || null;
    this.nextDebugCol = this.getNextDebugCol(sheet);
    this.nextDebugRow = this.getNextDebugRow(sheet, this.nextDebugCol);

    if (this.debugViewerSheet) {
      this.initDebugEntry(
        this.debugViewerSheet,
        this.nextDebugCol,
        this.nextDebugRow
      );
    }
  }

  /**
   * Append logs to the DebugData sheet
   * @param logs - Array of log arrays to append
   */
  appendLogs(logs: string[][]): void {
    if (!this.debugSheet) {
      throw new Error('DebugLogService not initialized');
    }
    if (logs.length > 0) {
      this.debugSheet
        .getRange(this.nextDebugRow + 1, this.nextDebugCol + 1, logs.length, 2)
        .setValues(logs);
      this.nextDebugRow += logs.length;
    }
  }

  /**
   * Set the completion message in the DebugData sheet
   * @param errorCount - Total error count from the execution
   */
  setCompletionMessage(errorCount: number): void {
    if (!this.debugSheet) {
      throw new Error('DebugLogService not initialized');
    }
    const message =
      errorCount === 0
        ? 'Updated all rows, script successfully finished'
        : 'Script did not successfully finish';

    this.debugSheet
      .getRange(this.nextDebugRow + 1, this.nextDebugCol + 2)
      .setValue(message);
    this.nextDebugRow += 1;
  }

  /**
   * Check if debug column needs to be cycled and perform cleanup if necessary
   */
  cycleDebugColIfNeeded(): void {
    if (!this.debugSheet) {
      throw new Error('DebugLogService not initialized');
    }
    if (this.nextDebugRow > reservedDebugNumRows - 1) {
      let colIndex: number = 0;
      if (this.nextDebugCol < reservedDebugNumColumns - 2) {
        colIndex = this.nextDebugCol + 2;
      }
      this.clearDebugCol(this.debugSheet, colIndex);
    }
  }

  /**
   * Get the next available debug column
   * @param debugSheet - The DebugData sheet
   * @returns The next debug column index
   */
  private getNextDebugCol(
    debugSheet: GoogleAppsScript.Spreadsheet.Sheet
  ): number {
    const data: string[][] = debugSheet.getDataRange().getValues();
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
    this.clearDebugCol(debugSheet, 0);
    return 0;
  }

  /**
   * Get the next available debug row for the given column
   * @param debugSheet - The DebugData sheet
   * @param nextDebugCol - The debug column index
   * @returns The next debug row index
   */
  private getNextDebugRow(
    debugSheet: GoogleAppsScript.Spreadsheet.Sheet,
    nextDebugCol: number
  ): number {
    const data: string[][] = debugSheet.getDataRange().getValues();
    // Empty sheet, return first row
    if (data.length === 1 && data[0].length === 1 && data[0][0] === '')
      return 0;
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

  clearDebugCol(
    debugSheet: GoogleAppsScript.Spreadsheet.Sheet,
    colIndex: number
  ): void {
    // Clear first reservedDebugNumRows rows
    debugSheet.getRange(1, colIndex + 1, reservedDebugNumRows, 2).clear();
    // Clear as many additional rows as necessary
    let rowIndex: number = reservedDebugNumRows;
    while (
      debugSheet
        .getRange(rowIndex + 1, colIndex + 1, 1, 2)
        .getValues()[0][1] !== ''
    ) {
      debugSheet.getRange(rowIndex + 1, colIndex + 1, 1, 2).clear();
      rowIndex += 1;
    }
  }

  /**
   * Initialize a new debug entry in the Debug viewer sheet
   * @param debugViewer - The Debug viewer sheet
   * @param nextDebugCol - The debug column index
   * @param nextDebugRow - The debug row index
   */
  private initDebugEntry(
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

  loadLastDebugLog(): void {
    if (!this.debugViewerSheet) {
      return;
    }
    this.debugViewerSheet
      .getRange('B3')
      .setValue(this.debugViewerSheet.getRange('A3').getValue());
  }
}
