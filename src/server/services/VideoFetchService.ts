import ErrorTracker from '../ErrorTracker';
import { Video, VideoSource } from '../models';

/**
 * A service that can produce videos to add to a playlist based on a source and a timestamp.
 * The {@link PlaylistChangePlanner} uses this interface to fetch videos for any supported source.
 */
export interface VideoFetchService {
  getVideos(
    source: VideoSource,
    lastTimestamp: Date,
    errorTracker: ErrorTracker
  ): Video[];
}
