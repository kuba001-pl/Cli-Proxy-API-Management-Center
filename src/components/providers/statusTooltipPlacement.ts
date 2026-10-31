const TOOLTIP_GAP = 8;
const VIEWPORT_MARGIN = 8;

export interface TooltipRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

export interface TooltipPlacement {
  top: number;
  left: number;
  placement: 'above' | 'below';
}

/**
 * 计算悬浮提示的视口坐标：默认在色块上方，上方空间不足且下方更宽裕时翻转到下方；
 * 水平方向以色块为中心并夹在视口内。提示通过 portal 渲染，不会被滚动容器裁剪。
 */
export function computeTooltipPlacement(
  anchor: TooltipRect,
  tooltip: { width: number; height: number },
  viewport: { width: number; height: number }
): TooltipPlacement {
  const needed = tooltip.height + TOOLTIP_GAP + VIEWPORT_MARGIN;
  const spaceAbove = anchor.top;
  const spaceBelow = viewport.height - anchor.bottom;
  const placement = spaceAbove >= needed || spaceAbove >= spaceBelow ? 'above' : 'below';
  const top =
    placement === 'above' ? anchor.top - TOOLTIP_GAP - tooltip.height : anchor.bottom + TOOLTIP_GAP;
  const centered = anchor.left + anchor.width / 2 - tooltip.width / 2;
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - tooltip.width - VIEWPORT_MARGIN);
  const left = Math.min(Math.max(centered, VIEWPORT_MARGIN), maxLeft);
  return { top, left, placement };
}
