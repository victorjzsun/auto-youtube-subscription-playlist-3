export function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu('My Sample React Project') // edit me!
    .addItem('Sheet Editor (MUI)', 'openDialogMUI')
    .addItem('About me', 'openAboutSidebar')
    .addItem('Update Playlists', 'updatePlaylists')
    .addItem('Get Channel ID', 'getChannelId')
    .addToUi();

  const ss: GoogleAppsScript.Spreadsheet.Spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();
  const sheet: GoogleAppsScript.Spreadsheet.Sheet = ss.getSheets()[0];
  if (!sheet || sheet.getRange('A3').getValue() !== 'Playlist ID') {
    const additional: string = sheet
      ? `, instead found sheet with name ${sheet.getName()}`
      : '';
    throw new Error(
      `Cannot find playlist sheet, make sure the sheet with playlist IDs and channels is the first sheet (leftmost)${additional}`
    );
  }
  PropertiesService.getScriptProperties().setProperty('sheetID', ss.getId());
}

export const openDialogMUI = () => {
  const html = HtmlService.createHtmlOutputFromFile('dialog-demo-mui')
    .setWidth(600)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Sheet Editor (MUI)');
};

export const openAboutSidebar = () => {
  const html = HtmlService.createHtmlOutputFromFile('sidebar-about-page');
  SpreadsheetApp.getUi().showSidebar(html);
};

export const makeid = () => {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < 32; i += 1) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};
