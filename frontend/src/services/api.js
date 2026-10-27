const API = import.meta.env.VITE_API_URL || '/api';
let currentEstablishment = '';
export const setEstablishment = (id) => { currentEstablishment = id || ''; };
export async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (currentEstablishment) headers.set('x-establishment-id', currentEstablishment);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API}${path}`, {
    ...options,
    ...(options.method === undefined || options.method.toUpperCase() === 'GET' ? { cache: 'no-store' } : {}),
    headers,
    credentials: 'include',
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a solicitação.');
  return data;
}
