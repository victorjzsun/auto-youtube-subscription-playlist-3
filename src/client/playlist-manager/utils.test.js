/* eslint-env jest */

import { buildYouTubePlaylistUrl, parsePlaylistId } from './utils';

describe('playlist manager utilities', () => {
  it('extracts a playlist id from a playlist URL', () => {
    expect(
      parsePlaylistId('https://www.youtube.com/playlist?list=PL123ABC')
    ).toBe('PL123ABC');
  });

  it('builds a YouTube playlist URL from a playlist id', () => {
    expect(buildYouTubePlaylistUrl('PL123ABC')).toBe(
      'https://www.youtube.com/playlist?list=PL123ABC'
    );
  });
});
