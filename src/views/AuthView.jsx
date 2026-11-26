import React, { useState } from 'react';
import { Droplet, Eye, EyeOff, Lock, Mail, User, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

export default function AuthView() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrorMsg('');
    setInfoMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();

    if (mode === 'signup' && trimmedName.length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('Please enter a valid work email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          setErrorMsg(error.message);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: { full_name: trimmedName },
          },
        });
        if (error) {
          setErrorMsg(error.message);
        } else if (!data.session) {
          setInfoMsg(
            'Account created. Please check your email to confirm your address, then sign in.'
          );
        }
      }
    } catch {
      setErrorMsg('Unable to reach local authentication service. Please verify Supabase is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card view-transition">
        <div className="auth-header">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              <Droplet size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div className="brand-name">RedSync</div>
              <div className="brand-tagline">Predict shortages. Connect resources. Save lives.</div>
            </div>
          </div>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="auth-name" className="field-label">Full Name</label>
              <div className="input-wrap">
                <User size={15} className="input-icon" />
                <input
                  id="auth-name"
                  type="text"
                  className="input input-with-icon"
                  style={{ width: '100%' }}
                  placeholder="Dr. Sarah Chen"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email" className="field-label">Work Email</label>
            <div className="input-wrap">
              <Mail size={15} className="input-icon" />
              <input
                id="auth-email"
                type="email"
                className="input input-with-icon"
                style={{ width: '100%' }}
                placeholder="coordinator@hospital.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="auth-password" className="field-label">Password</label>
            <div className="password-wrap">
              <Lock size={15} className="input-icon" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                className="input input-with-icon"
                style={{ width: '100%', paddingRight: 38 }}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="auth-error" role="alert">
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="feedback-banner" role="status" style={{ marginTop: 0 }}>
              <span>{infoMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: 40, marginTop: 4 }}
            disabled={loading}
          >
            {loading
              ? mode === 'login'
                ? 'Signing in...'
                : 'Creating account...'
              : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Local Supabase environment. New accounts require institution registration and coordinator
          approval. Seeded demo accounts (`demo_user`) have isolated access to fictional facilities.
        </div>
      </div>
    </div>
  );
}
