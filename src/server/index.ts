import {
  onOpen,
  openDialogMUI,
  openAboutSidebar,
  openPlaylistManager,
} from './ui';

import { getSheetsData, addSheet, deleteSheet, setActiveSheet } from './sheets';

import {
  updatePlaylists,
  getLogs,
  doGet,
  playlist,
  getChannelId,
  getPlaylists,
  savePlaylistConfiguration,
  updatePlaylistNow,
} from './sheetScript';

// Public functions must be exported as named exports
export {
  onOpen,
  openDialogMUI,
  openAboutSidebar,
  openPlaylistManager,
  getSheetsData,
  addSheet,
  deleteSheet,
  setActiveSheet,
  updatePlaylists,
  getLogs,
  doGet,
  playlist,
  getChannelId,
  getPlaylists,
  savePlaylistConfiguration,
  updatePlaylistNow,
};
