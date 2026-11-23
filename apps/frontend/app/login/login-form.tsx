'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { setStoredAuth } from '@/lib/auth';
import { Alert, Button, Input } from '@repo/ui';

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    orgId: string | null;
  };
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setStoredAuth(result);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка входу. Перевірте дані.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="ім'я@example.com"
        required
      />
      <Input
        label="Пароль"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Ваш пароль"
        required
      />
      {error && <Alert severity="danger">{error}</Alert>}
      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
        Увійти
      </Button>
    </form>
  );
}
