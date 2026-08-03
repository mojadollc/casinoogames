import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3020/api';
const BASE_URL = API_URL.replace('/api', '');
const CACHE_KEY = 'platform_logo_url';

export function useLogo() {
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem(CACHE_KEY) || null);

  useEffect(() => {
    adminAPI.getSettings()
      .then(({ data }) => {
        const url = data.logo_url ? `${BASE_URL}${data.logo_url}` : null;
        setLogoUrl(url);
        if (url) localStorage.setItem(CACHE_KEY, url);
        else localStorage.removeItem(CACHE_KEY);
      })
      .catch(() => {});
  }, []);

  return logoUrl;
}
