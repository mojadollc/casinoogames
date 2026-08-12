import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3020/api';
const BASE_URL = API_URL.replace('/api', '');
const CACHE_KEY = 'platform_logo_url';

export function useLogo() {
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem(CACHE_KEY) || null);

  useEffect(() => {
    fetch(`${API_URL}/admin/settings`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const url = data.logo_url ? `${BASE_URL}${data.logo_url}` : null;
        setLogoUrl(url);
        if (url) localStorage.setItem(CACHE_KEY, url);
        else localStorage.removeItem(CACHE_KEY);
      })
      .catch(() => {});
  }, []);

  return logoUrl;
}
