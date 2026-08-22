"use client";

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';
import { Download, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useAuth } from '../../providers/auth-provider';
import { getAuthRedirectUrl } from '../../lib/auth-url';

const loginSchema = z.object({
  email: z.string().email('Masukkan email yang sah'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
});

const registerSchema = z.object({
  email: z.string().email('Masukkan email yang sah'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
  name: z.string().min(2, 'Nama minimal 2 karakter'),
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

type Mode = 'login' | 'register';

const WINDOWS_CLIENT_DOWNLOAD_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663906187068/HUIHFNNfbfCvXjmO.zip';

export default function LoginPage() {
  const router = useRouter();
  const { supabase } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loginForm = useForm<LoginData>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackError = params.get('error');
    if (callbackError === 'otp_expired') {
      setError('Link konfirmasi sudah kedaluwarsa atau sudah pernah digunakan. Silakan daftar ulang atau minta email konfirmasi baru.');
    } else if (callbackError === 'verification_failed') {
      setError('Konfirmasi email gagal. Gunakan email terbaru dan pastikan link belum dibuka oleh aplikasi pemindai email.');
    } else if (callbackError === 'config') {
      setError('Konfigurasi autentikasi produksi belum lengkap.');
    }

    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace('/dashboard');
    })();
  }, [supabase, router]);

  const setSession = async (session: { access_token: string; refresh_token: string; expires_in?: number }) => {
    try {
      await fetch('/api/auth/setSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      });
    } catch {
      // ignore cookie set errors
    }
  };

  const onLogin = async (values: LoginData) => {
    if (!supabase) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await supabase.auth.signInWithPassword(values);
      if (res.error) {
        setError(res.error.message);
        return;
      }
      if (res.data.session) {
        await setSession({
          access_token: res.data.session.access_token,
          refresh_token: res.data.session.refresh_token,
          expires_in: res.data.session.expires_in,
        });
      }
      router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (values: RegisterData) => {
    if (!supabase) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const redirectTo = getAuthRedirectUrl('/auth/callback');
      const res = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { name: values.name },
          emailRedirectTo: redirectTo,
        },
      });
      if (res.error) {
        setError(res.error.message);
        return;
      }
      if (res.data.session) {
        await setSession({
          access_token: res.data.session.access_token,
          refresh_token: res.data.session.refresh_token,
          expires_in: res.data.session.expires_in,
        });
        router.replace('/dashboard');
      } else {
        setSuccess('Pendaftaran berhasil! Silakan cek email Anda untuk konfirmasi. Setelah verifikasi, Anda dapat login.');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setSuccess(null);
  };

  const isLogin = mode === 'login';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-3">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">SchoolDMS</h1>
          <p className="text-sm text-foreground-muted mt-1">
            {isLogin ? 'Masuk ke akun Anda' : 'Buat akun baru'}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-1 rounded-md bg-surface-active p-1 border border-border mb-6">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={cn(
                'flex-1 py-1.5 text-sm rounded-sm transition-colors',
                isLogin ? 'bg-primary text-primary-foreground' : 'text-foreground-muted hover:text-foreground',
              )}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={cn(
                'flex-1 py-1.5 text-sm rounded-sm transition-colors',
                !isLogin ? 'bg-primary text-primary-foreground' : 'text-foreground-muted hover:text-foreground',
              )}
            >
              Daftar
            </button>
          </div>

          {success && (
            <div className="mb-4 rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-sm text-success">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          {isLogin ? (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-faint" />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="nama@sekolah.ac.id"
                    {...loginForm.register('email')}
                    className="w-full h-10 rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="mt-1 text-2xs text-danger">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Kata Sandi</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-faint" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...loginForm.register('password')}
                    className="w-full h-10 rounded-md border border-border bg-surface pl-9 pr-10 text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-faint hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="mt-1 text-2xs text-danger">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Masuk
              </button>
            </form>
          ) : (
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nama Lengkap</label>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Nama Anda"
                  {...registerForm.register('name')}
                  className="w-full h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {registerForm.formState.errors.name && (
                  <p className="mt-1 text-2xs text-danger">{registerForm.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-faint" />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="nama@sekolah.ac.id"
                    {...registerForm.register('email')}
                    className="w-full h-10 rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                {registerForm.formState.errors.email && (
                  <p className="mt-1 text-2xs text-danger">{registerForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Kata Sandi</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-faint" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...registerForm.register('password')}
                    className="w-full h-10 rounded-md border border-border bg-surface pl-9 pr-10 text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-faint hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {registerForm.formState.errors.password && (
                  <p className="mt-1 text-2xs text-danger">{registerForm.formState.errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Daftar
              </button>
            </form>
          )}
        </div>

        <a
          href={WINDOWS_CLIENT_DOWNLOAD_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Download className="h-4 w-4" />
          Unduh Windows Sync Client
          <span className="text-2xs text-foreground-faint">(ZIP)</span>
        </a>

        <p className="text-center text-2xs text-foreground-faint mt-6">
          © {new Date().getFullYear()} SchoolDMS — Sistem Manajemen Dokumen Sekolah
        </p>
      </div>
    </div>
  );
}
