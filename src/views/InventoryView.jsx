import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  RotateCcw,
  Save,
  Minus,
  Plus,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { BLOOD_GROUPS } from '../data/mockData';
import { formatRelativeTime } from '../utils/calculations';
import { BloodGroupPill, SimulatedNotice, StatusBadge } from '../components/UiComponents';

const STATUS_OPTIONS = ['All', 'Healthy', 'Low', 'Critical'];

export default function InventoryView({
  inventoryRecords,
  liveInstitutions,
  currentInstitution,
  isDemoUser,
  loading,
  saving,
  error,
  realtimeStatus,
  onRefresh,
  onSaveInventory,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  const editableInstitutions = useMemo(() => {
    if (isDemoUser) return liveInstitutions;
    return currentInstitution ? [currentInstitution] : [];
  }, [isDemoUser, liveInstitutions, currentInstitution]);

  const [formInstitutionId, setFormInstitutionId] = useState(
    currentInstitution?.id || editableInstitutions[0]?.id || ''
  );
  const [formBloodGroup, setFormBloodGroup] = useState('O-');
  const [formUnits, setFormUnits] = useState(20);
  const [formThreshold, setFormThreshold] = useState(15);
  const [errorMsg, setErrorMsg] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!formInstitutionId && editableInstitutions.length > 0) {
      setFormInstitutionId(editableInstitutions[0].id);
    }
  }, [formInstitutionId, editableInstitutions]);

  const syncFormWithExisting = (instId, group) => {
    setFormInstitutionId(instId);
    setFormBloodGroup(group);
    setErrorMsg('');
    const existing = inventoryRecords.find(
      (r) => r.institutionId === instId && r.bloodGroup === group
    );
    if (existing) {
      setFormUnits(existing.units);
      setFormThreshold(existing.minThreshold);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    setErrorMsg('');
    setFeedback('');

    const parsedUnits = Number(formUnits);
    const parsedThreshold = Number(formThreshold);

    if (!formInstitutionId) {
      setErrorMsg('No institution available for inventory updates.');
      return;
    }
    if (!Number.isInteger(parsedUnits) || parsedUnits < 0 || parsedUnits > 10000) {
      setErrorMsg('Available quantity must be a whole number between 0 and 10,000.');
      return;
    }
    if (!Number.isInteger(parsedThreshold) || parsedThreshold < 1 || parsedThreshold > 5000) {
      setErrorMsg('Minimum stock level must be a whole number between 1 and 5,000.');
      return;
    }

    const res = await onSaveInventory({
      targetInstitutionId: formInstitutionId,
      bloodGroup: formBloodGroup,
      units: parsedUnits,
      minThreshold: parsedThreshold,
    });

    if (!res.ok) {
      setErrorMsg(res.error || 'Failed to update inventory.');
    } else {
      const instName =
        editableInstitutions.find((i) => i.id === formInstitutionId)?.name || 'Your Facility';
      setFeedback(
        `Saved to Supabase: ${instName} now has ${parsedUnits} units of ${formBloodGroup} (minimum level: ${parsedThreshold}).`
      );
    }
  };

  const handleQuickAdjust = async (row, delta) => {
    if (saving) return;
    setErrorMsg('');
    setFeedback('');

    const nextUnits = Math.max(0, row.units + delta);
    const res = await onSaveInventory({
      targetInstitutionId: row.institutionId,
      bloodGroup: row.bloodGroup,
      units: nextUnits,
      minThreshold: row.minThreshold,
    });

    if (!res.ok) {
      setErrorMsg(res.error || 'Unable to adjust inventory.');
    } else {
      setFeedback(`Updated ${row.institutionName} (${row.bloodGroup}) to ${nextUnits} units.`);
    }
  };

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inventoryRecords.filter((row) => {
      const matchesGroup = selectedGroup === 'All' || row.bloodGroup === selectedGroup;
      const matchesStatus = selectedStatus === 'All' || row.status === selectedStatus;
      const matchesSearch =
        !q ||
        row.institutionName.toLowerCase().includes(q) ||
        row.bloodGroup.toLowerCase().includes(q) ||
        row.institutionType.toLowerCase().includes(q);
      return matchesGroup && matchesStatus && matchesSearch;
    });
  }, [inventoryRecords, searchQuery, selectedGroup, selectedStatus]);

  const counts = useMemo(() => {
    return {
      total: filteredRecords.length,
      units: filteredRecords.reduce((sum, r) => sum + r.units, 0),
      critical: filteredRecords.filter((r) => r.status === 'Critical').length,
      low: filteredRecords.filter((r) => r.status === 'Low').length,
    };
  }, [filteredRecords]);

  const realtimeLabel =
    realtimeStatus === 'connected'
      ? 'Live Sync Active'
      : realtimeStatus === 'connecting'
        ? 'Connecting Sync...'
        : 'Sync Offline (Use Refresh)';

  return (
    <>
      <SimulatedNotice title={isDemoUser ? 'Demo / Simulated Inventory' : 'Supabase Live Inventory'}>
        {isDemoUser
          ? 'Viewing isolated fictional demo records (is_demo = true) from local Supabase. Do not treat as real hospital availability.'
          : 'Connected to local Supabase PostgreSQL with Row Level Security. You can view approved network stock and update only your own institution.'}
      </SimulatedNotice>

      {/* Update Stock Form */}
      <div className="panel stagger-1">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Update Stock</h2>
            <p className="panel-subtitle">
              {isDemoUser
                ? 'Select a demo facility and blood group to update simulated stock'
                : `Updating inventory for ${currentInstitution?.name || 'your institution'}`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className={`badge ${realtimeStatus === 'connected' ? 'badge-healthy' : 'badge-neutral'}`}
            >
              {realtimeLabel}
            </span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw size={13} /> {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="panel-body">
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="field">
              <span className="field-label">Blood Group</span>
              <div className="group-picker" role="radiogroup" aria-label="Select blood group">
                {BLOOD_GROUPS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`group-chip ${formBloodGroup === g ? 'selected' : ''}`}
                    onClick={() => syncFormWithExisting(formInstitutionId, g)}
                    aria-pressed={formBloodGroup === g}
                    disabled={saving}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-grid-4">
              <div className="field">
                <label htmlFor="inv-inst" className="field-label">Institution</label>
                {isDemoUser ? (
                  <select
                    id="inv-inst"
                    className="select"
                    value={formInstitutionId}
                    onChange={(e) => syncFormWithExisting(e.target.value, formBloodGroup)}
                    disabled={saving}
                  >
                    {editableInstitutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="inv-inst"
                    type="text"
                    className="input"
                    value={currentInstitution?.name || ''}
                    disabled
                    readOnly
                  />
                )}
              </div>

              <div className="field">
                <label htmlFor="inv-units" className="field-label">Available Quantity (Units)</label>
                <input
                  id="inv-units"
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  className="input tabular"
                  value={formUnits}
                  onChange={(e) => setFormUnits(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="field">
                <label htmlFor="inv-threshold" className="field-label">Minimum Stock Level</label>
                <input
                  id="inv-threshold"
                  type="number"
                  min={1}
                  max={5000}
                  step={1}
                  className="input tabular"
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(e.target.value)}
                  disabled={saving}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving || !formInstitutionId}>
                <Save size={15} /> {saving ? 'Saving...' : 'Save Update'}
              </button>
            </div>
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

      {/* Stock Directory */}
      <div className="panel stagger-2">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Current Stock by Facility</h2>
            <p className="panel-subtitle tabular">
              {counts.total} entries · {counts.units.toLocaleString()} units ({counts.critical}{' '}
              critical, {counts.low} low)
            </p>
          </div>
          <div className="filter-group">
            <div className="input-wrap">
              <Search size={15} className="input-icon" />
              <input
                type="text"
                className="input input-with-icon"
                placeholder="Search facility or blood group..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search stock"
              />
            </div>

            <select
              className="select"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              aria-label="Filter by blood group"
            >
              <option value="All">All Blood Groups</option>
              {BLOOD_GROUPS.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>

            <select
              className="select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === 'All' ? 'All Statuses' : status}
                </option>
              ))}
            </select>

            {(searchQuery || selectedGroup !== 'All' || selectedStatus !== 'All') && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedGroup('All');
                  setSelectedStatus('All');
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
                <th>Blood Group</th>
                <th>Institution</th>
                <th>Available Quantity</th>
                <th>Minimum Stock Level</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Quick Adjust</th>
              </tr>
            </thead>
            <tbody>
              {loading && inventoryRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                    Loading live inventory from Supabase...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                    {inventoryRecords.length === 0
                      ? 'No stock records yet. Use the Update Stock form above to add your facility inventory.'
                      : 'No stock records match your filters.'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((row) => {
                  const canEditRow = isDemoUser || row.institutionId === currentInstitution?.id;
                  return (
                    <tr key={row.id}>
                      <td>
                        <BloodGroupPill group={row.bloodGroup} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>{row.institutionName}</span>
                          {!isDemoUser && row.institutionId === currentInstitution?.id && (
                            <span className="badge badge-info">Your Facility</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {row.institutionType}
                        </div>
                      </td>
                      <td className="tabular" style={{ fontWeight: 600 }}>{row.units} units</td>
                      <td className="tabular" style={{ color: 'var(--text-muted)' }}>
                        {row.minThreshold} units
                      </td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatRelativeTime(row.updatedAt)}</td>
                      <td>
                        {canEditRow ? (
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={saving}
                              onClick={() => handleQuickAdjust(row, -5)}
                              title="Subtract 5 units"
                            >
                              <Minus size={12} /> 5
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={saving}
                              onClick={() => handleQuickAdjust(row, 5)}
                              title="Add 5 units"
                            >
                              <Plus size={12} /> 5
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Read-only</span>
                        )}
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
