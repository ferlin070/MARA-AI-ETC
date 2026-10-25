import { useEffect, useState } from 'react';
import { Tabs, Typography } from '@openhands/ui';
import { AppLayout } from '../components/layout/AppLayout';
import { UserManagementTab } from '../components/admin/UserManagementTab';
import { RoleConfigTab } from '../components/admin/RoleConfigTab';
import { AgentConfigTab } from '../components/admin/AgentConfigTab';
import { SystemSettingsTab } from '../components/admin/SystemSettingsTab';
import {
  ApiNotAvailableError,
  fetchUsers,
  fetchRoles,
  fetchAgentProfiles,
  fetchSystemSettings,
} from '../services/data';
import type { AdminUser, AdminRole, AgentProfile, SystemSetting } from '../types/admin';

type ResourceState<T> =
  | { state: 'loading' }
  | { state: 'ready'; data: T }
  | { state: 'unavailable' }
  | { state: 'error'; message: string };

function settle<T>(result: PromiseSettledResult<T>): ResourceState<T> {
  if (result.status === 'fulfilled') return { state: 'ready', data: result.value };
  if (result.reason instanceof ApiNotAvailableError) return { state: 'unavailable' };
  return {
    state: 'error',
    message: result.reason instanceof Error ? result.reason.message : String(result.reason),
  };
}

/** Placeholder rows shown while a resource is loading or its API is missing. */
function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-4 dark:border-[#222328] dark:bg-[#131417]">
      <div className="mb-3 h-4 w-32 rounded bg-slate-200 dark:bg-[#2C2E34]" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <div className="h-3 w-1/4 rounded bg-slate-100 dark:bg-[#1E1F23]" />
            <div className="h-3 w-1/3 rounded bg-slate-100 dark:bg-[#1E1F23]" />
            <div className="h-3 w-1/5 rounded bg-slate-100 dark:bg-[#1E1F23]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function UnavailablePanel({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-4 py-8 text-center dark:border-amber-800/60 dark:bg-amber-950/20">
      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
        API belum tersedia
      </p>
      <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">
        {label} memerlukan endpoint backend yang belum dibina. Tiada data palsu dipaparkan.
      </p>
    </div>
  );
}

export function AdminConsolePage() {
  const [users, setUsers] = useState<ResourceState<AdminUser[]>>({ state: 'loading' });
  const [roles, setRoles] = useState<ResourceState<AdminRole[]>>({ state: 'loading' });
  const [agents, setAgents] = useState<ResourceState<AgentProfile[]>>({ state: 'loading' });
  const [settings, setSettings] = useState<ResourceState<SystemSetting[]>>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const results = await Promise.allSettled([
        fetchUsers(),
        fetchRoles(),
        fetchAgentProfiles(),
        fetchSystemSettings(),
      ]);
      if (cancelled) return;

      const [u, r, a, s] = results;
      // Promise.allSettled always resolves in input order with all four entries.
      if (u && r && a && s) {
        setUsers(settle(u));
        setRoles(settle(r));
        setAgents(settle(a));
        setSettings(settle(s));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const resources = [users, roles, agents, settings];
  const unavailableCount = resources.filter((r) => r.state === 'unavailable').length;
  const errorCount = resources.filter((r) => r.state === 'error').length;
  const loadingCount = resources.filter((r) => r.state === 'loading').length;

  const usersData = users.state === 'ready' ? users.data : [];
  const rolesData = roles.state === 'ready' ? roles.data : [];
  const agentsData = agents.state === 'ready' ? agents.data : [];
  const settingsData = settings.state === 'ready' ? settings.data : [];

  return (
    <AppLayout title="Admin Console" subtitle="User / role / agent configuration">
      {loadingCount > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-[#222328] dark:bg-[#131417] dark:text-slate-400">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 dark:border-slate-600 dark:border-t-indigo-400" />
          Memuatkan konfigurasi pentadbir...
        </div>
      )}

      {unavailableCount > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
          <Typography.Text fontWeight={600} fontSize="s" className="text-amber-800 dark:text-amber-300">
            API belum tersedia
          </Typography.Text>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            {unavailableCount} daripada 4 sumber Admin Console belum mempunyai endpoint backend.
            Bahagian berkenaan dipaparkan sebagai skeleton kosong — tiada data contoh direka.
          </p>
        </div>
      )}

      {errorCount > 0 && (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 dark:border-rose-800/60 dark:bg-rose-950/30">
          <Typography.Text fontWeight={600} fontSize="s" className="text-rose-800 dark:text-rose-300">
            Ralat memuatkan data pentadbir
          </Typography.Text>
          <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
            {errorCount} sumber gagal dimuatkan. Semak sambungan backend dan cuba semula.
          </p>
        </div>
      )}

      <Tabs>
        <Tabs.Item text={`Users (${usersData.length})`} testId="tab-users">
          <div className="mt-4">
            {users.state === 'ready' ? (
              <UserManagementTab users={usersData} />
            ) : users.state === 'unavailable' ? (
              <div className="space-y-3">
                <UnavailablePanel label="Senarai pengguna" />
                <TableSkeleton />
              </div>
            ) : users.state === 'loading' ? (
              <TableSkeleton />
            ) : (
              <UnavailablePanel label={`Senarai pengguna (${users.message})`} />
            )}
          </div>
        </Tabs.Item>

        <Tabs.Item text="Roles" testId="tab-roles">
          <div className="mt-4">
            {roles.state === 'ready' ? (
              rolesData.length === 0 ? (
                <EmptyState label="Tiada peranan dikonfigurasikan." />
              ) : (
                <RoleConfigTab roles={rolesData} />
              )
            ) : roles.state === 'unavailable' ? (
              <div className="space-y-3">
                <UnavailablePanel label="Konfigurasi peranan" />
                <TableSkeleton rows={3} />
              </div>
            ) : roles.state === 'loading' ? (
              <TableSkeleton rows={3} />
            ) : (
              <UnavailablePanel label={`Konfigurasi peranan (${roles.message})`} />
            )}
          </div>
        </Tabs.Item>

        <Tabs.Item text="Agents" testId="tab-agents">
          <div className="mt-4">
            {agents.state === 'ready' ? (
              agentsData.length === 0 ? (
                <EmptyState label="Tiada profil ejen dikonfigurasikan." />
              ) : (
                <AgentConfigTab agents={agentsData} />
              )
            ) : agents.state === 'unavailable' ? (
              <div className="space-y-3">
                <UnavailablePanel label="Profil ejen" />
                <TableSkeleton rows={3} />
              </div>
            ) : agents.state === 'loading' ? (
              <TableSkeleton rows={3} />
            ) : (
              <UnavailablePanel label={`Profil ejen (${agents.message})`} />
            )}
          </div>
        </Tabs.Item>

        <Tabs.Item text="System Settings" testId="tab-settings">
          <div className="mt-4">
            {settings.state === 'ready' ? (
              settingsData.length === 0 ? (
                <EmptyState label="Tiada tetapan sistem dikonfigurasikan." />
              ) : (
                <SystemSettingsTab settings={settingsData} />
              )
            ) : settings.state === 'unavailable' ? (
              <div className="space-y-3">
                <UnavailablePanel label="Tetapan sistem" />
                <TableSkeleton rows={3} />
              </div>
            ) : settings.state === 'loading' ? (
              <TableSkeleton rows={3} />
            ) : (
              <UnavailablePanel label={`Tetapan sistem (${settings.message})`} />
            )}
          </div>
        </Tabs.Item>
      </Tabs>
    </AppLayout>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-400 dark:border-[#2C2E34] dark:text-slate-500">
      {label}
    </div>
  );
}
