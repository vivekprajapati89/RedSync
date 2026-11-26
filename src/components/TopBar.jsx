import React from 'react';
import { Menu, LogOut } from 'lucide-react';

const VIEW_META = {
  overview: {
    title: 'Dashboard',
    subtitle: 'Quick overview of available blood stock, low-stock warnings, and next actions',
  },
  inventory: {
    title: 'Manage Stock',
    subtitle: 'Update available blood units and minimum stock levels for any facility',
  },
  matching: {
    title: 'Find Blood',
    subtitle: 'Search reported stock at other facilities and create a blood request',
  },
  requests: {
    title: 'Requests',
    subtitle: 'Track pending, accepted, declined, and completed prototype requests',
  },
  alerts: {
    title: 'Warnings',
    subtitle: 'Low-stock warnings and possible shortage alerts',
  },
  predictions: {
    title: 'Shortage Risk',
    subtitle: 'Expected 7-day demand and configurable minimum buffer rules',
  },
  analytics: {
    title: 'Usage & Trends',
    subtitle: 'Log blood usage and review 7-day demand patterns',
  },
  network: {
    title: 'Hospitals & Banks',
    subtitle: 'Fictional hospitals and blood banks in this prototype',
  },
};

export default function TopBar({ activeView, onOpenSidebar, userInstitutionName, onSignOut }) {
  const meta = VIEW_META[activeView] || VIEW_META.overview;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onOpenSidebar}
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="page-title">{meta.title}</h1>
          <p className="page-subtitle">{meta.subtitle}</p>
        </div>
      </div>

      <div className="topbar-right">
        <div className="sim-tag" title="Authenticated institution (local prototype stock)">
          <span className="sim-dot" aria-hidden="true" />
          <span>{userInstitutionName || 'Prototype Data'}</span>
        </div>
        {onSignOut && (
          <button type="button" className="btn btn-sm" onClick={onSignOut} title="Sign out">
            <LogOut size={14} /> Sign Out
          </button>
        )}
      </div>
    </header>
  );
}
