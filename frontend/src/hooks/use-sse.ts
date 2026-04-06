// SSE disabled — returns null to prevent infinite 404 retry loops.
// Re-enable when the backend SSE endpoint is ready.
export function useSSE() {
  return null;
}
