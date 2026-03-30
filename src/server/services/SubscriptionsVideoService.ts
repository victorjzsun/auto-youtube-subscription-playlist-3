import ErrorTracker from '../ErrorTracker';
import { Video, VideoSource } from '../models';
import ChannelVideoService from './ChannelVideoService';
import type { VideoFetchService } from './VideoFetchService';
import { DEBUG_FLAG_LOG_WHEN_NO_NEW_VIDEOS_FOUND } from './constants';

/**
 * Service that fetches new videos for all subscriptions by pulling a list of
 * channels and delegates fetching videos for each channel to the underlying
 * ChannelVideoService.
 */
export default class SubscriptionsVideoService implements VideoFetchService {
  private readonly channelVideoService: ChannelVideoService;

  constructor(channelVideoService: ChannelVideoService) {
    this.channelVideoService = channelVideoService;
  }

  getVideos(
    source: VideoSource,
    lastTimestamp: Date,
    errorTracker: ErrorTracker
  ): Video[] {
    if (source.type !== 'subscriptions') {
      throw new Error(
        `SubscriptionsVideoService can only handle sources of type "subscriptions"`
      );
    }

    const channelIds: string[] = this.getAllChannelIds(errorTracker);
    if (!channelIds || channelIds.length === 0) {
      errorTracker.addError('Could not find any subscriptions');
      return [];
    }

    const videos: Video[] = [];
    for (let i = 0; i < channelIds.length; i += 1) {
      const channelVideos = this.channelVideoService.getVideos(
        { type: 'channel', channelId: channelIds[i] },
        lastTimestamp,
        errorTracker
      );
      if (
        channelVideos.length === 0 &&
        DEBUG_FLAG_LOG_WHEN_NO_NEW_VIDEOS_FOUND
      ) {
        Logger.log(`Channel with id ${channelIds[i]} has no new videos`);
      }
      videos.push(...channelVideos);
    }

    return videos;
  }

  private getAllChannelIds(errorTracker: ErrorTracker): string[] {
    let result: GoogleAppsScript.YouTube.Schema.SubscriptionListResponse;
    const AboList: [string[], string[]] = [[], []];
    let pageToken: string | undefined = '';
    try {
      do {
        result = YouTube.Subscriptions!.list('snippet', {
          mine: true,
          maxResults: 50,
          order: 'alphabetical',
          pageToken,
          fields: 'items(snippet(title,resourceId(channelId)))',
        });
        if (!result || !result.items) {
          errorTracker.addError(
            `YouTube subscription search returned invalid response`
          );
          break;
        }
        for (let i = 0, ix = result.items.length; i < ix; i += 1) {
          const item = result.items[i];
          if (item.snippet?.title && item.snippet.resourceId?.channelId) {
            AboList[0].push(item.snippet.title);
            AboList[1].push(item.snippet.resourceId.channelId);
          }
        }
        pageToken = result.nextPageToken;
      } while (pageToken);
      if (AboList[0].length !== AboList[1].length) {
        errorTracker.addError(
          `While getting subscriptions, the number of titles (${AboList[0].length}) did not match the number of channels (${AboList[1].length}).`
        );
        return [];
      }
    } catch (e: any) {
      errorTracker.addError(
        `Could not get subscribed channels, ERROR: Message: [${
          e.message
        }] Details: ${JSON.stringify(e.details)}`
      );
      return [];
    }

    Logger.log(`Acquired subscriptions ${AboList[1].length}`);
    return AboList[1];
  }
}
