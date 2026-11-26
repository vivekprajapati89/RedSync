import React from 'react';
import { Info } from 'lucide-react';

export function KpiCard({ label, value, delta, deltaTone = 'neutral', meta, icon: Icon, accent = false }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {Icon && (
          <span className={`kpi-icon ${accent ? 'accent' : ''}`}>
            <Icon size={17} />
          </span>
        )}
      </div>
      <div className="kpi-value">{value}</div>
      {delta && <div className={`kpi-delta ${deltaTone}`}>{delta}</div>}
      {meta && <div className="kpi-meta">{meta}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const normalized = (status || '').toLowerCase();
  let cls = 'badge-neutral';
  if (
    normalized === 'healthy' ||
    normalized === 'operational' ||
    normalized === 'available' ||
    normalized === 'accepted' ||
    normalized === 'completed'
  ) {
    cls = 'badge-healthy';
  } else if (
    normalized === 'low' ||
    normalized === 'moderate' ||
    normalized === 'high demand' ||
    normalized === 'limited capacity' ||
    normalized === 'needs verification' ||
    normalized === 'pending'
  ) {
    cls = 'badge-low';
  } else if (
    normalized === 'critical' ||
    normalized === 'high' ||
    normalized === 'unavailable' ||
    normalized === 'declined'
  ) {
    cls = 'badge-critical';
  } else if (normalized === 'projected shortage' || normalized === 'simulated' || normalized === 'open') {
    cls = 'badge-info';
  }

  return <span className={`badge ${cls}`}>{status}</span>;
}

export function RiskBadge({ riskLevel }) {
  const normalized = (riskLevel || '').toLowerCase();
  let cls = 'badge-healthy';
  if (normalized === 'moderate') cls = 'badge-low';
  if (normalized === 'high' || normalized === 'critical') cls = 'badge-critical';
  return <span className={`badge ${cls}`}>{riskLevel} Risk</span>;
}

export function BloodGroupPill({ group }) {
  return <span className="blood-pill">{group}</span>;
}

export function SimulatedNotice({ title, children }) {
  return (
    <div className="notice-banner" role="note">
      <Info size={18} style={{ color: '#b91c1c', flexShrink: 0, marginTop: 1 }} />
      <div>
        {title && <strong>{title}: </strong>}
        {children}
      </div>
    </div>
  );
}
