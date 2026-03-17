import { reservedDebugNumColumns, reservedDebugNumRows } from './constants';

/**
 * Manages writing logs into the DebugData and Debug sheets.
 * TODO: make more efficient and abstract away spreadsheet functions
 */
export default class DebugLogService {
  getNextDebugCol(debugSheet: GoogleAppsScript.Spreadsheet.Sheet): number {
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

  getNextDebugRow(
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

  initDebugEntry(
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

  loadLastDebugLog(debugViewer: GoogleAppsScript.Spreadsheet.Sheet): void {
    debugViewer.getRange('B3').setValue(debugViewer.getRange('A3').getValue());
  }
}
