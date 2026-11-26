import React, { useMemo, useState } from 'react';
import { Check, RotateCcw, GitCompareArrows } from 'lucide-react';
import { BloodGroupPill, StatusBadge } from '../components/UiComponents';

export default function AlertsView({
  alerts,
  acknowledgedIds,
  onToggleAcknowledge,
  onCreateMatchRequest,
}) {
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const matchesPriority = priorityFilter === 'All' || a.priority === priorityFilter;
      const matchesType = typeFilter === 'All' || a.type === typeFilter;
      return matchesPriority && matchesType;
    });
  }, [alerts, priorityFilter, typeFilter]);

  const activeCount = alerts.filter((a) => !acknowledgedIds.includes(a.id)).length;

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Warnings &amp; Possible Shortages ({activeCount} unacknowledged)</h2>
            <p className="panel-subtitle">
              Automatically calculated from live inventory, 7-day usage, and minimum stock levels
            </p>
          </div>
          <div className="filter-group">
            <select
              className="select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter by alert priority"
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Moderate">Moderate</option>
            </select>

            <select
              className="select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by alert type"
            >
              <option value="All">All Alert Types</option>
              <option value="Low Inventory">Low Inventory</option>
              <option value="Projected Shortage">Projected Shortage</option>
            </select>

            {(priorityFilter !== 'All' || typeFilter !== 'All') && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPriorityFilter('All');
                  setTypeFilter('All');
                }}
              >
                <RotateCcw size={14} /> Reset
              </button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Alert Type</th>
                <th>Institution</th>
                <th>Blood Group</th>
                <th>Stock vs. Minimum</th>
                <th>Details</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                    No alerts match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => {
                  const isAck = acknowledgedIds.includes(alert.id);
                  return (
                    <tr key={alert.id} style={{ opacity: isAck ? 0.65 : 1 }}>
                      <td>
                        <StatusBadge status={alert.priority} />
                      </td>
                      <td>
                        <StatusBadge status={alert.type} />
                      </td>
                      <td style={{ fontWeight: 600 }}>{alert.institutionName}</td>
                      <td>
                        <BloodGroupPill group={alert.bloodGroup} />
                      </td>
                      <td>
                        <strong>{alert.currentUnits}</strong> / {alert.thresholdUnits} units
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        <div style={{ fontSize: 13 }}>{alert.message}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          {alert.timestamp}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${isAck ? '' : 'btn-primary'}`}
                            onClick={() => onToggleAcknowledge(alert.id)}
                          >
                            <Check size={14} />
                            {isAck ? 'Acknowledged' : 'Acknowledge'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => onCreateMatchRequest(alert)}
                            title="Open Find Blood for this blood group"
                          >
                            <GitCompareArrows size={13} /> Find Blood
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
