import ErrorTracker from '../ErrorTracker';
import { Video, VideoSource } from '../models';
import { DEBUG_FLAG_LOG_WHEN_NO_NEW_VIDEOS_FOUND } from './constants';
import dateToIsoString from './dateUtils';
import type { VideoFetchService } from './VideoFetchService';

/**
 * Service that fetches videos from a playlist.
 */
export default class PlaylistVideoService implements VideoFetchService {
  getVideos(
    source: VideoSource,
    lastTimestamp: Date,
    errorTracker: ErrorTracker
  ): Video[] {
    if (source.type !== 'playlist') {
      throw new Error(`PlaylistVideoService can only handle playlist sources`);
    }

    const playlistId = source.playlistId;

    const videoIds = this.fetchPlaylistVideoIds(
      playlistId,
      lastTimestamp,
      errorTracker
    );

    if (videoIds.length === 0) {
      this.ensurePlaylistExists(playlistId, errorTracker);
      if (DEBUG_FLAG_LOG_WHEN_NO_NEW_VIDEOS_FOUND) {
        Logger.log(`Playlist with id ${playlistId} has no new videos`);
      }
    }

    return videoIds.map((id) => ({ id, origin: 'playlist' }));
  }

  /**
   * Fetches video IDs from a playlist using pagination.
   * Collects all videos published after the given timestamp.
   */
  private fetchPlaylistVideoIds(
    playlistId: string,
    lastTimestamp: Date,
    errorTracker: ErrorTracker
  ): string[] {
    const videoIds: string[] = [];
    let nextPageToken: string | undefined = '';

    while (nextPageToken != null) {
      try {
        const results: GoogleAppsScript.YouTube.Schema.PlaylistItemListResponse =
          YouTube.PlaylistItems!.list('snippet', {
            playlistId,
            maxResults: 50,
            order: 'date',
            publishedAfter: dateToIsoString(lastTimestamp),
            pageToken: nextPageToken,
          });
        if (!results || !results.items) {
          errorTracker.addError(
            `YouTube playlist search returned invalid response for playlist with id ${playlistId}`
          );
          return [];
        }
        for (let j = 0; j < results.items.length; j += 1) {
          const item: GoogleAppsScript.YouTube.Schema.PlaylistItem =
            results.items[j];
          if (item.snippet && item.snippet.publishedAt) {
            const publishedAt = new Date(item.snippet.publishedAt);
            if (publishedAt > lastTimestamp) {
              if (item.snippet.resourceId?.videoId) {
                videoIds.push(item.snippet.resourceId.videoId);
              }
            }
          }
        }
        nextPageToken = results.nextPageToken;
      } catch (e: any) {
        Logger.log(
          `Cannot search YouTube with playlist id ${playlistId}, ERROR: Message: [${
            e.message
          }] Details: ${JSON.stringify(e.details)}`
        );
        break;
      }
    }

    return videoIds;
  }

  /**
   * Validates that a playlist exists on YouTube.
   * Called when no new videos are found to provide better error messaging.
   */
  private ensurePlaylistExists(
    playlistId: string,
    errorTracker: ErrorTracker
  ): void {
    try {
      const results: GoogleAppsScript.YouTube.Schema.PlaylistListResponse =
        YouTube.Playlists!.list('id', {
          id: playlistId,
        });
      if (!results || !results.items) {
        errorTracker.addError(
          `YouTube channel search returned invalid response for playlist with id ${playlistId}`
        );
        return;
      }
      if (results.items.length === 0) {
        errorTracker.addError(`Cannot find playlist with id ${playlistId}`);
      }
    } catch (e: any) {
      errorTracker.addError(
        `Cannot lookup playlist with id ${playlistId} on YouTube, ERROR: Message: [${
          e.message
        }] Details: ${JSON.stringify(e.details)}`
      );
    }
  }
}
