import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import { useAuthStore, useLanguageStore } from '@/stores';
import {
  getLoginTransitionTimings,
  useLoginTransitionStore,
} from '@/stores/useLoginTransitionStore';
import { prefersReducedMotion } from '@/hooks/motion';
import { detectApiBaseFromLocation } from '@/utils/connection';
import { LANGUAGE_LABEL_KEYS, LANGUAGE_ORDER } from '@/utils/constants';
import { isSupportedLanguage } from '@/utils/language';
import { INLINE_LOGO_JPEG } from '@/assets/logoInline';
import { DotMatrixHero } from './login/DotMatrixHero';
import { LoginForm } from './login/LoginForm';
import { isCustomConnection, resolveLoginApiBase } from './login/loginConnection';
import { getLoginErrorMessage, type LoginErrorMessage } from './login/loginError';
import { resolveLoginRedirect } from '@/router/loginRedirect';
import styles from './LoginPage.module.scss';

export type LoginPhase = 'idle' | 'connecting' | 'success' | 'exiting';

/** 左上角品牌名：产品全称，所有语言下保持英文，不走 i18n */
export const LOGIN_BRAND_NAME = 'CLI Proxy API Management Center';

/** 语言下拉层最小宽度：最长的语言名（繁體中文（台灣））单行显示 */
const LANGUAGE_DROPDOWN_MIN_WIDTH = 180;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  const detectedBase = useMemo(() => detectApiBaseFromLocation(), []);
  // 首帧即用已保存的连接信息填好表单：没有可恢复会话时表单直接出现，不闪启动画面
  const [apiBase, setApiBase] = useState(() => useAuthStore.getState().apiBase || detectedBase);
  const [managementKey, setManagementKey] = useState(
    () => useAuthStore.getState().managementKey || ''
  );
  // 自定义连接开关：决定提交时使用自定义地址还是自动检测的当前地址
  const [customBase, setCustomBase] = useState(() =>
    isCustomConnection(useAuthStore.getState().apiBase, detectedBase)
  );
  const [showKey, setShowKey] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(() => {
    const { rememberPassword: remembered, managementKey: key } = useAuthStore.getState();
    return remembered || Boolean(key);
  });
  const [phase, setPhase] = useState<LoginPhase>('idle');
  // 仅在确实会自动登录时显示启动画面
  const [autoLoading, setAutoLoading] = useState(() =>
    useAuthStore.getState().hasRestorableSession()
  );
  const [autoLoginSuccess, setAutoLoginSuccess] = useState(false);
  const [error, setError] = useState<LoginErrorMessage | null>(null);

  const startReveal = useLoginTransitionStore((state) => state.startReveal);
  const exitTimersRef = useRef<number[]>([]);
  const loading = phase === 'connecting';
  const redirectTarget = resolveLoginRedirect(location.state);

  useEffect(
    () => () => {
      exitTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    },
    []
  );

  const leaveTo = useCallback(
    (redirect: string, hold: number) => {
      const timings = getLoginTransitionTimings(prefersReducedMotion());
      const schedule = (callback: () => void, delay: number) => {
        exitTimersRef.current.push(window.setTimeout(callback, delay));
      };
      schedule(() => setPhase('exiting'), hold);
      schedule(() => {
        startReveal();
        navigate(redirect, { replace: true });
      }, hold + timings.exit);
    },
    [navigate, startReveal]
  );
  const languageOptions = useMemo(
    () =>
      LANGUAGE_ORDER.map((lang) => ({
        value: lang,
        label: t(LANGUAGE_LABEL_KEYS[lang]),
      })),
    [t]
  );
  const handleLanguageChange = useCallback(
    (selectedLanguage: string) => {
      if (!isSupportedLanguage(selectedLanguage)) {
        return;
      }
      setLanguage(selectedLanguage);
    },
    [setLanguage]
  );

  useEffect(() => {
    const splashStartedAt = performance.now();
    const init = async () => {
      try {
        const autoLoggedIn = await restoreSession();
        if (autoLoggedIn) {
          setAutoLoginSuccess(true);
          // 每次打开都会经过启动画面：网络快时补足最短停留，避免一闪而过；网络慢时不再额外等待
          const { splashMin } = getLoginTransitionTimings(prefersReducedMotion());
          const elapsed = performance.now() - splashStartedAt;
          leaveTo(redirectTarget, Math.max(0, splashMin - elapsed));
        } else {
          // 按最新的已保存信息回填表单（restoreSession 可能迁移了旧版存储）。
          // 自动登录被 401 拒绝时全局会登出并清空存储，此时保留首帧填入的地址与密钥，
          // 用户修正后即可直接重试，自定义地址也不会丢失。
          const stored = useAuthStore.getState();
          setApiBase((previous) => stored.apiBase || previous || detectedBase);
          if (isCustomConnection(stored.apiBase, detectedBase)) setCustomBase(true);
          setManagementKey((previous) => stored.managementKey || previous);
          setRememberPassword(
            (previous) => stored.rememberPassword || Boolean(stored.managementKey) || previous
          );
        }
      } finally {
        setAutoLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(async () => {
    if (phase !== 'idle') return;
    if (!managementKey.trim()) {
      setError({ summary: t('login.error_required') });
      return;
    }

    const baseToUse = resolveLoginApiBase({ customEnabled: customBase, apiBase, detectedBase });
    // 先进入 connecting：登录成功瞬间 isAuthenticated 变真时不会被立即重定向打断
    setPhase('connecting');
    setError(null);
    try {
      await login({
        apiBase: baseToUse,
        managementKey: managementKey.trim(),
        rememberPassword,
      });
    } catch (err: unknown) {
      // The inline alert is the single place the failure is reported (no duplicate toast).
      setPhase('idle');
      setError(getLoginErrorMessage(err, t));
      return;
    }
    setPhase('success');
    leaveTo(redirectTarget, getLoginTransitionTimings(prefersReducedMotion()).successHold);
  }, [
    apiBase,
    customBase,
    detectedBase,
    leaveTo,
    login,
    managementKey,
    phase,
    redirectTarget,
    rememberPassword,
    t,
  ]);

  if (isAuthenticated && !autoLoading && !autoLoginSuccess && phase === 'idle') {
    return <Navigate to={redirectTarget} replace />;
  }

  const showSplash = autoLoading || autoLoginSuccess;

  return (
    <div className={styles.container} data-phase={phase === 'exiting' ? 'exiting' : undefined}>
      {/* 点阵仅在移动端以顶部横幅显示；桌面端由样式隐藏 */}
      <div className={styles.brandPanel} aria-hidden="true">
        <DotMatrixHero />
      </div>

      <div className={styles.formPanel}>
        {/* 自动登录启动页自带大徽标与品牌名，此时不再渲染顶栏，避免重复 */}
        {!showSplash && (
          <header className={styles.topBar}>
            <span className={styles.languageIcon} aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a18 18 0 0 1 0 20 18 18 0 0 1 0-20Z" />
              </svg>
            </span>
            <Select
              className={styles.languageSelect}
              dropdownClassName={styles.languageDropdown}
              dropdownMinWidth={LANGUAGE_DROPDOWN_MIN_WIDTH}
              value={language}
              options={languageOptions}
              onChange={handleLanguageChange}
              fullWidth={false}
              size="sm"
              ariaLabel={t('language.switch')}
            />
          </header>
        )}

        <main className={styles.main}>
          {showSplash ? (
            <div className={styles.splash} role="status" aria-live="polite">
              <img src={INLINE_LOGO_JPEG} alt="" className={styles.splashLogo} />
              <div className={styles.splashText}>
                <h1 className={styles.splashTitle}>{t('splash.title')}</h1>
                <p className={styles.splashSubtitle}>{t('splash.subtitle')}</p>
              </div>
              <div className={styles.splashLoader} aria-hidden="true">
                <div className={styles.splashLoaderBar} />
              </div>
            </div>
          ) : (
            <div className={styles.column}>
              <div className={styles.brandMark}>
                <img src={INLINE_LOGO_JPEG} alt="" className={styles.brandLogo} />
                <h1 className={styles.brandName} title={LOGIN_BRAND_NAME}>
                  {LOGIN_BRAND_NAME}
                </h1>
                <p className={styles.subtitle}>{t('login.subtitle')}</p>
              </div>
              <LoginForm
                apiBase={apiBase}
                detectedBase={detectedBase}
                editingBase={customBase}
                managementKey={managementKey}
                showKey={showKey}
                rememberPassword={rememberPassword}
                loading={loading}
                success={phase === 'success' || phase === 'exiting'}
                error={error?.summary ?? ''}
                errorDetail={error?.detail}
                onApiBaseChange={setApiBase}
                onEditingBaseChange={setCustomBase}
                onManagementKeyChange={setManagementKey}
                onShowKeyChange={setShowKey}
                onRememberPasswordChange={setRememberPassword}
                onSubmit={handleSubmit}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
