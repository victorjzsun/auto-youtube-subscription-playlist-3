import React, { useState, useEffect } from 'react';
import PlaylistList from './PlaylistList';
import type { PlaylistConfiguration } from '../types';
import { serverFunctions } from '../../utils/serverFunctions';
import { parsePlaylistId } from '../utils';

const PlaylistManager: React.FC = () => {
  const [playlists, setPlaylists] = useState<PlaylistConfiguration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingAll, setUpdatingAll] = useState<boolean>(false);

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

  const handleUpdateAll = async () => {
    setLoading(true);
    setUpdatingAll(true);
    setError(null);

    try {
      await serverFunctions.updatePlaylists();
      loadPlaylists();
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : 'Failed to update playlists'
      );
      setLoading(false);
    } finally {
      setUpdatingAll(false);
    }
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
        <button
          className="btn btn-primary"
          onClick={handleUpdateAll}
          disabled={loading}
        >
          {updatingAll ? (
            <span className="btn-spinner" aria-hidden="true" />
          ) : (
            <svg
              className="btn-icon"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <span className="btn-text">Update All Playlists</span>
        </button>
        <button className="btn btn-secondary" onClick={handleAddPlaylist}>
          <svg
            className="btn-icon"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className="btn-text">New Playlist</span>
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
