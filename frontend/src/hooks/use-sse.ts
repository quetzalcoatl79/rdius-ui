'use client';
import { useState, useEffect, useRef } from 'react';
import { getAccessToken } from '@/lib/api';

interface UseSSEOptions {
  url: string;     // e.g. "/api/v1/dashboard/sessions/stream"
  enabled?: boolean; // default true
}

interface UseSSEResult<T> {
  data: T | null;
  connected: boolean;
  error: string | null;
}

export function useSSE<T>(options: UseSSEOptions): UseSSEResult<T> {
  const { url, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function connect() {
      if (!mountedRef.current) return;

      // Clean up previous connection
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      const token = getAccessToken();
      const separator = url.includes('?') ? '&' : '?';
      const fullUrl = `/api/v1${url}${token ? `${separator}token=${encodeURIComponent(token)}` : ''}`;

      const es = new EventSource(fullUrl);
      esRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setError(null);
      };

      es.onmessage = (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const parsed = JSON.parse(event.data as string) as T;
          setData(parsed);
        } catch {
          // ignore malformed JSON
        }
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        es.close();
        esRef.current = null;
        // Auto-reconnect after 3 seconds
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, 3000);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [url, enabled]);

  return { data, connected, error };
}
