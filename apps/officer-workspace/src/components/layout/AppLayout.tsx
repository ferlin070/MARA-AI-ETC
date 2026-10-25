import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Icon } from '@openhands/ui';
import { getUserProfile, logout } from '../../services/auth';
import { useTheme } from '../../context/ThemeContext';
import type { UserProfile } from '../../services/auth';
import logo from '../../assets/mara-ai-etc.png';

interface AppLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

/** Sidebar sections. Labels are mono uppercase per the Adminator shell. */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'UTAMA',
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        ),
      },
      {
        to: '/',
        label: 'Workspace',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'TINDAKAN',
    items: [
      {
        to: '/review',
        label: 'Review',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        to: '/auditor',
        label: 'Auditor',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
      {
        to: '/admin',
        label: 'Admin',
        icon: (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
];

/** 4px scrollbar, thumb on the border token. Arbitrary variants keep the
 *  styling local to the sidebar without adding a stylesheet rule. */
const THIN_SCROLLBAR =
  '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-default';

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getUserProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .finally(() => {
        if (!cancelled) setProfileLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // While the profile loads, show skeletons; if it resolves null (e.g. no
  // auth session), show an honest '—' rather than a fabricated dev identity.
  const displayName = profile?.name ?? '—';
  const displayRole = profileLoaded
    ? `Cawangan Ibu Pejabat · ${profile?.roles[0] ?? '—'}`
    : 'Cawangan Ibu Pejabat';
  const nameSkeleton = profileLoaded ? (
    <p className="truncate text-sm font-medium text-text-primary">{displayName}</p>
  ) : (
    <div className="h-4 w-24 animate-pulse rounded-sm bg-surface-sunken" aria-label="Memuatkan profil" />
  );
  const roleSkeleton = profileLoaded ? (
    <p className="truncate text-xs text-text-muted">{displayRole}</p>
  ) : (
    <div className="mt-1.5 h-3 w-32 animate-pulse rounded-sm bg-surface-sunken" />
  );

  /**
   * Sign-out is a redirect: `logout()` navigates to the Keycloak end-session
   * endpoint (or to /login in mock mode). Until that navigation starts, the
   * button must lock so a second click cannot fire a second signout request
   * or leave a dead button while the IdP round-trip is in flight.
   * The `finally` only runs if logout() threw — a successful sign-out
   * unloads the page, so the reset is for the failure path only.
   */
  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-[18px]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--primary)] shadow-sm">
          <img
            src={logo}
            alt="MARA AI-ETC Logo"
            className="h-6 w-6 object-contain brightness-0 invert"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight tracking-tight text-text-primary">
            Officer Workspace
          </p>
          <p className="mt-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted">
            MARA AI-ETC
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Navigasi utama" className={`flex-1 overflow-y-auto px-3 py-4 ${THIN_SCROLLBAR}`}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="px-3 pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-soft text-[color:var(--primary-hover)]'
                        : 'text-text-secondary hover:bg-surface-sunken hover:text-text-primary'
                    }`
                  }
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: theme, identity, sign-out */}
      <div className="border-t border-border-subtle px-4 py-4">
        <button
          onClick={toggleTheme}
          className="mb-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border-default bg-[var(--surface-sunken)] px-3 py-2 text-xs font-semibold text-text-secondary shadow-sm transition-colors hover:bg-surface-card-hover hover:text-text-primary"
          title="Toggle Light/Dark Theme"
        >
          <Icon icon={theme === 'dark' ? 'MoonFill' : 'SunFill'} className="h-4 w-4 text-[color:var(--primary)]" />
          <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>
        {nameSkeleton}
        {roleSkeleton}
        <button
          onClick={handleLogout}
          disabled={signingOut}
          aria-busy={signingOut}
          className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[color:var(--danger)] hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
          title={signingOut ? 'Logging out…' : 'Log out'}
        >
          {signingOut ? (
            <svg
              className="h-3.5 w-3.5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" d="M12 3a9 9 0 109 9" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          )}
          <span>{signingOut ? 'Log keluar…' : 'Log keluar'}</span>
        </button>
      </div>
    </div>
  );
}

export function AppLayout({ title, subtitle, children }: AppLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="grid h-screen w-full grid-cols-1 bg-surface-body text-text-primary md:grid-cols-[248px_minmax(0,1fr)]">
      {/* Desktop sidebar — sticky within the grid column */}
      <aside
        className={`hidden border-r border-border-default bg-surface-card md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto ${THIN_SCROLLBAR}`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-overlay backdrop-blur-xs transition-opacity"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-surface-card shadow-lg transition-transform">
            <div className="flex justify-end border-b border-border-subtle p-2.5">
              <button
                onClick={() => setMobileNavOpen(false)}
                className="cursor-pointer rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
                aria-label="Close menu"
                title="Close menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={`min-h-0 flex-1 overflow-y-auto ${THIN_SCROLLBAR}`}>
              <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex min-w-0 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border-default bg-surface-card/80 px-4 py-3 shadow-sm backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3">
            <button
              className="cursor-pointer rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary md:hidden"
              onClick={() => setMobileNavOpen(true)}
              title="Open menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-text-primary md:text-lg">{title}</h1>
              <p className="hidden truncate text-xs text-text-muted sm:block">{subtitle}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 app-main-glow">{children}</main>
      </div>
    </div>
  );
}
