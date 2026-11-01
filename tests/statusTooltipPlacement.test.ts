import { describe, expect, test } from 'bun:test';
import { computeTooltipPlacement } from '@/components/providers/statusTooltipPlacement';

const viewport = { width: 1280, height: 800 };
const tooltip = { width: 160, height: 56 };
const anchorAt = (top: number, left = 600) => ({ top, bottom: top + 14, left, width: 6 });

describe('status bar tooltip placement', () => {
  test('sits above the block when there is room', () => {
    const result = computeTooltipPlacement(anchorAt(400), tooltip, viewport);
    expect(result.placement).toBe('above');
    expect(result.top).toBe(400 - 8 - 56);
    expect(result.left).toBe(603 - 80);
  });

  test('flips below a block near the top edge instead of clipping', () => {
    const result = computeTooltipPlacement(anchorAt(30), tooltip, viewport);
    expect(result.placement).toBe('below');
    expect(result.top).toBe(30 + 14 + 8);
  });

  test('clamps horizontally inside the viewport', () => {
    expect(computeTooltipPlacement(anchorAt(400, 2), tooltip, viewport).left).toBe(8);
    expect(computeTooltipPlacement(anchorAt(400, 1276), tooltip, viewport).left).toBe(
      1280 - 160 - 8
    );
  });

  test('renders through a body portal so scroll containers cannot clip it', async () => {
    const source = await Bun.file('src/components/providers/ProviderStatusBar.tsx').text();
    expect(source).toContain('createPortal(');
    expect(source).toContain('document.body');
    expect(source).toContain("position: 'fixed'");
  });
});
