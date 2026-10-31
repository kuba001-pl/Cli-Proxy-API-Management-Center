import { describe, expect, test } from 'bun:test';
import {
  createLogDisplayCache,
  privacyLogFileName,
  privacyLogText,
} from '../src/features/logs/model/logPrivacy';
import type { LogEntry } from '../src/features/logs/model/logSelectors';
import { PRIVACY_MASK } from '../src/utils/privacy';

describe('logs display privacy', () => {
  test('masks emails, labelled usernames and quoted account labels in free text', () => {
    const text = 'username=alice user: ab account_name="Alice Example" email=alice@example.test';
    const masked = privacyLogText(true, text);
    expect(masked).not.toContain('alice');
    expect(masked).not.toContain('ab');
    expect(masked).not.toContain('Alice Example');
    expect(masked).not.toContain('@');
    expect(masked.match(/•{16}/g)).toHaveLength(4);
    expect(privacyLogText(false, text)).toBe(text);
    expect(privacyLogText(true, 'GET /v1/models 200 12ms')).toBe('GET /v1/models 200 12ms');
  });

  test('masks file identities while keeping file extensions and ordinary archive names', () => {
    expect(privacyLogFileName(true, 'alice@example.test.log')).toBe(`${PRIVACY_MASK}.log`);
    expect(privacyLogFileName(true, 'error-username=alice.log')).toBe(
      `error-username=${PRIVACY_MASK}.log`
    );
    const archive = 'error-2026-10-29T21-51-49-e4d901.log';
    expect(privacyLogFileName(true, archive)).toBe(archive);
    expect(privacyLogFileName(false, 'alice@example.test.log')).toBe('alice@example.test.log');
    expect(privacyLogText(true, 'retry credential alice@example.test.json')).toBe(
      `retry credential ${PRIVACY_MASK}.json`
    );
  });

  test('caches masked entries without changing searchable text or action identifiers', () => {
    const entry: LogEntry = {
      id: 7,
      raw: 'username=alice GET /users/alice request_id=a1b2c3d4',
      level: 'info',
      timestamp: '2026-10-29 21:51:49',
      requestId: 'a1b2c3d4',
      path: '/users/alice',
      message: 'username=alice',
      source: 'alice.go:10',
    };
    const display = createLogDisplayCache();
    const masked = display(entry, true);
    expect(masked.path).toBe(`/users/${PRIVACY_MASK}`);
    expect(masked.source).toBe(`${PRIVACY_MASK}.go:10`);
    expect(masked.raw).not.toContain('alice');
    expect(masked.requestId).toBe(entry.requestId);
    expect(masked.id).toBe(entry.id);
    expect(display(entry, true)).toBe(masked);
    expect(display(entry, false)).toBe(entry);
    expect(display(entry, true)).toBe(masked);
    expect(entry.raw).toContain('alice');
    expect(entry.path).toBe('/users/alice');
    // A reused ID after reset/session switch must not reuse an older display row.
    const replacement = { ...entry, raw: 'username=bob', message: 'username=bob' };
    expect(display(replacement, true)).not.toBe(masked);
    expect(display(replacement, true).raw).not.toContain('bob');
  });
});
