import React, { useEffect, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { PlusCircle, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BLOOD_GROUPS, DEPARTMENTS } from '../data/mockData';
import { formatLocalDateISO } from '../services/consumptionService';
import { BASE_CHART_OPTIONS, BLOOD_GROUP_COLORS } from '../utils/chartSetup';
import { BloodGroupPill, RiskBadge, SimulatedNotice } from '../components/UiComponents';

export default function AnalyticsView({
  summary,
  demandMetrics,
  consumptionRecords,
  liveInstitutions,
  currentInstitution,
  isDemoUser,
  loading,
  saving,
  error,
  onRefresh,
  onAddConsumption,
}) {
  const groupTotals = demandMetrics.bloodGroupForecasts;
  const todayStr = formatLocalDateISO(new Date());

  const [targetInstitutionId, setTargetInstitutionId] = useState(
    currentInstitution?.id || liveInstitutions?.[0]?.id || ''
  );
  const [logDate, setLogDate] = useState(todayStr);
  const [bloodGroup, setBloodGroup] = useState('O-');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [unitsConsumed, setUnitsConsumed] = useState(10);
  const [unitsReplenished, setUnitsReplenished] = useState(4);
  const [errorMsg, setErrorMsg] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!targetInstitutionId) {
      const fallback = currentInstitution?.id || liveInstitutions?.[0]?.id || '';
      if (fallback) setTargetInstitutionId(fallback);
    }
  }, [targetInstitutionId, currentInstitution, liveInstitutions]);

  const handleLogConsumption = async (e) => {
    e.preventDefault();
    if (saving) return;

    setErrorMsg('');
    setFeedback('');

    const parsedConsumed = Number(unitsConsumed);
    const parsedReplenished = Number(unitsReplenished);

    if (!Number.isInteger(parsedConsumed) || parsedConsumed < 1 || parsedConsumed > 5000) {
      setErrorMsg('Units consumed must be a positive whole number between 1 and 5,000.');
      return;
    }
    if (!Number.isInteger(parsedReplenished) || parsedReplenished < 0 || parsedReplenished > 5000) {
      setErrorMsg('Stock added must be a whole number between 0 and 5,000.');
      return;
    }
    if (!logDate || logDate > todayStr) {
      setErrorMsg('Log date cannot be in the future.');
      return;
    }

    const res = await onAddConsumption({
      targetInstitutionId,
      logDate,
      bloodGroup,
      department,
      unitsConsumed: parsedConsumed,
      unitsReplenished: parsedReplenished,
    });

    if (!res.ok) {
      setErrorMsg(res.error || 'Failed to save consumption log.');
    } else {
      setFeedback(
        `Saved to Supabase: ${parsedConsumed} units consumed & ${parsedReplenished} units added for ${bloodGroup} on ${logDate}.`
      );
    }
  };

  // 1. Blood inventory distribution
  const distributionChart = {
    labels: groupTotals.map((g) => g.bloodGroup),
    datasets: [
      {
        data: groupTotals.map((g) => g.totalUnits),
        backgroundColor: groupTotals.map((g) => BLOOD_GROUP_COLORS[g.bloodGroup]),
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  // 2. Consumption patterns by clinical department
  const departmentChart = {
    labels: demandMetrics.consumptionByDepartment.map((d) => d.department),
    datasets: [
      {
        label: 'Weekly Consumption (Units)',
        data: demandMetrics.consumptionByDepartment.map((d) => d.avgWeeklyUnits),
        backgroundColor: '#9f1239',
        borderRadius: 4,
      },
    ],
  };

  // 3. Combined 14-day demand trend (7-day historical + 7-day estimated)
  const combinedLabels = [
    ...demandMetrics.dailyHistory.map((d) => d.day),
    ...demandMetrics.forecast7d.map((d) => d.day),
  ];

  const historicalSeries = [
    ...demandMetrics.dailyHistory.map((d) => d.demand),
    ...demandMetrics.forecast7d.map(() => null),
  ];

  const forecastSeries = [
    ...demandMetrics.dailyHistory.map((_, idx) =>
      idx === demandMetrics.dailyHistory.length - 1 ? demandMetrics.dailyHistory[idx].demand : null
    ),
    ...demandMetrics.forecast7d.map((d) => d.projectedDemand),
  ];

  const demandTrendChart = {
    labels: combinedLabels,
    datasets: [
      {
        label: 'Logged Consumption (7d)',
        data: historicalSeries,
        borderColor: '#1c1917',
        backgroundColor: 'rgba(28, 25, 23, 0.06)',
        fill: true,
        tension: 0.3,
        pointRadius: 3.5,
      },
      {
        label: 'Expected Daily Demand (Next 7d)',
        data: forecastSeries,
        borderColor: '#9f1239',
        borderDash: [6, 4],
        backgroundColor: 'rgba(159, 18, 57, 0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 3.5,
      },
    ],
  };

  return (
    <>
      <SimulatedNotice title={isDemoUser ? 'Demo Consumption & Trends' : 'Supabase Consumption Logs'}>
        {isDemoUser
          ? 'Viewing and logging simulated demo consumption records (is_demo = true). Estimates are non-clinical.'
          : `Connected to Supabase consumption_logs for ${currentInstitution?.name || 'your institution'}. Demand projections are heuristic estimates, not clinical forecasts.`}
      </SimulatedNotice>

      {/* Log Consumption Record Form */}
      <div className="panel stagger-1">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Log Consumption Record</h2>
            <p className="panel-subtitle">
              Record blood usage and stock added for{' '}
              {isDemoUser ? 'a demo facility' : currentInstitution?.name || 'your institution'}
            </p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={13} /> {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="panel-body">
          <form className="form-grid-6" onSubmit={handleLogConsumption}>
            {isDemoUser && (
              <div className="field">
                <label htmlFor="cons-inst" className="field-label">Demo Facility</label>
                <select
                  id="cons-inst"
                  className="select"
                  value={targetInstitutionId}
                  onChange={(e) => setTargetInstitutionId(e.target.value)}
                  disabled={saving}
                >
                  {(liveInstitutions || []).map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label htmlFor="cons-date" className="field-label">Log Date</label>
              <input
                id="cons-date"
                type="date"
                max={todayStr}
                className="input"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="field">
              <label htmlFor="cons-group" className="field-label">Blood Group</label>
              <select
                id="cons-group"
                className="select"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                disabled={saving}
              >
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="cons-dept" className="field-label">Department</label>
              <select
                id="cons-dept"
                className="select"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={saving}
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="cons-used" className="field-label">Units Consumed</label>
              <input
                id="cons-used"
                type="number"
                min={1}
                max={5000}
                step={1}
                className="input tabular"
                value={unitsConsumed}
                onChange={(e) => setUnitsConsumed(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="field">
              <label htmlFor="cons-rep" className="field-label">Stock Added (Units)</label>
              <input
                id="cons-rep"
                type="number"
                min={0}
                max={5000}
                step={1}
                className="input tabular"
                value={unitsReplenished}
                onChange={(e) => setUnitsReplenished(e.target.value)}
                disabled={saving}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              <PlusCircle size={15} /> {saving ? 'Saving...' : 'Log Record'}
            </button>
          </form>

          {(errorMsg || error) && (
            <div className="auth-error" role="alert" style={{ marginTop: 12 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{errorMsg || error}</span>
            </div>
          )}

          {feedback && (
            <div className="feedback-banner" role="status">
              <CheckCircle2 size={16} />
              <span>{feedback}</span>
            </div>
          )}
        </div>
      </div>

      <section className="grid-2 stagger-2">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Blood Inventory Distribution</h2>
              <p className="panel-subtitle">
                Current stock ({summary.totalUnits.toLocaleString()} total units) across 8 blood groups
              </p>
            </div>
          </div>
          <div className="panel-body">
            <div className="chart-box">
              <Doughnut
                data={distributionChart}
                options={{
                  ...BASE_CHART_OPTIONS,
                  cutout: '60%',
                  interaction: { mode: 'nearest', intersect: true },
                  plugins: {
                    ...BASE_CHART_OPTIONS.plugins,
                    tooltip: {
                      ...BASE_CHART_OPTIONS.plugins.tooltip,
                      callbacks: {
                        label: (ctx) => {
                          const units = ctx.parsed;
                          const pct = summary.totalUnits > 0 ? ((units / summary.totalUnits) * 100).toFixed(1) : '0.0';
                          return ` ${ctx.label}: ${units.toLocaleString()} units (${pct}%)`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Consumption Patterns by Department</h2>
              <p className="panel-subtitle">
                7-day logged utilization ({summary.past7dDemand.toLocaleString()} total units)
              </p>
            </div>
          </div>
          <div className="panel-body">
            {demandMetrics.consumptionByDepartment.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', padding: '24px 0' }}>
                No consumption records logged in the last 7 days.
              </p>
            ) : (
              <div className="chart-box">
                <Bar
                  data={departmentChart}
                  options={{
                    ...BASE_CHART_OPTIONS,
                    indexAxis: 'y',
                    plugins: {
                      ...BASE_CHART_OPTIONS.plugins,
                      tooltip: {
                        ...BASE_CHART_OPTIONS.plugins.tooltip,
                        callbacks: {
                          label: (ctx) => {
                            const dept = demandMetrics.consumptionByDepartment[ctx.dataIndex];
                            return ` ${ctx.parsed.x} units/week (${dept.share}% share)`;
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        beginAtZero: true,
                        title: { display: true, text: 'Units / Week', color: '#78716c', font: { size: 11 } },
                        grid: { color: '#f5f4f1' },
                      },
                      y: { grid: { display: false } },
                    },
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="panel stagger-3">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Demand Trends (Logged History vs. Expected Projection)</h2>
            <p className="panel-subtitle">
              14-day view: {summary.past7dDemand.toLocaleString()} logged 7d units vs.{' '}
              {summary.forecasted7dDemand.toLocaleString()} expected 7d units
            </p>
          </div>
        </div>
        <div className="panel-body">
          <div className="chart-box-tall">
            <Line
              data={demandTrendChart}
              options={{
                ...BASE_CHART_OPTIONS,
                plugins: {
                  ...BASE_CHART_OPTIONS.plugins,
                  tooltip: {
                    ...BASE_CHART_OPTIONS.plugins.tooltip,
                    callbacks: {
                      label: (ctx) =>
                        ctx.parsed.y !== null ? ` ${ctx.dataset.label}: ${ctx.parsed.y} units` : null,
                    },
                  },
                },
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
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Blood-Group-Specific Statistics</h2>
            <p className="panel-subtitle">
              Derived from live Supabase inventory ({summary.totalUnits.toLocaleString()} units) and
              7-day consumption logs
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Blood Group</th>
                <th>Available Units</th>
                <th>Minimum Stock Level</th>
                <th>Avg. Daily Usage</th>
                <th>Expected 7-Day Demand</th>
                <th>Usage Share</th>
                <th>Days of Supply</th>
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {groupTotals.map((g) => (
                <tr key={g.bloodGroup}>
                  <td>
                    <BloodGroupPill group={g.bloodGroup} />
                  </td>
                  <td className="tabular" style={{ fontWeight: 600 }}>{g.totalUnits} units</td>
                  <td className="tabular" style={{ color: 'var(--text-muted)' }}>
                    {g.totalThreshold} units
                  </td>
                  <td className="tabular">{g.avgDailyDemand} units/day</td>
                  <td className="tabular">{g.projected7dDemand} units</td>
                  <td className="tabular">{g.clinicalShare}</td>
                  <td className="tabular">
                    {g.safetyBufferDays !== null ? `${g.safetyBufferDays} days` : '—'}
                  </td>
                  <td>
                    <RiskBadge riskLevel={g.riskLevel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Consumption History Table */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Recent 7-Day Consumption History ({consumptionRecords.length})</h2>
            <p className="panel-subtitle">Append-only entries stored in Supabase consumption_logs</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Blood Group</th>
                <th>Department</th>
                <th>Units Consumed</th>
                <th>Stock Added</th>
                <th>Facility</th>
              </tr>
            </thead>
            <tbody>
              {loading && consumptionRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                    Loading consumption logs...
                  </td>
                </tr>
              ) : consumptionRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                    No consumption records logged in the last 7 days.
                  </td>
                </tr>
              ) : (
                consumptionRecords.slice(0, 20).map((row) => (
                  <tr key={row.id}>
                    <td className="tabular">{row.logDate}</td>
                    <td>
                      <BloodGroupPill group={row.bloodGroup} />
                    </td>
                    <td>{row.department}</td>
                    <td className="tabular" style={{ fontWeight: 600 }}>{row.unitsConsumed} units</td>
                    <td className="tabular" style={{ color: 'var(--text-muted)' }}>
                      {row.unitsReplenished} units
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.institutionName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
