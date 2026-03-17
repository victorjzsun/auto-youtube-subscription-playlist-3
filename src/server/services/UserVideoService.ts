import ErrorTracker from '../ErrorTracker';
import { Video, VideoSource } from '../models';
import ChannelVideoService from './ChannelVideoService';
import type { VideoFetchService } from './VideoFetchService';

/**
 * Service that fetches new videos for a channel username by looking up the username and delegating
 * video fetching to the ChannelVideoService.
 */
export default class UserVideoService implements VideoFetchService {
  private readonly channelVideoService: ChannelVideoService;

  constructor(channelVideoService: ChannelVideoService) {
    this.channelVideoService = channelVideoService;
  }

  getVideos(
    source: VideoSource,
    lastTimestamp: Date,
    errorTracker: ErrorTracker
  ): Video[] {
    if (source.type !== 'username') {
      throw new Error(
        `UserVideoService can only handle sources of type "username"`
      );
    }

    // TODO extract this to a separate method
    try {
      const user: GoogleAppsScript.YouTube.Schema.ChannelListResponse =
        YouTube.Channels!.list('id', {
          forUsername: source.username,
          maxResults: 1,
        });
      if (!user || !user.items) {
        errorTracker.addError(`Cannot query for user ${source.username}`);
        return [];
      }
      if (user.items.length === 0) {
        errorTracker.addError(`No user with name ${source.username}`);
        return [];
      }
      if (user.items.length !== 1) {
        errorTracker.addError(`Multiple users with name ${source.username}`);
        return [];
      }
      if (!user.items[0].id) {
        errorTracker.addError(`Cannot get id from user ${source.username}`);
        return [];
      }

      return this.channelVideoService.getVideos(
        { type: 'channel', channelId: user.items[0].id },
        lastTimestamp,
        errorTracker
      );
    } catch (e: any) {
      errorTracker.addError(
        `Cannot search for channel with name ${
          source.username
        }, ERROR: Message: [${e.message}] Details: ${JSON.stringify(e.details)}`
      );
      return [];
    }
  }
}
