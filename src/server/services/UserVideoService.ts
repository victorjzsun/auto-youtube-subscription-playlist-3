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

    const channelId = this.resolveChannelIdFromUsername(
      source.username,
      errorTracker
    );

    if (!channelId) {
      return [];
    }

    return this.channelVideoService.getVideos(
      { type: 'channel', channelId },
      lastTimestamp,
      errorTracker
    );
  }

  /**
   * Resolves a username to a YouTube channel ID.
   * @param username The YouTube username to resolve.
   * @param errorTracker Error tracker for logging failures.
   * @returns The channel ID if found, null otherwise.
   */
  private resolveChannelIdFromUsername(
    username: string,
    errorTracker: ErrorTracker
  ): string | null {
    try {
      const user: GoogleAppsScript.YouTube.Schema.ChannelListResponse =
        YouTube.Channels!.list('id', {
          forUsername: username,
          maxResults: 1,
        });
      if (!user || !user.items) {
        errorTracker.addError(`Cannot query for user ${username}`);
        return null;
      }
      if (user.items.length === 0) {
        errorTracker.addError(`No user with name ${username}`);
        return null;
      }
      if (user.items.length !== 1) {
        errorTracker.addError(`Multiple users with name ${username}`);
        return null;
      }
      if (!user.items[0].id) {
        errorTracker.addError(`Cannot get id from user ${username}`);
        return null;
      }

      return user.items[0].id;
    } catch (e: any) {
      errorTracker.addError(
        `Cannot search for channel with name ${username}, ERROR: Message: [${
          e.message
        }] Details: ${JSON.stringify(e.details)}`
      );
      return null;
    }
  }
}
