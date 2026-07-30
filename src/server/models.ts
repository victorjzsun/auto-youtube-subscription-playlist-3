import type { PlaylistConfiguration as SharedPlaylistConfiguration } from '../shared/models';

export type {
  VideoSourceType,
  ChannelSource,
  UsernameSource,
  SubscriptionSource,
  PlaylistSource,
  VideoSource,
  VideoFilters,
  Video,
  PlaylistItem,
  PlaylistChangeSet,
} from '../shared/models';

export type { PlaylistConfiguration as SharedPlaylistConfiguration } from '../shared/models';

export type PlaylistConfiguration = Omit<
  SharedPlaylistConfiguration,
  'lastTimestamp'
> & {
  lastTimestamp: Date;
};
