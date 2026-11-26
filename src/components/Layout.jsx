import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout({
  activeView,
  onSelectView,
  alertCount,
  pendingRequestCount,
  onResetDemoData,
  userInstitutionName,
  onSignOut,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        activeView={activeView}
        onSelectView={onSelectView}
        alertCount={alertCount}
        pendingRequestCount={pendingRequestCount}
        onResetDemoData={onResetDemoData}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />
      <div className="main-area">
        <TopBar
          activeView={activeView}
          onOpenSidebar={() => setSidebarOpen(true)}
          userInstitutionName={userInstitutionName}
          onSignOut={onSignOut}
        />
        <main className="content-container">{children}</main>
      </div>
    </div>
  );
}
