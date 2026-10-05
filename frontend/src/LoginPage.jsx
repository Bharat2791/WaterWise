import { useState } from 'react';
import axios from 'axios';
import { ArrowRight, Droplets, Eye, EyeOff, ShieldCheck, Users, Waves } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const authApi = axios.create({ baseURL: API_BASE });

const profiles = [
  {
    id: 'citizen',
    title: 'Complaint giver',
    detail: 'Register to report a water-supply issue and track your submitted complaints.',
    icon: Users,
  },
  {
    id: 'receiver',
    title: 'Complaint receiver',
    detail: 'Register to review reports and city operations.',
    icon: ShieldCheck,
  },
];

function responseError(error) {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(' ');
  return 'Unable to reach the account service. Check that the backend is running and try again.';
}

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('receiver');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  }

  function changeRole(nextRole) {
    setRole(nextRole);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (mode === 'register' && password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        await authApi.post('/api/auth/register', { email, password, role });
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setNotice('Registration successful. Sign in using the email and password you just registered.');
        return;
      }

      const response = await authApi.post('/api/auth/login', { email, password, role });
      onLogin({
        role: response.data.user.role,
        email: response.data.user.email,
        token: response.data.access_token,
      });
    } catch (requestError) {
      setError(responseError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass = 'mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15';

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06101f] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_45%,rgba(6,182,212,0.18),transparent_42%),radial-gradient(ellipse_at_18%_80%,rgba(37,99,235,0.13),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-600 shadow-xl shadow-cyan-900/40">
              <Droplets className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-white">WATERWISE AI</p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/60">Water Intelligence Platform</p>
            </div>
          </div>
          <div className="mt-20 max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-300/5 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-cyan-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              Municipal water intelligence
            </p>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.12] tracking-tight text-white xl:text-6xl">
              Every report can help protect a <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">community.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300/80">
              Report local water issues or use municipal intelligence to coordinate an informed response.
            </p>
          </div>
          <div className="mt-12 grid max-w-xl grid-cols-3 gap-3">
            {[['01', 'Capture reports'], ['02', 'Understand patterns'], ['03', 'Prioritize response']].map(([number, label]) => (
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 backdrop-blur" key={number}>
                <p className="text-xs font-semibold tracking-widest text-cyan-300">{number}</p>
                <p className="mt-2 text-sm text-slate-300">{label}</p>
              </div>
            ))}
          </div>
          <div className="absolute bottom-8 left-10 flex items-center gap-2 text-xs text-slate-500">
            <Waves className="h-4 w-4 text-cyan-400/70" />
            LIVE INTAKE · Reports are submitted or imported into this workspace
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-sky-600">
              <Droplets className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold tracking-tight text-white">WATERWISE AI</p>
              <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400">Water Intelligence Platform</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/85 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Account access</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
              <p className="mt-1 text-sm text-slate-400">{mode === 'register' ? 'Register with your own email and password.' : 'Sign in with the credentials you registered.'}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3" role="group" aria-label="Choose account type">
              {profiles.map(({ id, title, detail, icon: Icon }) => (
                <button
                  aria-pressed={role === id}
                  className={`rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-400/60 ${role === id ? 'border-cyan-400/60 bg-cyan-400/10 shadow-lg shadow-cyan-950/30' : 'border-slate-700 bg-slate-950/50 hover:border-slate-500'}`}
                  key={id}
                  onClick={() => changeRole(id)}
                  type="button"
                >
                  <Icon className={`h-5 w-5 ${role === id ? 'text-cyan-300' : 'text-slate-400'}`} />
                  <p className="mt-3 text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 min-h-10 text-[11px] leading-relaxed text-slate-400">{detail}</p>
                </button>
              ))}
            </div>

            <div className="mt-5 flex rounded-xl border border-slate-700 bg-slate-950/60 p-1" role="tablist" aria-label="Account action">
              {['login', 'register'].map((tab) => (
                <button
                  aria-selected={mode === tab}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize transition ${mode === tab ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  key={tab}
                  onClick={() => changeMode(tab)}
                  role="tab"
                  type="button"
                >
                  {tab === 'login' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>

            <form className="mt-5 space-y-4" onSubmit={submit}>
              <label className="block text-sm font-medium text-slate-300" htmlFor="account-email">
                Email
                <input autoComplete="email" className={fieldClass} id="account-email" maxLength={320} onChange={(event) => { setEmail(event.target.value); setError(''); setNotice(''); }} required type="email" value={email} />
              </label>

              <label className="block text-sm font-medium text-slate-300" htmlFor="account-password">
                Password
                <span className="relative mt-2 block">
                  <input autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className={`${fieldClass} pr-12`} id="account-password" maxLength={128} minLength={mode === 'register' ? 12 : 1} onChange={(event) => { setPassword(event.target.value); setError(''); setNotice(''); }} required type={showPassword ? 'text' : 'password'} value={password} />
                  <button aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-white" onClick={() => setShowPassword((visible) => !visible)} type="button">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
                {mode === 'register' && <span className="mt-1 block text-xs font-normal text-slate-500">Use at least 12 characters.</span>}
              </label>

              {mode === 'register' && (
                <>
                  <label className="block text-sm font-medium text-slate-300" htmlFor="confirm-password">
                    Confirm password
                    <input autoComplete="new-password" className={fieldClass} id="confirm-password" maxLength={128} minLength={12} onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }} required type={showPassword ? 'text' : 'password'} value={confirmPassword} />
                  </label>
                </>
              )}

              {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">{error}</p>}
              {notice && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200" role="status">{notice}</p>}

              <button className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/40 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-300/60 disabled:cursor-wait disabled:opacity-70" disabled={submitting} type="submit">
                {submitting ? 'Please wait…' : mode === 'register' ? 'Create account' : `Sign in as ${role === 'citizen' ? 'complaint giver' : 'complaint receiver'}`}
                {!submitting && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
              </button>
            </form>
          </div>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
            Passwords are stored as one-way hashes. Use HTTPS in production.
          </p>
        </section>
      </div>
    </main>
  );
}
