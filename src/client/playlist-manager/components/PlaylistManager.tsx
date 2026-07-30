import React, { useState, useEffect } from 'react';
import PlaylistList from './PlaylistList';
import { PlaylistConfiguration } from '../types';
import { serverFunctions } from '../../utils/serverFunctions';
import { parsePlaylistId } from '../utils';

const PlaylistManager: React.FC = () => {
  const [playlists, setPlaylists] = useState<PlaylistConfiguration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlaylists = () => {
    setLoading(true);
    setError(null);

    serverFunctions
      .getPlaylists()
      .then((result: PlaylistConfiguration[]) => {
        // Convert date strings back to Date objects
        const parsedPlaylists: PlaylistConfiguration[] = result.map((p) => ({
          ...p,
          lastTimestamp: new Date(p.lastTimestamp as string),
        }));

        setPlaylists(parsedPlaylists);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err?.message || 'Failed to load playlists');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPlaylists();
  }, []);

  const handleAddPlaylist = async () => {
    const playlistInput = window.prompt(
      'Enter YouTube playlist ID or playlist URL:'
    );
    if (!playlistInput) return;

    const playlistId = parsePlaylistId(playlistInput);
    if (!playlistId) {
      window.alert('Please enter a valid playlist ID or URL.');
      return;
    }

    const friendlyName = window.prompt(
      'Optional playlist display name (leave blank to use playlist ID)',
      ''
    );

    setLoading(true);
    setError(null);

    try {
      await serverFunctions.savePlaylistConfiguration({
        id: null,
        playlistId,
        name: friendlyName?.trim() || undefined,
      });
      loadPlaylists();
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : 'Failed to add playlist'
      );
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadPlaylists();
  };

  const handleRenamePlaylist = (playlistId: string, name: string) => {
    setPlaylists((current) =>
      current.map((playlist) =>
        playlist.id === playlistId ? { ...playlist, name } : playlist
      )
    );
  };

  return (
    <div className="container">
      <header>
        <h1>
          Playlist Manager
          <span className="phase-badge">Phase 1</span>
        </h1>
        <p className="header-subtitle">
          Manage your YouTube playlists and configure automatic video collection
        </p>
      </header>

      <div className="action-bar">
        <button className="btn btn-primary" onClick={handleAddPlaylist}>
          + Add Playlist
        </button>
        <button className="btn btn-secondary" onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      <PlaylistList
        playlists={playlists}
        loading={loading}
        error={error}
        onRename={handleRenamePlaylist}
      />
    </div>
  );
};

export default PlaylistManager;
