'use client';

import { useEffect, useState } from 'react';
import { api, type Note } from '@/lib/api';
import { clearToken, getToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    api.notes.list().then(setNotes).catch(() => router.replace('/login')).finally(() => setLoading(false));
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const note = await api.notes.create({ title });
    setNotes((prev) => [note, ...prev]);
    setTitle('');
  }

  async function handleDelete(id: string) {
    await api.notes.remove(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  if (loading) return <p>Loading...</p>;

  return (
    <main style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Notes</h1>
        <button onClick={() => { clearToken(); router.replace('/login'); }}>Logout</button>
      </div>

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New note title..."
          style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }}
        />
        <button type="submit">Add</button>
      </form>

      {notes.length === 0 && <p style={{ color: '#888' }}>No notes yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.map((note) => (
          <li
            key={note.id}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', border: '1px solid #eee', borderRadius: 8 }}
          >
            <span>{note.title}</span>
            <button onClick={() => handleDelete(note.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
