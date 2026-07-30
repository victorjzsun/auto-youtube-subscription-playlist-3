import React from 'react';
import type { PlaylistConfiguration, VideoSource } from '../types';
import { serverFunctions } from '../../utils/serverFunctions';
import { buildYouTubePlaylistUrl } from '../utils';

interface PlaylistCardProps {
  playlistConfig: PlaylistConfiguration;
  onRename: (playlistId: string, name: string) => void;
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlistConfig,
  onRename,
}) => {
  const getSourceTag = (sourceType: string) => {
    const typeClasses: { [key: string]: string } = {
      channel: 'channel',
      username: 'username',
      subscriptions: 'subscription',
      playlist: 'playlist',
    };
    return typeClasses[sourceType] || 'channel';
  };

  const getSourceLabel = (source: VideoSource) => {
    switch (source.type) {
      case 'channel':
        return source.channelId;
      case 'username':
        return source.username;
      case 'subscriptions':
        return 'All Subscriptions';
      case 'playlist':
        return source.playlistId;
      default:
        return 'Unknown';
    }
  };

  const getLastUpdated = () => {
    if (!playlistConfig.lastTimestamp) return 'Never';
    const date =
      playlistConfig.lastTimestamp instanceof Date
        ? playlistConfig.lastTimestamp
        : new Date(playlistConfig.lastTimestamp);
    return date.toLocaleDateString();
  };

  const handleConfigure = async () => {
    const nextName = window.prompt(
      'Enter a display name for this playlist',
      playlistConfig.name && playlistConfig.name !== 'Playlist' ? playlistConfig.name : ''
    );

    if (nextName === null) return;

    const trimmedName = nextName.trim();
    try {
      await serverFunctions.savePlaylistConfiguration({
        id: playlistConfig.id,
        playlistId: playlistConfig.playlistId,
        name: trimmedName,
        frequencyHours: playlistConfig.frequencyHours,
        deleteDays: playlistConfig.deleteDays,
        lastTimestamp:
          playlistConfig.lastTimestamp instanceof Date
            ? playlistConfig.lastTimestamp.toISOString()
            : playlistConfig.lastTimestamp ?? null,
        sources: playlistConfig.sources,
        filters: playlistConfig.filters,
      });
      onRename(playlistConfig.id, trimmedName);
    } catch (error: unknown) {
      window.alert(
        error instanceof Error ? error.message : 'Failed to update playlist'
      );
    }
  };

  const handleViewOnYouTube = () => {
    window.open(
      buildYouTubePlaylistUrl(playlistConfig.playlistId),
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleUpdateNow = async () => {
    try {
      await serverFunctions.updatePlaylistNow(playlistConfig.id);
      window.alert('Playlist update started.');
    } catch (error: unknown) {
      window.alert(
        error instanceof Error ? error.message : 'Failed to update playlist'
      );
    }
  };

  return (
    <div className="playlist-card">
      <div className="playlist-header">
        <div>
          <div className="playlist-title">{playlistConfig.name}</div>
          <span className="playlist-id">{playlistConfig.playlistId}</span>
        </div>
        <div className="playlist-status">
          <div className="status-indicator"></div>
          Active
        </div>
      </div>

      <div className="playlist-info">
        <div className="info-item">
          <span className="info-label">Last Updated</span>
          <span className="info-value">{getLastUpdated()}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Update Frequency</span>
          <span className="info-value">
            {playlistConfig.frequencyHours
              ? `Every ${playlistConfig.frequencyHours} hours`
              : 'Manual'}
          </span>
        </div>
        <div className="info-item">
          <span className="info-label">Auto-Delete After</span>
          <span className="info-value">
            {playlistConfig.deleteDays ? `${playlistConfig.deleteDays} days` : 'Never'}
          </span>
        </div>
      </div>

      {playlistConfig.sources && playlistConfig.sources.length > 0 && (
        <div className="sources-list">
          <div className="sources-label">Video Sources</div>
          <div className="source-tags">
            {playlistConfig.sources.map((source: VideoSource, index: number) => (
              <span
                key={index}
                className={`source-tag ${getSourceTag(source.type)}`}
              >
                {getSourceLabel(source)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="playlist-actions">
        <button className="btn btn-primary" onClick={handleConfigure}>
          Configure
        </button>
        <button className="btn btn-secondary" onClick={handleViewOnYouTube}>
          View on YouTube
        </button>
        <button className="btn btn-secondary" onClick={handleUpdateNow}>
          Update Now
        </button>
      </div>
    </div>
  );
};

export default PlaylistCard;
