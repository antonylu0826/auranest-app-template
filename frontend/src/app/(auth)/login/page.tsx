'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { isOidc, loginLocal, redirectToOidc, registerLocal, setToken } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');

  if (isOidc) {
    return (
      <main style={{ maxWidth: 360, margin: '80px auto', textAlign: 'center' }}>
        <h1>Sign in</h1>
        <button onClick={redirectToOidc} style={{ padding: '10px 24px', marginTop: 16 }}>
          Continue with SSO
        </button>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const token =
        mode === 'login'
          ? await loginLocal(email, password)
          : await registerLocal(email, password, name || undefined);
      setToken(token);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
      <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mode === 'register' && (
          <input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
        )}
        <input type="email" placeholder="Email" required value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
        <input type="password" placeholder="Password" required value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
        <button type="submit" style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          {mode === 'login' ? 'Sign in' : 'Register'}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          style={{ background: 'none', border: 'none', color: '#0070f3', cursor: 'pointer' }}>
          {mode === 'login' ? 'Register' : 'Sign in'}
        </button>
      </p>
    </main>
  );
}
