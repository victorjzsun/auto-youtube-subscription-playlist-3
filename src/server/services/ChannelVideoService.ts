import ErrorTracker from '../ErrorTracker';
import { Video, VideoSource } from '../models';
import { DEBUG_FLAG_LOG_WHEN_NO_NEW_VIDEOS_FOUND } from './constants';
import dateToIsoString from './dateUtils';
import type { VideoFetchService } from './VideoFetchService';

/**
 * Core service for fetching new videos from a channel.
 * This is the central implementation used by decorators (Subscriptions/User) as well.
 */
export default class ChannelVideoService implements VideoFetchService {
  getVideos(
    source: VideoSource,
    lastTimestamp: Date,
    errorTracker: ErrorTracker
  ): Video[] {
    if (source.type !== 'channel') {
      throw new Error(
        `ChannelVideoService can only handle sources of type "channel"`
      );
    }
    const videoIds = this.getVideoIdsWithLessQueries(
      source.channelId,
      lastTimestamp,
      errorTracker
    );

    if (videoIds.length === 0 && DEBUG_FLAG_LOG_WHEN_NO_NEW_VIDEOS_FOUND) {
      Logger.log(`Channel with id ${source.channelId} has no new videos`);
    }
    return videoIds.map((id) => ({ id, origin: 'channel' }));
  }

  /**
   * Get videos from Channels but with less Quota use
   * Slower and date ordering is a bit messy but less quota costs
   */
  private getVideoIdsWithLessQueries(
    channelId: string,
    lastTimestamp: Date,
    errorTracker: ErrorTracker
  ): string[] {
    const videoIds: string[] = [];
    let uploadsPlaylistId: string;
    try {
      // Check Channel validity
      const results: GoogleAppsScript.YouTube.Schema.ChannelListResponse =
        YouTube.Channels!.list('contentDetails', {
          id: channelId,
        });
      if (!results) {
        errorTracker.addError(
          `YouTube channel search returned invalid response for channel with id ${channelId}`
        );
        return [];
      }
      if (!results.items || results.items.length === 0) {
        errorTracker.addError(`Cannot find channel with id ${channelId}`);
        return [];
      }
      uploadsPlaylistId =
        results.items[0].contentDetails!.relatedPlaylists!.uploads!;
    } catch (e: any) {
      errorTracker.addError(
        `Cannot search YouTube for channel with id ${channelId}, ERROR: Message: [${
          e.message
        }] Details: ${JSON.stringify(e.details)}`
      );
      return [];
    }

    let nextPageToken: string | undefined = '';
    do {
      try {
        const results: GoogleAppsScript.YouTube.Schema.PlaylistItemListResponse =
          YouTube.PlaylistItems!.list('contentDetails', {
            playlistId: uploadsPlaylistId,
            maxResults: 50,
            pageToken: nextPageToken,
          });
        const videosToBeAdded: GoogleAppsScript.YouTube.Schema.PlaylistItem[] =
          results.items!.filter(
            (vid: GoogleAppsScript.YouTube.Schema.PlaylistItem) =>
              lastTimestamp <= new Date(vid.contentDetails!.videoPublishedAt!)
          );
        if (videosToBeAdded.length === 0) {
          break;
        }
        videoIds.push(
          ...videosToBeAdded.map(
            (vid: GoogleAppsScript.YouTube.Schema.PlaylistItem) =>
              vid.contentDetails!.videoId!
          )
        );
        nextPageToken = results.nextPageToken;
      } catch (e: any) {
        if (e.details.code !== 404) {
          // Skip error count if Playlist isn't found, then channel is empty
          errorTracker.addError(
            `Cannot search YouTube with playlist id ${uploadsPlaylistId}, ERROR: Message: [${
              e.message
            }] Details: ${JSON.stringify(e.details)}`
          );
        } else {
          Logger.log(
            `Warning: Channel ${channelId} does not have any uploads in ${uploadsPlaylistId}, ignore if this" +
              " is intentional as this will not fail the script. API error details for troubleshooting: Details: ${JSON.stringify(
                e.details
              )}`
          );
        }
        return [];
      }
    } while (nextPageToken != null);

    return videoIds.reverse(); // Reverse to get videos in ascending order by date
  }

  /**
   * Get new videos from Channels using YouTube Search API
   * @param channelId - The YouTube channel ID
   * @param lastTimestamp - ISO timestamp to fetch videos published after
   * @param errorTracker - ErrorTracker instance for logging errors
   * @returns Array of video IDs
   */
  // @ts-expect-error Unused due to quota issues, can be used if higher quota is available
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getVideoIds(
    channelId: string,
    lastTimestamp: Date,
    errorTracker: ErrorTracker
  ): string[] {
    const videoIds: string[] = [];
    let nextPageToken: string | undefined = '';
    do {
      try {
        const results: GoogleAppsScript.YouTube.Schema.SearchListResponse =
          YouTube.Search!.list('id', {
            channelId,
            maxResults: 50,
            order: 'date',
            publishedAfter: dateToIsoString(lastTimestamp),
            pageToken: nextPageToken,
            type: 'video',
          });
        if (!results || !results.items) {
          errorTracker.addError(
            `YouTube video search returned invalid response for channel with id ${channelId}`
          );
          return [];
        }
        for (let j = 0; j < results.items.length; j += 1) {
          const item: GoogleAppsScript.YouTube.Schema.SearchResult =
            results.items[j];
          if (!item.id) {
            Logger.log(`YouTube search result (${item}) doesn't have id`);
            continue;
          } else if (!item.id.videoId) {
            Logger.log(`YouTube search result (${item}) doesn't have videoId`);
            continue;
          }
          videoIds.push(item.id.videoId);
        }
        nextPageToken = results.nextPageToken;
      } catch (e: any) {
        Logger.log(
          `Cannot search YouTube with channel id ${channelId}, ERROR: Message: [${
            e.message
          }] Details: ${JSON.stringify(e.details)}`
        );
        break;
      }
    } while (nextPageToken != null);

    if (videoIds.length === 0) {
      try {
        // Check Channel validity
        const results: GoogleAppsScript.YouTube.Schema.ChannelListResponse =
          YouTube.Channels!.list('id', {
            id: channelId,
          });
        if (!results) {
          errorTracker.addError(
            `YouTube channel search returned invalid response for channel with id ${channelId}`
          );
          return [];
        }
        if (!results.items || results.items.length === 0) {
          errorTracker.addError(`Cannot find channel with id ${channelId}`);
          return [];
        }
      } catch (e: any) {
        errorTracker.addError(
          `Cannot search YouTube for channel with id ${channelId}, ERROR: Message: [${
            e.message
          }] Details: ${JSON.stringify(e.details)}`
        );
        return [];
      }
    }

    return videoIds;
  }
}
