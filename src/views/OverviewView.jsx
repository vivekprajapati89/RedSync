import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  ArrowRight,
  PlusCircle,
  Search,
  ClipboardList,
} from 'lucide-react';
import { BASE_CHART_OPTIONS } from '../utils/chartSetup';
import {
  BloodGroupPill,
  RiskBadge,
  SimulatedNotice,
  StatusBadge,
} from '../components/UiComponents';

export default function OverviewView({
  summary,
  demandMetrics,
  institutions,
  alerts,
  pendingRequestCount,
  onNavigate,
  onFindBloodForGroup,
}) {
  const groupTotals = demandMetrics.bloodGroupForecasts;
  const recentAlerts = alerts.slice(0, 4);
  const atRiskForecasts = groupTotals.filter((f) => f.riskLevel !== 'Low');

  const demandTrendData = {
    labels: demandMetrics.dailyHistory.map((d) => d.day),
    datasets: [
      {
        label: 'Blood Used (Units)',
        data: demandMetrics.dailyHistory.map((d) => d.demand),
        borderColor: '#9f1239',
        backgroundColor: 'rgba(159, 18, 57, 0.07)',
        fill: true,
        tension: 0.32,
        pointRadius: 3.5,
      },
      {
        label: 'Stock Added (Units)',
        data: demandMetrics.dailyHistory.map((d) => d.supplyReplenished),
        borderColor: '#57534e',
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        tension: 0.32,
        pointRadius: 3.5,
      },
    ],
  };

  return (
    <>
      <SimulatedNotice title="Prototype Mode">
        Connected to local Supabase using fictional hospitals and simulated transfers. Not a
        clinical or real-world hospital system.
      </SimulatedNotice>

      {/* 1. Editorial Hero: How much stock do we have? + What action can I take? */}
      <section className="hero-panel stagger-1" aria-label="Network inventory summary">
        <div className="hero-top">
          <div>
            <div className="hero-eyebrow">Available Network Inventory</div>
            <div className="hero-metric-row">
              <span className="hero-number">{summary.totalUnits.toLocaleString()}</span>
              <span className="hero-unit">units across {summary.connectedInstitutions} facilities</span>
            </div>
            <p className="hero-sub">
              {summary.totalUnits === 0
                ? 'No stock recorded yet — click Update Stock to add your facility inventory.'
                : `${summary.unitsDelta >= 0 ? '+' : ''}${summary.unitsDelta} units (${summary.unitsDeltaPct}%) vs. prior 7 days · Expected 7-day demand: `}
              {summary.totalUnits > 0 && (
                <strong>{summary.forecasted7dDemand.toLocaleString()} units</strong>
              )}
            </p>
          </div>

          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate('inventory')}
            >
              <PlusCircle size={16} /> Update Stock
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('matching')}
            >
              <Search size={15} /> Find Blood
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate('requests')}
            >
              <ClipboardList size={15} /> Requests ({pendingRequestCount})
            </button>
          </div>
        </div>

        {/* 8 Blood Groups at a glance */}
        <div className="blood-strip" aria-label="Stock by blood group">
          {groupTotals.map((g) => {
            const tileClass =
              g.riskLevel === 'High'
                ? 'risk-high'
                : g.riskLevel === 'Moderate'
                  ? 'risk-moderate'
                  : '';
            const dotClass =
              g.riskLevel === 'High'
                ? 'high'
                : g.riskLevel === 'Moderate'
                  ? 'moderate'
                  : '';
            return (
              <div key={g.bloodGroup} className={`blood-tile ${tileClass}`}>
                <div className="blood-tile-top">
                  <span className="blood-tile-group">{g.bloodGroup}</span>
                  <span
                    className={`status-dot ${dotClass}`}
                    title={`${g.riskLevel} Risk`}
                    aria-label={`${g.riskLevel} Risk`}
                  />
                </div>
                <div className="blood-tile-units">{g.totalUnits}</div>
                <div className="blood-tile-days">
                  {g.safetyBufferDays !== null ? `~${g.safetyBufferDays}d supply` : 'No usage data'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Needs Attention Right Now: Possible Shortages + Recent Warnings */}
      <section className="attention-grid stagger-2" aria-label="Items needing attention">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                Needs Attention ({atRiskForecasts.length} blood groups)
              </h2>
              <p className="panel-subtitle">
                Possible shortages based on current stock and recent daily usage
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onNavigate('predictions')}
            >
              Thresholds <ArrowRight size={14} />
            </button>
          </div>
          <div className="panel-body">
            {atRiskForecasts.length === 0 ? (
              <p style={{ color: '#065f46', fontWeight: 500 }}>
                All 8 blood groups are above minimum stock levels with healthy supply buffers.
              </p>
            ) : (
              <div className="list-stack">
                {atRiskForecasts.map((item) => (
                  <div className="list-row" key={item.bloodGroup}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <BloodGroupPill group={item.bloodGroup} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                          {item.totalUnits} units available ·{' '}
                          {item.safetyBufferDays !== null
                            ? `~${item.safetyBufferDays} days left`
                            : 'No 7d usage logged'}
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {item.lowOrCriticalCount} of {institutions.length} facilities below
                          minimum stock level. Expected 7-day demand: {item.projected7dDemand} units.
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <RiskBadge riskLevel={item.riskLevel} />
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() =>
                          onFindBloodForGroup
                            ? onFindBloodForGroup(item.bloodGroup)
                            : onNavigate('matching')
                        }
                      >
                        Find Blood
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Recent Warnings ({summary.totalAlerts})</h2>
              <p className="panel-subtitle">Facilities below minimum stock level</p>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onNavigate('alerts')}
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="panel-body">
            <div className="list-stack">
              {recentAlerts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No active warnings.</p>
              ) : (
                recentAlerts.map((alert) => (
                  <div className="list-row" key={alert.id}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <StatusBadge status={alert.priority} />
                        <BloodGroupPill group={alert.bloodGroup} />
                        <strong style={{ fontSize: 13.5 }}>{alert.institutionName}</strong>
                      </div>
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {alert.message}
                      </p>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {alert.timestamp}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Simple Stock Overview + Compact Demand Visualization */}
      <section className="grid-2 stagger-3">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Stock vs. Minimum Level</h2>
              <p className="panel-subtitle">Current units compared to combined minimum stock levels</p>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onNavigate('inventory')}
            >
              Update Stock <ArrowRight size={14} />
            </button>
          </div>
          <div className="panel-body">
            <div className="list-stack">
              {groupTotals.map((g) => {
                const ratio = Math.min(
                  100,
                  Math.round((g.totalUnits / Math.max(1, g.totalThreshold * 1.6)) * 100)
                );
                const barClass =
                  g.riskLevel === 'High' ? '' : g.riskLevel === 'Moderate' ? 'low' : 'healthy';
                return (
                  <div
                    className="list-row"
                    key={g.bloodGroup}
                    style={{ flexDirection: 'column', gap: 6 }}
                  >
                    <div
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BloodGroupPill group={g.bloodGroup} />
                        <span className="tabular" style={{ fontWeight: 600 }}>
                          {g.totalUnits} units
                        </span>
                      </div>
                      <span className="tabular" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Min level: {g.totalThreshold} • {g.lowOrCriticalCount} low sites
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className={`progress-fill ${barClass}`} style={{ width: `${ratio}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">7-Day Usage vs. Stock Added</h2>
              <p className="panel-subtitle">
                Used {summary.past7dDemand.toLocaleString()} units · Added{' '}
                {summary.past7dReplenished.toLocaleString()} units
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onNavigate('analytics')}
            >
              Usage & Trends <ArrowRight size={14} />
            </button>
          </div>
          <div className="panel-body">
            <div className="chart-box-tall">
              <Line
                data={demandTrendData}
                options={{
                  ...BASE_CHART_OPTIONS,
                  animation: { duration: 450 },
                  scales: {
                    y: {
                      beginAtZero: false,
                      title: { display: true, text: 'Units / Day', color: '#78716c', font: { size: 11 } },
                      grid: { color: '#f5f4f1' },
                    },
                    x: { grid: { display: false } },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
