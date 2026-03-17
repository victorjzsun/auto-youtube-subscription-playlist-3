/**
 * Domain models for the Auto YouTube Subscription Playlist project.
 *
 * These models are used to represent core concepts in a more explicit way
 * than raw strings/arrays. They are intentionally minimal to avoid introducing
 * new behavior while making the code easier to reason about.
 */

export type VideoSourceType =
  | 'channel'
  | 'username'
  | 'subscriptions'
  | 'playlist';

export interface ChannelSource {
  type: 'channel';
  channelId: string;
}

export interface UsernameSource {
  type: 'username';
  username: string;
}

export interface SubscriptionSource {
  type: 'subscriptions';
}

export interface PlaylistSource {
  type: 'playlist';
  playlistId: string;
}

export type VideoSource =
  | ChannelSource
  | UsernameSource
  | SubscriptionSource
  | PlaylistSource;

export interface PlaylistConfiguration {
  playlistId: string;
  lastTimestamp: Date;
  frequencyHours: number | null;
  deleteDays: number | null;
  sources: VideoSource[];
}

export interface Video {
  /** YouTube video ID (e.g. "dQw4w9WgXcQ") */
  id: string;
  /** Optional origin of the video, derived from the source type. */
  origin?: VideoSourceType;
}

export interface PlaylistItem {
  /** PlaylistItem ID (used for removal) */
  id: string;
  /** Underlying video ID */
  videoId: string;
  /** ISO timestamp when this item was added to the playlist (if available) */
  addedAtIso?: string;
  /** ISO timestamp when the video was published (if available) */
  publishedAtIso?: string;
}

export interface PlaylistChangeSet {
  videosToAdd: Video[];
  playlistItemsToDelete: PlaylistItem[];
}
