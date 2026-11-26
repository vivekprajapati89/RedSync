import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  Search,
  ClipboardList,
  TrendingUp,
  Building2,
  BarChart3,
  Bell,
  Droplet,
  ShieldAlert,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export const PRIMARY_NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Manage Stock', icon: Boxes },
  { id: 'matching', label: 'Find Blood', icon: Search },
  { id: 'requests', label: 'Requests', icon: ClipboardList },
];

export const SECONDARY_NAV_ITEMS = [
  { id: 'alerts', label: 'Warnings', icon: Bell },
  { id: 'predictions', label: 'Shortage Risk', icon: TrendingUp },
  { id: 'analytics', label: 'Usage & Trends', icon: BarChart3 },
  { id: 'network', label: 'Hospitals & Banks', icon: Building2 },
];

export default function Sidebar({
  activeView,
  onSelectView,
  alertCount,
  pendingRequestCount,
  onResetDemoData,
  isOpen,
  onClose,
  collapsed,
  onToggleCollapse,
}) {
  const renderNavButton = (item) => {
    const Icon = item.icon;
    const isActive = activeView === item.id;
    const badgeCount =
      item.id === 'alerts'
        ? alertCount
        : item.id === 'requests'
          ? pendingRequestCount
          : 0;

    return (
      <button
        key={item.id}
        type="button"
        className={`nav-item ${isActive ? 'active' : ''}`}
        title={collapsed ? item.label : undefined}
        onClick={() => {
          onSelectView(item.id);
          onClose();
        }}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className="nav-item-left">
          <Icon size={17} />
          <span className="nav-label-text">{item.label}</span>
        </span>
        {badgeCount > 0 && (
          <span className="nav-badge" aria-label={`${badgeCount} items`}>
            {badgeCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <div
        className={`sidebar-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} aria-label="Primary Navigation">
        <div className="sidebar-header">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              <Droplet size={18} strokeWidth={2.2} />
            </div>
            <div className="brand-text">
              <div className="brand-name">RedSync</div>
              <div className="brand-tagline">Predict shortages. Connect resources. Save lives.</div>
            </div>
          </div>

          <button
            type="button"
            className="collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Workspace</div>
          {PRIMARY_NAV_ITEMS.map(renderNavButton)}

          <div className="nav-section-label" style={{ marginTop: 14 }}>
            Insights & Setup
          </div>
          {SECONDARY_NAV_ITEMS.map(renderNavButton)}
        </nav>

        <div className="sidebar-footer">
          <div className="prototype-pill">
            <ShieldAlert size={15} style={{ color: '#9f1239', flexShrink: 0, marginTop: 1 }} />
            <span>
              <strong>Local Supabase Prototype:</strong> Fictional facilities &amp; simulated
              transfers. Not connected to real hospitals.
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
