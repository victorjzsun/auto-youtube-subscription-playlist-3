/**
 * ErrorTracker class for managing error state and counts during playlist updates
 * Tracks errors per playlist and cumulative total across all playlists
 */
export default class ErrorTracker {
  private playlistErrorCount: number;

  private totalErrorCount: number;

  constructor() {
    this.playlistErrorCount = 0;
    this.totalErrorCount = 0;
  }

  /**
   * Add an error for the current playlist
   * Logs the error message and increments the playlist error count
   * @param message - Error message to log
   */
  addError(message: string): void {
    Logger.log(message);
    this.playlistErrorCount += 1;
  }

  /**
   * Check if any errors occurred for the current playlist
   * @returns true if errors occurred, false otherwise
   */
  hasErrors(): boolean {
    return this.playlistErrorCount > 0;
  }

  /**
   * Get the current playlist error count
   * @returns Number of errors for current playlist
   */
  getPlaylistErrorCount(): number {
    return this.playlistErrorCount;
  }

  /**
   * Get the total error count across all playlists
   * @returns Total number of errors
   */
  getTotalErrorCount(): number {
    return this.totalErrorCount;
  }

  /**
   * Reset playlist error tracking and add current count to total
   * Call this when moving to the next playlist
   */
  resetForNextPlaylist(): void {
    this.totalErrorCount += this.playlistErrorCount;
    this.playlistErrorCount = 0;
  }

  /**
   * Reset all error counters
   * Call this at the start of updatePlaylists()
   */
  reset(): void {
    this.playlistErrorCount = 0;
    this.totalErrorCount = 0;
  }
}
