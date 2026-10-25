import { UserManager, WebStorageStateStore, User } from 'oidc-client-ts';

function getDynamicKeycloakUrl(): string {
  const envUrl = import.meta.env.VITE_KEYCLOAK_URL;
  if (envUrl && !envUrl.includes('loca.lt')) {
    return envUrl;
  }
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  if (protocol === 'https:') {
    return `https://auth-mara.${hostname.replace(/^mara-aietc\./, '')}`;
  }
  return `http://${hostname}:8080`;
}



const KEYCLOAK_URL = getDynamicKeycloakUrl();
const KEYCLOAK_REALM =
  import.meta.env.VITE_KEYCLOAK_REALM ?? 'mara-ai-etc';
const CLIENT_ID =
  import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'mara-officer-workspace';


// OIDC redirect goes to /callback — a dedicated page that handles the code
// exchange and then navigates to the original destination (or /).
const REDIRECT_URI = `${window.location.origin}/callback`;
const POST_LOGOUT_REDIRECT_URI = `${window.location.origin}/login`;

function createUserManager(): UserManager {
  return new UserManager({
    authority: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    post_logout_redirect_uri: POST_LOGOUT_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email roles',
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    automaticSilentRenew: true,
    // Store the original URL in OIDC state so CallbackPage can restore it
    // after a successful login (oidc-client-ts handles this transparently).
  });
}

let userManager: UserManager | null = null;

function getUserManager(): UserManager {
  if (!userManager) {
    userManager = createUserManager();
  }
  return userManager;
}

// ---------------------------------------------------------------------------
// User profile helpers
// ---------------------------------------------------------------------------

export interface UserProfile {
  subject: string;
  name: string;
  email: string;
  username: string;
  roles: string[];
  accessToken: string;
}

/** Extract a structured profile from the OIDC user object or mock session. */
export function extractProfile(user: User | MockUserShape): UserProfile {
  const profile = user.profile as Record<string, unknown>;
  const realmAccess = profile['realm_access'] as { roles?: string[] } | undefined;
  const roles =
    realmAccess?.roles ??
    (Array.isArray(profile['roles']) ? (profile['roles'] as string[]) : []);

  return {
    subject: (profile['sub'] as string) ?? '',
    name: (profile['name'] as string) ?? (profile['preferred_username'] as string) ?? '',
    email: (profile['email'] as string) ?? '',
    username: (profile['preferred_username'] as string) ?? '',
    roles,
    accessToken: user.access_token ?? '',
  };
}

// ---------------------------------------------------------------------------
// Mock / Dev Mode (dev builds only)
// ---------------------------------------------------------------------------

const MOCK_USER_STORAGE_KEY = 'mara_dev_mode_user';

interface MockUserShape {
  profile: Record<string, unknown>;
  access_token: string;
  expired: boolean;
  expires_at: number;
}

async function fetchBackendDevToken(): Promise<string | null> {
  const devEmail = import.meta.env.VITE_DEV_OFFICER_EMAIL;
  const devPassword = import.meta.env.VITE_DEV_OFFICER_PASSWORD;
  if (!devEmail || !devPassword) return null;
  try {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: devEmail, password: devPassword }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { access_token?: string };
    return body.access_token ?? null;
  } catch {
    return null;
  }
}

/** Sign in using Mock / Dev Mode without Keycloak server. */
export async function loginMock(): Promise<void> {
  const backendToken = await fetchBackendDevToken();
  const mockUser: MockUserShape = {
    profile: {
      sub: 'mock-officer-001',
      name: 'Pegawai MARA (Dev Mode)',
      preferred_username: 'pegawai.mara',
      email: 'pegawai@mara.gov.my',
      roles: ['officer', 'reviewer', 'admin'],
    },
    access_token: backendToken ?? 'mock-jwt-token-dev-mode',
    expired: false,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
  };
  window.sessionStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(mockUser));
  window.location.assign(window.location.origin + '/');
}

// ---------------------------------------------------------------------------
// Real Keycloak OIDC flow
// ---------------------------------------------------------------------------

/**
 * Build the post-login destination and validate it as an in-app path.
 * Rejects absolute URLs and protocol-relative paths so a tampered `state`
 * value cannot turn the callback into an open redirect.
 */
export function safeReturnPath(candidate: unknown): string {
  if (typeof candidate !== 'string') return '/';
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/';
  if (candidate.startsWith('/login') || candidate.startsWith('/callback')) return '/';
  return candidate;
}

/** Key used by AuthGuard to remember the deep link that bounced to /login. */
export const RETURN_TO_STORAGE_KEY = 'mara_return_to';

function currentReturnPath(): string {
  const { pathname, search, hash } = window.location;
  // On /login the visible URL is not what the officer asked for — AuthGuard
  // stashes the attempted path so the SSO round-trip can restore it.
  if (pathname === '/login' || pathname === '/callback') {
    const stashed = window.sessionStorage.getItem(RETURN_TO_STORAGE_KEY);
    if (stashed) return safeReturnPath(stashed);
  }
  return safeReturnPath(`${pathname}${search}${hash}`);
}

/**
 * Redirect the browser to Keycloak SSO login page.
 * @param returnTo in-app path to restore after the callback (defaults to now)
 */
export async function login(returnTo?: string): Promise<void> {
  const mgr = getUserManager();
  await mgr.signinRedirect({ state: { url: safeReturnPath(returnTo ?? currentReturnPath()) } });
}

/** Resolve the original URL stashed in OIDC state by {@link login}. */
export function getPostLoginRedirect(user: User): string {
  const state = user.state as { url?: unknown } | undefined;
  const target = safeReturnPath(state?.url);
  window.sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
  return target;
}

/** Handle the OIDC redirect callback and return the authenticated user. */
export async function handleRedirectCallback(): Promise<User | null> {
  const mgr = getUserManager();
  try {
    const user = await mgr.signinRedirectCallback();
    return user;
  } catch {
    return null;
  }
}

/** Log the user out and redirect to Keycloak logout endpoint. */
export async function logout(): Promise<void> {
  const mockJson = window.sessionStorage.getItem(MOCK_USER_STORAGE_KEY);
  if (mockJson) {
    window.sessionStorage.removeItem(MOCK_USER_STORAGE_KEY);
    window.location.assign(window.location.origin + '/login');
    return;
  }

  // Suppress the session-expiry redirect while a deliberate sign-out runs,
  // otherwise it races signoutRedirect() and strands the user on /login.
  intentionalLogout = true;
  const mgr = getUserManager();
  await mgr.signoutRedirect();
}

// ---------------------------------------------------------------------------
// Session expiry handling
// ---------------------------------------------------------------------------

let intentionalLogout = false;
let listenersBound = false;

/**
 * Hard-navigate to /login because the session is gone (token expired or was
 * signed out elsewhere). Skips when the user is already on an auth route or is
 * authenticated through the dev mock, which has no OIDC session to expire.
 */
function handleSessionExpired(): void {
  if (intentionalLogout) return;
  if (window.sessionStorage.getItem(MOCK_USER_STORAGE_KEY)) return;

  const { pathname } = window.location;
  if (pathname === '/login' || pathname === '/callback') return;

  window.location.assign(window.location.origin + '/login');
}

/**
 * Subscribe to oidc-client-ts session events so an expired or revoked token
 * logs the officer out automatically instead of leaving dead pages on screen:
 *   - addUserSignedOut: sign-out in another tab, or session invalidation
 *   - addSilentRenewError: refresh token rejected / IdP unreachable
 * Safe to call more than once; binding happens only once per page load.
 * @returns teardown that removes the listeners
 */
export function initAuthSessionListeners(): () => void {
  if (listenersBound) return () => undefined;
  listenersBound = true;

  const events = getUserManager().events;
  const offSignedOut = events.addUserSignedOut(handleSessionExpired);
  const offRenewError = events.addSilentRenewError(handleSessionExpired);

  return () => {
    offSignedOut();
    offRenewError();
    listenersBound = false;
  };
}

/** Return the currently authenticated user, or null. */
export async function getUser(): Promise<User | null> {
  const mockJson = window.sessionStorage.getItem(MOCK_USER_STORAGE_KEY);
  if (mockJson) {
    try {
      return JSON.parse(mockJson) as User;
    } catch {
      // ignore invalid json
    }
  }

  const mgr = getUserManager();
  const user = await mgr.getUser();
  return user;
}

/** Get a Bearer token for API requests. */
export async function getAccessToken(): Promise<string | null> {
  const mockJson = window.sessionStorage.getItem(MOCK_USER_STORAGE_KEY);
  if (mockJson) {
    try {
      const u = JSON.parse(mockJson) as MockUserShape;
      return u.access_token ?? null;
    } catch {
      // ignore invalid json
    }
  }

  const mgr = getUserManager();
  const user = await mgr.getUser();
  return user?.access_token ?? null;
}

/** Get the structured profile of the current user, or null if not logged in. */
export async function getUserProfile(): Promise<UserProfile | null> {
  const mockJson = window.sessionStorage.getItem(MOCK_USER_STORAGE_KEY);
  if (mockJson) {
    try {
      const u = JSON.parse(mockJson) as MockUserShape;
      return extractProfile(u);
    } catch {
      return null;
    }
  }

  const mgr = getUserManager();
  const user = await mgr.getUser();
  if (!user || user.expired) return null;
  return extractProfile(user);
}
