import { describe, expect, test } from 'bun:test';
import { credentialFileDisplayName } from '@/features/oauth/privacy';
import { PRIVACY_MASK } from '@/utils/privacy';

describe('vertex import credential filename privacy', () => {
  test('conceals a selected filename that has no email in it', () => {
    expect(credentialFileDisplayName(true, 'alice-service-account.json')).toBe(
      `${PRIVACY_MASK}.json`
    );
  });

  test('keeps the recognized provider prefix of a returned auth file', () => {
    expect(
      credentialFileDisplayName(true, 'vertex-alice-proj.json', [
        'svc@alice-proj.iam.gserviceaccount.com',
      ])
    ).toBe(`vertex-${PRIVACY_MASK}.json`);
    expect(credentialFileDisplayName(true, 'vertex-bob@example.com.json')).not.toContain('bob');
  });

  test('returns the real name when privacy is off', () => {
    expect(credentialFileDisplayName(false, 'alice-service-account.json')).toBe(
      'alice-service-account.json'
    );
    expect(credentialFileDisplayName(true, '')).toBe('');
  });
});
