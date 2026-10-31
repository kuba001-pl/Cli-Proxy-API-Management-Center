import { afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemberCard } from '../src/features/routing/components/MemberCard';
import { ChangeReviewDialog } from '../src/features/routing/components/ChangeReviewDialog';
import { WeightDialog } from '../src/features/routing/components/WeightDialog';
import { buildRoutingPlan, draftFromBoard, moveMember } from '../src/features/routing/logic';
import { routingMemberDisplay, routingWeightLabel } from '../src/features/routing/privacy';
import { buildRoutingBoard } from '../src/services/api/routing';
import * as privacyStore from '../src/stores/usePrivacyStore';
import { PRIVACY_MASK } from '../src/utils/privacy';
import i18n from '../src/i18n';

// Dialog text interpolates the masked name; without an initialized i18n instance `t()` returns
// bare keys, so this suite must not depend on another test file having initialized it.
beforeAll(async () => {
  await i18n.changeLanguage('en');
});

const boardFor = (email = 'alice@example.test', name = 'codex-alice_example_test.json') =>
  buildRoutingBoard({}, [{ name, email, type: 'codex', priority: 0 }]);

const restores: Array<{ mockRestore: () => void }> = [];
afterEach(() => restores.splice(0).forEach((spy) => spy.mockRestore()));

const enablePrivacyForMarkup = () => {
  const state = { ...privacyStore.usePrivacyStore.getState(), enabled: true };
  restores.push(
    spyOn(privacyStore, 'usePrivacyStore').mockImplementation((selector) => selector(state))
  );
};

describe('routing display privacy', () => {
  test('masks identities and sanitized filenames using the credential identity', () => {
    const member = boardFor().members[0];
    expect(routingMemberDisplay(member, true)).toEqual({
      name: PRIVACY_MASK,
      detail: `codex-${PRIVACY_MASK}`,
    });
    expect(routingWeightLabel(member, member.weights[0].label, true)).toBe(PRIVACY_MASK);
    expect(routingMemberDisplay(member, false)).toEqual({
      name: member.name,
      detail: member.detail,
    });
    expect(routingWeightLabel(member, member.weights[0].label, false)).toBe(member.name);
  });

  test('masks project labels and filename-only credentials without revealing initials', () => {
    const project = buildRoutingBoard({}, [
      { name: 'gemini-project-alpha.json', projectId: 'project-alpha' },
    ]).members[0];
    expect(routingMemberDisplay(project, true)).toEqual({
      name: PRIVACY_MASK,
      detail: `gemini-${PRIVACY_MASK}`,
    });
    const fallback = boardFor('', 'private-account.json').members[0];
    expect(routingMemberDisplay(fallback, true).name).toBe(PRIVACY_MASK);
  });

  test('preserves provider labels and masked API-key labels', () => {
    const member = buildRoutingBoard(
      {
        'api-keys': {
          codex: [{ name: 'Work gateway', keys: [{ 'api-key': 'test-placeholder' }] }],
        },
      },
      []
    ).members[0];
    expect(routingMemberDisplay(member, true).name).toBe('Work gateway');
    expect(routingWeightLabel(member, member.weights[0].label, true)).toBe(member.weights[0].label);
  });

  test('display masking leaves member keys, credential locations and save plans unchanged', () => {
    const board = boardFor();
    const member = board.members[0];
    const draft = draftFromBoard(board);
    draft.tiers = moveMember(draft.tiers, member.key, { kind: 'gap', index: 0 });
    draft.weights[member.key] = [7];
    const before = JSON.stringify(board);
    const plan = buildRoutingPlan(board, draft);
    routingMemberDisplay(member, true);
    routingWeightLabel(member, member.weights[0].label, true);
    expect(JSON.stringify(board)).toBe(before);
    expect(buildRoutingPlan(board, draft)).toEqual(plan);
    expect(member.key).toBe('cred:codex-alice_example_test.json');
    expect(member.location).toEqual({ kind: 'credential', name: 'codex-alice_example_test.json' });
    expect(plan.weights[member.key]).toEqual([7]);
  });

  test('cards mask visible identities, tooltips and accessible action names', () => {
    enablePrivacyForMarkup();
    const member = boardFor().members[0];
    const html = renderToStaticMarkup(
      createElement(MemberCard, {
        member,
        route: { key: member.key, state: 'serving', share: 100 },
        strategy: 'weighted-round-robin',
        weights: [2],
        cooldownSeconds: 0,
        theme: 'dark',
        canMoveUp: true,
        canMoveDown: true,
        dragging: false,
        onDragStart: () => {},
        onDragEnd: () => {},
        onStep: () => {},
        onEditWeights: () => {},
      })
    );
    // Backend identifiers intentionally stay real for drag/drop and focus restoration.
    expect(html).toContain('data-member-key="cred:codex-alice_example_test.json"');
    const display = html.replace(/data-member-key="[^"]*"/g, '');
    expect(display).toContain(PRIVACY_MASK);
    expect(display).not.toContain('alice');
    expect(display).not.toContain('example.test');
    expect(display).toContain('width:100%');
  });

  test('review and weight dialogs mask credential names and weight labels', () => {
    enablePrivacyForMarkup();
    const member = boardFor().members[0];
    const review = renderToStaticMarkup(
      createElement(ChangeReviewDialog, {
        open: true,
        changes: [
          { kind: 'priority', memberKey: member.key, from: 0, to: 10 },
          { kind: 'weight', memberKey: member.key, index: 0, from: null, to: 7 },
        ],
        members: new Map([[member.key, member]]),
        saving: false,
        onConfirm: () => {},
        onClose: () => {},
      })
    );
    const weight = renderToStaticMarkup(
      createElement(WeightDialog, {
        open: true,
        member,
        weights: [7],
        strategy: 'weighted-round-robin',
        onApply: () => {},
        onClose: () => {},
      })
    );
    for (const html of [review, weight]) {
      expect(html).toContain('role="dialog"');
      expect(html).toContain(PRIVACY_MASK);
      expect(html).not.toContain('alice');
      expect(html).not.toContain('example.test');
    }
  });
});
