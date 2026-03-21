import { Video, VideoFilters } from '../models';

/**
 * Service for filtering videos based on playlist configuration filters.
 */
export default class VideoFilterService {
  /**
   * Filter videos based on the provided filter configuration.
   * Applies all enabled filters in a single pass for efficiency.
   */
  filterVideos(videos: Video[], filters: VideoFilters): Video[] {
    return videos.filter((video) => {
      // Check excludeShorts filter
      if (filters.excludeShorts && this.isShort(video.id)) {
        return false;
      }

      // Add additional filters here as needed
      // if (filters.someOtherFilter && this.someOtherCheck(video)) {
      //   return false;
      // }

      return true;
    });
  }

  /**
   * Check if a video is a YouTube Short by its duration.
   * Shorts are defined as videos with duration at most 3 minutes.
   */
  private isShort(videoId: string): boolean {
    try {
      const response = YouTube.Videos!.list('contentDetails', {
        id: videoId,
      });

      const items = response.items;
      if (!items || items.length === 0) {
        return false; // If can't fetch, don't exclude
      }

      const duration = items[0].contentDetails?.duration;
      if (!duration) {
        return false;
      }

      // Possible extra second, so adding equality as a safety measure.
      // https://stackoverflow.com/questions/72459082/yt-api-pulling-different-video-lengths-for-youtube-videos
      return this.parseDurationToSeconds(duration) <= 180;
    } catch (error) {
      Logger.log(`Error checking if video ${videoId} is short: ${error}`);
      return false; // On error, don't exclude
    }
  }

  /**
   * Parse YouTube API duration string (ISO 8601) to seconds.
   * Example: "PT4M13S" -> 253 seconds
   */
  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) {
      return 0;
    }

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }
}
