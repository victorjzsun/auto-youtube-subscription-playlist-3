/**
 * Client-side type definitions for Playlist Manager
 * Mirrors the server-side PlaylistConfiguration but available in the client
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

export interface VideoFilters {
  excludeShorts?: boolean;
}

export interface PlaylistConfiguration {
  id: string;
  name: string;
  playlistId: string;
  lastTimestamp: string | Date; // Can be either ISO string or Date object
  frequencyHours: number | null;
  deleteDays: number | null;
  sources: VideoSource[];
  filters: VideoFilters;
}
