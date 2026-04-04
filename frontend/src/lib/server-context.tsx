'use client';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { getServers, type ServerResponse } from '@/lib/server-api';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ServerContextType {
  selectedServerId: string | null;
  selectedServer: ServerResponse | null;
  servers: ServerResponse[];
  setSelectedServerId: (id: string | null) => void;
  loading: boolean;
  refreshServers: () => Promise<void>;
}

// ─── Context ───────────────────────────────────────────────────────────────

const ServerContext = createContext<ServerContextType>(null!);

export const useServer = () => {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServer must be used within a ServerProvider');
  return ctx;
};

// ─── Provider ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'radius-ui-server-id';

export function ServerProvider({ children }: { children: ReactNode }) {
  const [servers, setServers] = useState<ServerResponse[]>([]);
  const [selectedServerId, setSelectedServerIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchServers = useCallback(async () => {
    try {
      const list = await getServers();
      setServers(list);

      // Restore selection from localStorage, validate it still exists
      const stored = typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY)
        : null;

      if (stored && list.some((s) => s.id === stored)) {
        setSelectedServerIdState(stored);
      } else if (list.length > 0) {
        // Auto-select first server if no valid stored selection
        setSelectedServerIdState(list[0].id);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, list[0].id);
        }
      } else {
        setSelectedServerIdState(null);
      }
    } catch {
      // Silently fail — servers list stays empty, no server selected
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const setSelectedServerId = useCallback((id: string | null) => {
    setSelectedServerIdState(id);
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const refreshServers = useCallback(async () => {
    setLoading(true);
    await fetchServers();
  }, [fetchServers]);

  const selectedServer = servers.find((s) => s.id === selectedServerId) ?? null;

  return (
    <ServerContext.Provider
      value={{
        selectedServerId,
        selectedServer,
        servers,
        setSelectedServerId,
        loading,
        refreshServers,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}
