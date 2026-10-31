import { normalizeApiBase } from '@/utils/connection';

/**
 * 已保存的连接地址与自动检测地址不同 → 初始即为「自定义连接」状态。
 */
export function isCustomConnection(savedBase: string | null | undefined, detectedBase: string) {
  const saved = normalizeApiBase(savedBase ?? '');
  return Boolean(saved) && saved !== normalizeApiBase(detectedBase);
}

/**
 * 登录提交时实际使用的地址：开关关闭（或自定义地址为空）时一律使用自动检测的当前地址。
 */
export function resolveLoginApiBase(options: {
  customEnabled: boolean;
  apiBase: string;
  detectedBase: string;
}): string {
  const { customEnabled, apiBase, detectedBase } = options;
  if (!customEnabled) return detectedBase;
  return normalizeApiBase(apiBase) || detectedBase;
}
