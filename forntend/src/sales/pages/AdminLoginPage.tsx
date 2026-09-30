import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import synovLogo from '../assets.png';
import { setStoredAuth } from '@/lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      setIsSubmitting(true);
      setError('');

      const response = await axios.post(`${API_BASE_URL}/auth/admin-login`, {
        email: email.trim(),
        password,
      });

      if (response.data?.success) {
        setStoredAuth({ token: response.data.token, user: response.data.user }, rememberMe);
        navigate('/sales/dashboard', { replace: true });
        return;
      }

      setError(response?.data?.message || 'Invalid email or password.');
      return;
    } catch (apiError) {
      if (axios.isAxiosError(apiError)) {
        const message = apiError.response?.data?.message;

        if (apiError.code === 'ERR_NETWORK' || !apiError.response) {
          setError('Unable to connect to the server. Please try again.');
          return;
        }

        if (message) {
          setError(message);
          return;
        }
      }

      setError('Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[420px] rounded-lg border border-sidebar-border bg-card p-8 shadow-[0_20px_45px_rgba(31,29,26,0.06)]">
        <div className="mb-8 flex flex-col items-center">
          <img src={synovLogo} alt="Synov IT Services logo" className="h-16 w-auto object-contain" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="admin-email" className="mb-2 block text-sm font-medium text-foreground">Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="crm-input"
              placeholder="admin@synov.in"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-2 block text-sm font-medium text-foreground">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="crm-input"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <label className="inline-flex items-center gap-2 text-muted-foreground">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              Remember me
            </label>

            <button type="button" className="font-medium text-foreground hover:text-muted-foreground">
              Forgot password?
            </button>
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
