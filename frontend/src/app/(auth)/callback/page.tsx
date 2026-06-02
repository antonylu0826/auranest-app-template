'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { setToken } from '@/lib/auth';

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) { router.replace('/login'); return; }

    const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    fetch(`${API}/auth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri: `${window.location.origin}/callback` }),
    })
      .then((r) => r.json())
      .then((data: { token: string }) => {
        setToken(data.token);
        router.replace('/');
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  return <p style={{ textAlign: 'center', marginTop: 80 }}>Signing in...</p>;
}
