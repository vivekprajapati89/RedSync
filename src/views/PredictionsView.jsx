import React from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { TrendingUp, AlertTriangle, ShieldCheck, CalendarClock, SlidersHorizontal } from 'lucide-react';
import { BASE_CHART_OPTIONS } from '../utils/chartSetup';
import {
  BloodGroupPill,
  KpiCard,
  RiskBadge,
  SimulatedNotice,
} from '../components/UiComponents';

export default function PredictionsView({
  summary,
  demandMetrics,
  safetyConfig,
  onUpdateSafetyConfig,
}) {
  const groupForecasts = demandMetrics.bloodGroupForecasts;
  const forecast7d = demandMetrics.forecast7d;

  const groupsWithBuffer = groupForecasts.filter((f) => f.safetyBufferDays !== null);
  const avgBuffer =
    groupsWithBuffer.length > 0
      ? (
          groupsWithBuffer.reduce((sum, f) => sum + f.safetyBufferDays, 0) /
          groupsWithBuffer.length
        ).toFixed(1)
      : '—';

  const demandForecastChart = {
    labels: forecast7d.map((d) => d.day),
    datasets: [
      {
        label: 'Expected Demand (Units/Day)',
        data: forecast7d.map((d) => d.projectedDemand),
        borderColor: '#b91c1c',
        backgroundColor: 'rgba(185, 28, 28, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 3.5,
      },
      {
        label: 'Avg. Stock Added (Units/Day)',
        data: forecast7d.map((d) => d.projectedReplenishment),
        borderColor: '#4b5563',
        borderDash: [5, 4],
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 3.5,
      },
    ],
  };

  const inventoryProjectionChart = {
    labels: forecast7d.map((d) => d.day),
    datasets: [
      {
        label: 'Estimated Future Stock (Units)',
        data: forecast7d.map((d) => d.projectedInventory),
        backgroundColor: forecast7d.map((d) =>
          d.projectedInventory < 2000 ? '#b91c1c' : '#374151'
        ),
        borderRadius: 4,
      },
    ],
  };

  return (
    <>
      <SimulatedNotice title="Estimated Projections Only">
        All predictions below are transparent estimates calculated from current prototype stock (
        {summary.totalUnits.toLocaleString()} units) and logged 7-day consumption records (
        {demandMetrics.estDailyDemand} units/day est. demand vs.{' '}
        {demandMetrics.avgDailyReplenishment} units/day avg. replenishment). They are not clinical
        forecasts.
      </SimulatedNotice>

      <section className="kpi-grid">
        <KpiCard
          label="Expected 7-Day Demand"
          value={`${summary.forecasted7dDemand.toLocaleString()} units`}
          delta={`${summary.demandDelta >= 0 ? '+' : ''}${summary.demandDelta} units (${summary.demandDeltaPct}%) vs. logged 7d (${summary.past7dDemand.toLocaleString()})`}
          deltaTone="warn"
          meta={`${demandMetrics.estDailyDemand} units/day average`}
          icon={TrendingUp}
          accent
        />
        <KpiCard
          label="Possible Shortages"
          value={`${summary.bloodGroupsAtRisk} of 8 groups`}
          delta={`${summary.highRiskGroupsCount} High Risk · ${summary.moderateRiskGroupsCount} Moderate Risk`}
          deltaTone={summary.bloodGroupsAtRisk > 0 ? 'danger' : 'positive'}
          meta={
            summary.atRiskGroupNames.length > 0
              ? `Flagged: ${summary.atRiskGroupNames.join(', ')}`
              : 'No groups flagged'
          }
          icon={AlertTriangle}
          accent
        />
        <KpiCard
          label="Avg. Estimated Buffer"
          value={`${avgBuffer} days`}
          delta={`High < ${safetyConfig.highRiskBufferDays}d · Moderate < ${safetyConfig.moderateRiskBufferDays}d`}
          deltaTone="neutral"
          meta="Current stock / est. daily demand"
          icon={CalendarClock}
        />
        <KpiCard
          label="Estimation Basis"
          value="7-Day Avg"
          delta="Live prototype calculation"
          deltaTone="neutral"
          meta="Updates with inventory & consumption"
          icon={ShieldCheck}
        />
      </section>

      {/* Configurable Safety Thresholds */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Configurable Shortage Detection Thresholds</h2>
            <p className="panel-subtitle">
              Adjust safety buffer rules to immediately recalculate blood-group risk levels and
              projected shortage alerts
            </p>
          </div>
          <SlidersHorizontal size={17} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div className="panel-body">
          <div className="grid-3">
            <div className="field">
              <label htmlFor="cfg-high-days" className="field-label">
                High Risk Buffer (&lt; Days)
              </label>
              <input
                id="cfg-high-days"
                type="number"
                step="0.5"
                min={1}
                max={14}
                className="input"
                value={safetyConfig.highRiskBufferDays}
                onChange={(e) =>
                  onUpdateSafetyConfig({
                    highRiskBufferDays: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="cfg-mod-days" className="field-label">
                Moderate Risk Buffer (&lt; Days)
              </label>
              <input
                id="cfg-mod-days"
                type="number"
                step="0.5"
                min={1}
                max={21}
                className="input"
                value={safetyConfig.moderateRiskBufferDays}
                onChange={(e) =>
                  onUpdateSafetyConfig({
                    moderateRiskBufferDays: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="cfg-crit-sites" className="field-label">
                High Risk Critical Sites (&ge; Sites)
              </label>
              <input
                id="cfg-crit-sites"
                type="number"
                min={1}
                max={6}
                className="input"
                value={safetyConfig.highRiskCriticalSites}
                onChange={(e) =>
                  onUpdateSafetyConfig({
                    highRiskCriticalSites: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">7-Day Estimated Demand vs. Replenishment</h2>
              <p className="panel-subtitle">
                Estimated daily demand ({demandMetrics.estDailyDemand}u) vs. avg replenishment (
                {demandMetrics.avgDailyReplenishment}u)
              </p>
            </div>
            <span className="badge badge-info">Estimate</span>
          </div>
          <div className="panel-body">
            <div className="chart-box">
              <Line
                data={demandForecastChart}
                options={{
                  ...BASE_CHART_OPTIONS,
                  scales: {
                    y: {
                      beginAtZero: false,
                      title: { display: true, text: 'Units / Day', color: '#6b7280', font: { size: 11 } },
                      grid: { color: '#f3f4f6' },
                    },
                    x: { grid: { display: false } },
                  },
                }}
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Estimated Future Stock Trajectory</h2>
              <p className="panel-subtitle">
                Formula: Current ({summary.totalUnits.toLocaleString()}u) + (Replenishment − Demand) × Days
              </p>
            </div>
            <span className="badge badge-info">Estimate</span>
          </div>
          <div className="panel-body">
            <div className="chart-box">
              <Bar
                data={inventoryProjectionChart}
                options={{
                  ...BASE_CHART_OPTIONS,
                  plugins: {
                    ...BASE_CHART_OPTIONS.plugins,
                    tooltip: {
                      ...BASE_CHART_OPTIONS.plugins.tooltip,
                      callbacks: {
                        label: (ctx) => ` Estimated Stock: ${ctx.parsed.y.toLocaleString()} units`,
                        afterLabel: (ctx) => {
                          const step = forecast7d[ctx.dataIndex];
                          return ` Daily Net Change: ${step.netChange >= 0 ? '+' : ''}${step.netChange} units`;
                        },
                      },
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: false,
                      title: { display: true, text: 'Total Units', color: '#6b7280', font: { size: 11 } },
                      grid: { color: '#f3f4f6' },
                    },
                    x: { grid: { display: false } },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Blood Group-Specific Estimates & Risk Rationale</h2>
            <p className="panel-subtitle">
              Calculated directly from live prototype stock, consumption rates, and safety thresholds
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Blood Group</th>
                <th>Current Stock</th>
                <th>Avg. Daily Usage</th>
                <th>Est. 7d Demand</th>
                <th>7-Day Trend</th>
                <th>Est. Buffer</th>
                <th>Risk Level</th>
                <th>Flagging Rationale</th>
              </tr>
            </thead>
            <tbody>
              {groupForecasts.map((row) => (
                <tr key={row.bloodGroup}>
                  <td>
                    <BloodGroupPill group={row.bloodGroup} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{row.totalUnits} units</td>
                  <td>{row.avgDailyDemand} units/day</td>
                  <td style={{ fontWeight: 600 }}>{row.projected7dDemand} units</td>
                  <td style={{ color: row.trend.startsWith('+') ? '#b91c1c' : '#065f46', fontWeight: 600 }}>
                    {row.trend}
                  </td>
                  <td>{row.safetyBufferDays !== null ? `${row.safetyBufferDays} days` : '—'}</td>
                  <td>
                    <RiskBadge riskLevel={row.riskLevel} />
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 300 }}>
                    {row.riskReason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
