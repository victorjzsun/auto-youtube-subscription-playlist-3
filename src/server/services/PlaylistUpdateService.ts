import ErrorTracker from '../ErrorTracker';
import { PlaylistItem, Video } from '../models';
import { MAX_VIDEO_COUNT } from './constants';
import dateToIsoString from './dateUtils';

/**
 * Service responsible for applying changes to playlists (adding and deleting videos).
 */
export default class PlaylistUpdateService {
  addVideos(
    playlistId: string,
    videos: Video[],
    errorTracker: ErrorTracker
  ): void {
    const totalVids: number = videos.length;

    if (totalVids === 0) {
      Logger.log('No new videos yet.');
      return;
    }

    if (totalVids >= MAX_VIDEO_COUNT) {
      errorTracker.addError(
        `The query contains ${totalVids} videos. Script cannot add more than ${MAX_VIDEO_COUNT} videos. Try moving the timestamp closer to today.`
      );
      return;
    }

    let successCount: number = 0;
    // TODO: Clean up error counting here
    const errorCountBefore: number = errorTracker.getPlaylistErrorCount();

    for (let idx = 0; idx < totalVids; idx += 1) {
      try {
        YouTube.PlaylistItems!.insert(
          {
            snippet: {
              playlistId,
              resourceId: {
                videoId: videos[idx].id,
                kind: 'youtube#video',
              },
            },
          },
          'snippet'
        );
        successCount += 1;
      } catch (e: any) {
        if (e.details.code === 409) {
          // Duplicate video - log but don't count as error
          Logger.log(
            `Couldn't update playlist with video (${videos[idx].id}), ERROR: Video already exists`
          );
        } else if (
          e.details.code === 400 &&
          e.details.errors[0].reason === 'playlistOperationUnsupported'
        ) {
          errorTracker.addError(
            "Couldn't update watch later or watch history playlist with video, functionality deprecated; try adding videos to a different playlist"
          );
        } else {
          // Check if video is private
          try {
            const results: GoogleAppsScript.YouTube.Schema.VideoListResponse =
              YouTube.Videos!.list('snippet', {
                id: videos[idx].id,
              });
            if (results.items?.length === 0) {
              // Private video - log but don't count as error
              Logger.log(
                `Couldn't update playlist with video (${videos[idx].id}), ERROR: Cannot find video, most likely private`
              );
            } else {
              errorTracker.addError(
                `"Couldn't update playlist with video (${
                  videos[idx].id
                }), ERROR: Message: [${e.message}] Details: ${JSON.stringify(
                  e.details
                )}`
              );
            }
          } catch (e2: any) {
            errorTracker.addError(
              `Couldn't update playlist with video (${videos[idx].id}), got ${
                e.message
              }, tried to search for video with id, got ERROR: Message: [${
                e2.message
              }] Details: ${JSON.stringify(e.details)}`
            );
          }
        }
      }
    }

    const errorCountAfter: number = errorTracker.getPlaylistErrorCount();
    const errorCount: number = errorCountAfter - errorCountBefore;
    Logger.log(
      `Added ${successCount} video(s) to playlist. Error for ${errorCount} video(s).`
    );
  }

  deleteItems(
    playlistId: string,
    deleteBeforeDate: Date,
    errorTracker: ErrorTracker
  ): void {
    let nextPageToken: string | undefined = '';
    const allVideos: PlaylistItem[] = [];
    const publishedBefore: string = dateToIsoString(deleteBeforeDate);

    while (nextPageToken !== undefined) {
      try {
        const results: GoogleAppsScript.YouTube.Schema.PlaylistItemListResponse =
          YouTube.PlaylistItems!.list('contentDetails', {
            playlistId,
            maxResults: 50,
            order: 'date',
            publishedBefore,
            pageToken: nextPageToken,
          });

        if (!results || !results.items) {
          break;
        }

        for (let j = 0; j < results.items.length; j += 1) {
          const item = results.items[j];
          if (!item || !item.id || !item.contentDetails) {
            continue;
          }

          const playlistItem: PlaylistItem = {
            id: item.id,
            videoId: item.contentDetails.videoId!,
            publishedAtIso: item.contentDetails.videoPublishedAt || undefined,
          };

          if (
            playlistItem.publishedAtIso &&
            new Date(playlistItem.publishedAtIso) < deleteBeforeDate
          ) {
            // this compares the timestamp when the video was published
            Logger.log(`Del: | ${playlistItem.publishedAtIso}`);
            YouTube.PlaylistItems!.remove(playlistItem.id);
          } else {
            allVideos.push(playlistItem);
          }
        }

        nextPageToken = results.nextPageToken;
      } catch (e: any) {
        errorTracker.addError(
          `Problem deleting existing videos from playlist with id ${playlistId}, ERROR: Message: [${
            e.message
          }] Details: ${JSON.stringify(e.details)}`
        );
        break;
      }
    }

    // Delete duplicates by videoId
    try {
      const tempVideos: PlaylistItem[] = [];
      const duplicateVideos: PlaylistItem[] = [];

      // TODO: Make more efficient
      allVideos.forEach((x: PlaylistItem) => {
        if (tempVideos.find((y: PlaylistItem) => y.videoId === x.videoId)) {
          duplicateVideos.push(x);
        } else {
          tempVideos.push(x);
        }
      });

      duplicateVideos.forEach((x: PlaylistItem) => {
        YouTube.PlaylistItems!.remove(x.id);
      });
    } catch (e: any) {
      errorTracker.addError(
        `Problem deleting duplicate videos from playlist with id ${playlistId}, ERROR: Message: [${
          e.message
        }] Details: ${JSON.stringify(e.details)}`
      );
    }
  }
}
