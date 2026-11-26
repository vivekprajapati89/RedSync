import React, { useState } from 'react';
import {
  Droplet,
  Building2,
  Clock,
  XCircle,
  ShieldAlert,
  RefreshCw,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { StatusBadge } from '../components/UiComponents';

const INSTITUTION_TYPES = [
  'Regional Blood Bank',
  'Trauma Center',
  'General Hospital',
  'Specialty Hospital',
];

export default function OnboardingView({
  profile,
  institution,
  onRefreshStatus,
  onSignOut,
  refreshing,
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState(INSTITUTION_TYPES[0]);
  const [location, setLocation] = useState('');
  const [contactName, setContactName] = useState(profile?.full_name || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (name.trim().length < 3) {
      setErrorMsg('Institution name must be at least 3 characters.');
      return;
    }
    if (location.trim().length < 3) {
      setErrorMsg('Location must be at least 3 characters.');
      return;
    }
    if (contactName.trim().length < 2) {
      setErrorMsg('Please enter a contact person name.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('register_institution', {
        p_name: name.trim(),
        p_type: type,
        p_location: location.trim(),
        p_contact_name: contactName.trim(),
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        await onRefreshStatus();
      }
    } catch {
      setErrorMsg('Failed to register institution. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatusState = () => {
    const status = institution.approval_status;

    if (status === 'pending') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={22} style={{ color: '#92400e', flexShrink: 0 }} />
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Pending Coordinator Approval</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Your institution registration has been submitted and is awaiting review.
              </p>
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: 13,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{institution.name}</strong>
              <StatusBadge status="Pending" />
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              {institution.type} · {institution.location}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              Contact: {profile?.full_name} ({profile?.email}) · Assigned role: {profile?.role}
            </div>
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            Access to blood inventory management and network requests remains locked until a network
            coordinator approves this institution.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onRefreshStatus}
              disabled={refreshing}
            >
              <RefreshCw size={14} /> {refreshing ? 'Checking...' : 'Refresh Status'}
            </button>
            <button type="button" className="btn" onClick={onSignOut}>
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      );
    }

    const isRejected = status === 'rejected';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isRejected ? (
            <XCircle size={22} style={{ color: '#991b1b', flexShrink: 0 }} />
          ) : (
            <ShieldAlert size={22} style={{ color: '#991b1b', flexShrink: 0 }} />
          )}
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>
              {isRejected ? 'Institution Registration Declined' : 'Institution Access Suspended'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {isRejected
                ? 'This institution registration was not approved for network access.'
                : 'Access for this institution has been temporarily suspended by a coordinator.'}
            </p>
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--status-critical-bg)',
            border: '1px solid var(--status-critical-border)',
            fontSize: 13,
          }}
        >
          <strong>{institution.name}</strong> ({institution.type}) · Status:{' '}
          <strong style={{ textTransform: 'capitalize' }}>{status}</strong>
        </div>

        <div>
          <button type="button" className="btn" onClick={onSignOut}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="auth-shell">
      <div className="auth-card view-transition" style={{ maxWidth: 500 }}>
        <div className="auth-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              <Droplet size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div className="brand-name">RedSync</div>
              <div className="brand-tagline">Institution Onboarding</div>
            </div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{profile?.email}</span>
        </div>

        {institution ? (
          <div style={{ padding: '22px 24px' }}>{renderStatusState()}</div>
        ) : (
          <form onSubmit={handleRegister} className="auth-form">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Building2 size={18} style={{ color: 'var(--brand-primary)' }} />
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Register Your Institution</h2>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  New registrations are submitted for coordinator approval before access is granted.
                </p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="reg-inst-name" className="field-label">Institution Name</label>
              <input
                id="reg-inst-name"
                type="text"
                className="input"
                placeholder="e.g., Riverside Community Hospital"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="field">
              <label htmlFor="reg-inst-type" className="field-label">Institution Type</label>
              <select
                id="reg-inst-type"
                className="select"
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={submitting}
              >
                {INSTITUTION_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="reg-inst-location" className="field-label">Location</label>
              <input
                id="reg-inst-location"
                type="text"
                className="input"
                placeholder="e.g., North District, Building B"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="field">
              <label htmlFor="reg-contact-name" className="field-label">Contact Person&apos;s Name</label>
              <input
                id="reg-contact-name"
                type="text"
                className="input"
                placeholder="e.g., Dr. Sarah Chen"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                disabled={submitting}
              />
            </div>

            {errorMsg && (
              <div className="auth-error" role="alert">
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, height: 40 }}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </button>
              <button type="button" className="btn" style={{ height: 40 }} onClick={onSignOut}>
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
