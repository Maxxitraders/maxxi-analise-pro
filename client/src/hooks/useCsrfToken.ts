import { useCallback, useEffect, useState } from "react";

// Refresh 5 min antes do servidor expirar (server TTL = 1h)
const TOKEN_TTL_MS = 55 * 60 * 1000;

let _cachedToken: string | null = null;
let _tokenExpiry = 0;

export async function fetchCsrfToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiry) {
    return _cachedToken;
  }

  const res = await fetch("/api/csrf-token", {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Falha ao obter CSRF token: ${res.status}`);
  }

  const data = (await res.json()) as { token: string };
  _cachedToken = data.token;
  _tokenExpiry = Date.now() + TOKEN_TTL_MS;
  return _cachedToken;
}

export function invalidateCsrfToken(): void {
  _cachedToken = null;
  _tokenExpiry = 0;
}

export function useCsrfToken() {
  const [token, setToken] = useState<string | null>(_cachedToken);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      invalidateCsrfToken();
      const t = await fetchCsrfToken();
      setToken(t);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  useEffect(() => {
    fetchCsrfToken()
      .then(setToken)
      .catch((err) => setError(err instanceof Error ? err : new Error(String(err))));

    const id = setInterval(refresh, TOKEN_TTL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { token, error, refresh };
}
