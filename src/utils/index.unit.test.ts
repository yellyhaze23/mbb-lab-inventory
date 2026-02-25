import { describe, expect, it } from 'vitest';
import { createPageUrl } from '@/utils';

describe('createPageUrl', () => {
  it('prefixes a slash for simple page names', () => {
    expect(createPageUrl('Dashboard')).toBe('/Dashboard');
  });

  it('replaces spaces with dashes', () => {
    expect(createPageUrl('Usage Logs')).toBe('/Usage-Logs');
  });
});
