const PLAYLIST_ID_STORAGE_KEY = 'playlist-manager-playlist-ids';

export const parsePlaylistId = (input) => {
  const trimmedInput = input.trim();
  if (!trimmedInput) return null;

  try {
    const url = new URL(trimmedInput);
    const playlistId = url.searchParams.get('list');
    if (playlistId) return playlistId;
  } catch {
    // Not a URL, continue to fallback parsing
  }

  const queryMatch = trimmedInput.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];

  return trimmedInput;
};

export const buildYouTubePlaylistUrl = (playlistId) =>
  `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
