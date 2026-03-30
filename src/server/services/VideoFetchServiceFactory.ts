import ErrorTracker from '../ErrorTracker';
import { VideoSource } from '../models';
import ChannelVideoService from './ChannelVideoService';
import SubscriptionsVideoService from './SubscriptionsVideoService';
import UserVideoService from './UserVideoService';
import PlaylistVideoService from './PlaylistVideoService';
import type { VideoFetchService } from './VideoFetchService';

/**
 * Factory for creating and retrieving video fetch services based on source type.
 * Centralizes the routing logic for different video source types and owns the
 * underlying video fetch services.
 */
export default class VideoFetchServiceFactory {
  private static readonly channelService: ChannelVideoService =
    new ChannelVideoService();

  private static readonly subscriptionsService: SubscriptionsVideoService =
    new SubscriptionsVideoService(this.channelService);

  private static readonly userService: UserVideoService = new UserVideoService(
    this.channelService
  );

  private static readonly playlistService: PlaylistVideoService =
    new PlaylistVideoService();

  /**
   * Get the appropriate VideoFetchService for a given source type.
   * @param source The video source configuration
   * @param errorTracker Error tracking instance
   * @returns The appropriate service, or null if source type is unsupported
   */
  public static getServiceForSource(
    source: VideoSource,
    errorTracker: ErrorTracker
  ): VideoFetchService | null {
    switch (source.type) {
      case 'subscriptions':
        return this.subscriptionsService;
      case 'username':
        return this.userService;
      case 'channel':
        return this.channelService;
      case 'playlist':
        return this.playlistService;
      default:
        errorTracker.addError(
          `Unsupported video source type: ${(source as any).type}`
        );
        Logger.log(`Unsupported video source type encountered`);
        return null;
    }
  }
}
