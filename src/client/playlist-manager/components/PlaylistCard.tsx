import React from 'react';
import type { PlaylistConfiguration, VideoSource } from '../types';
import { serverFunctions } from '../../utils/serverFunctions';
import { buildYouTubePlaylistUrl } from '../utils';

interface PlaylistCardProps {
  playlistConfig: PlaylistConfiguration;
  onRename: (configId: string, name: string) => void;
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
      playlistConfig.name && playlistConfig.name !== 'Playlist'
        ? playlistConfig.name
        : ''
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

  const handleViewPlaylist = () => {
    window.open(
      buildYouTubePlaylistUrl(playlistConfig.playlistId),
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleUpdateNow = async () => {
    try {
      await serverFunctions.updatePlaylistNow(playlistConfig.id);
      window.alert('Playlist update finished.');
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
            {playlistConfig.deleteDays
              ? `${playlistConfig.deleteDays} days`
              : 'Never'}
          </span>
        </div>
      </div>

      {playlistConfig.sources && playlistConfig.sources.length > 0 && (
        <div className="sources-list">
          <div className="sources-label">Video Sources</div>
          <div className="source-tags">
            {playlistConfig.sources.map(
              (source: VideoSource, index: number) => (
                <span
                  key={index}
                  className={`source-tag ${getSourceTag(source.type)}`}
                >
                  {getSourceLabel(source)}
                </span>
              )
            )}
          </div>
        </div>
      )}

      <div className="playlist-actions">
        <button className="btn btn-primary btn-sm" onClick={handleUpdateNow}>
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
          <span className="btn-text">Update Now</span>
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleViewPlaylist}
        >
          <svg
            className="btn-icon"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path
              fillRule="evenodd"
              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="btn-text">View Playlist</span>
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleConfigure}>
          <svg
            className="btn-icon"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
          <span className="btn-text">Configure</span>
        </button>
      </div>
    </div>
  );
};

export default PlaylistCard;
