'use client';
import { useServer } from '@/lib/server-context';

export function ServerSelector() {
  const { servers, selectedServerId, setSelectedServerId, loading } = useServer();

  return (
    <div className="px-3 py-2 space-y-1">
      <p className="text-xs text-muted-foreground">Serveur actif</p>
      <select
        className="w-full px-3 py-2 rounded-md bg-muted text-sm border border-border focus:outline-none focus:ring-2 focus:ring-ring"
        value={selectedServerId ?? ''}
        onChange={(e) => setSelectedServerId(e.target.value || null)}
        disabled={loading}
      >
        {loading ? (
          <option disabled value="">
            Chargement...
          </option>
        ) : servers.length === 0 ? (
          <option disabled value="">
            Aucun serveur
          </option>
        ) : (
          servers.map((server) => (
            <option key={server.id} value={server.id}>
              {server.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
