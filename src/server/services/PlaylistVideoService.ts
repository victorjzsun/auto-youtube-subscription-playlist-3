import ErrorTracker from '../ErrorTracker';
import { Video, VideoSource } from '../models';
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

    // TODO break into smaller methods
    const videoIds: string[] = [];
    let nextPageToken: string | undefined = '';
    while (nextPageToken != null) {
      try {
        const results: GoogleAppsScript.YouTube.Schema.PlaylistItemListResponse =
          YouTube.PlaylistItems!.list('snippet', {
            playlistId: source.playlistId,
            maxResults: 50,
            order: 'date',
            publishedAfter: dateToIsoString(lastTimestamp),
            pageToken: nextPageToken,
          });
        if (!results || !results.items) {
          errorTracker.addError(
            `YouTube playlist search returned invalid response for playlist with id ${source.playlistId}`
          );
          return [];
        }
        for (let j = 0; j < results.items.length; j += 1) {
          const item: GoogleAppsScript.YouTube.Schema.PlaylistItem =
            results.items[j];
          if (new Date(item.snippet!.publishedAt!) > lastTimestamp) {
            videoIds.push(item.snippet!.resourceId!.videoId!);
          }
        }
        nextPageToken = results.nextPageToken;
      } catch (e: any) {
        Logger.log(
          `Cannot search YouTube with playlist id ${
            source.playlistId
          }, ERROR: Message: [${e.message}] Details: ${JSON.stringify(
            e.details
          )}`
        );
        break;
      }
    }

    if (videoIds.length === 0) {
      try {
        const results: GoogleAppsScript.YouTube.Schema.PlaylistListResponse =
          YouTube.Playlists!.list('id', {
            id: source.playlistId,
          });
        if (!results || !results.items) {
          errorTracker.addError(
            `YouTube channel search returned invalid response for playlist with id ${source.playlistId}`
          );
          return [];
        }
        if (results.items.length === 0) {
          errorTracker.addError(
            `Cannot find playlist with id ${source.playlistId}`
          );
          return [];
        }
      } catch (e: any) {
        errorTracker.addError(
          `Cannot lookup playlist with id ${
            source.playlistId
          } on YouTube, ERROR: Message: [${
            e.message
          }] Details: ${JSON.stringify(e.details)}`
        );
        return [];
      }
    }

    return videoIds.map((id) => ({ id, origin: 'playlist' }));
  }
}
