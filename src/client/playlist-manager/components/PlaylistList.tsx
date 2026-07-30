import React from 'react';
import PlaylistCard from './PlaylistCard';
import EmptyState from './EmptyState';
import type { PlaylistConfiguration } from '../types';

interface PlaylistListProps {
  playlists: PlaylistConfiguration[];
  loading: boolean;
  error: string | null;
  onRename: (playlistId: string, name: string) => void;
}

const PlaylistList: React.FC<PlaylistListProps> = ({
  playlists,
  loading,
  error,
  onRename,
}) => {
  if (error) {
    return (
      <div className="error-banner">
        <strong>Error loading playlists</strong>
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (playlists.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="playlists-grid">
      {playlists.map((playlist) => (
        <PlaylistCard
          key={playlist.id}
          playlistConfig={playlist}
          onRename={onRename}
        />
      ))}
    </div>
  );
};

export default PlaylistList;
