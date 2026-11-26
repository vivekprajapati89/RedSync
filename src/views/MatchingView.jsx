import React, { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, Send, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { BLOOD_GROUPS } from '../data/mockData';
import { formatRelativeTime } from '../utils/calculations';
import { BloodGroupPill, SimulatedNotice } from '../components/UiComponents';

export default function MatchingView({
  inventoryRecords,
  liveInstitutions,
  currentInstitution,
  isDemoUser,
  saving,
  onCreateRequest,
  onNavigate,
  prefill,
}) {
  const defaultInstId = currentInstitution?.id || liveInstitutions?.[0]?.id || '';
  const [requestingInstitutionId, setRequestingInstitutionId] = useState(
    prefill?.institutionId || defaultInstId
  );
  const [bloodGroup, setBloodGroup] = useState(prefill?.bloodGroup || 'O-');
  const [requiredUnits, setRequiredUnits] = useState(prefill?.requiredUnits || 10);
  const [searchCriteria, setSearchCriteria] = useState({
    institutionId: prefill?.institutionId || defaultInstId,
    bloodGroup: prefill?.bloodGroup || 'O-',
    requiredUnits: prefill?.requiredUnits || 10,
  });
  const [requestFeedback, setRequestFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!requestingInstitutionId && defaultInstId) {
      setRequestingInstitutionId(defaultInstId);
      setSearchCriteria((prev) => ({ ...prev, institutionId: defaultInstId }));
    }
  }, [requestingInstitutionId, defaultInstId]);

  useEffect(() => {
    if (prefill) {
      const nextInst = isDemoUser ? prefill.institutionId || defaultInstId : defaultInstId;
      const nextGroup = prefill.bloodGroup || 'O-';
      const nextUnits = prefill.requiredUnits || 10;
      setRequestingInstitutionId(nextInst);
      setBloodGroup(nextGroup);
      setRequiredUnits(nextUnits);
      setSearchCriteria({
        institutionId: nextInst,
        bloodGroup: nextGroup,
        requiredUnits: nextUnits,
      });
    }
  }, [prefill, isDemoUser, defaultInstId]);

  const handleSearch = (e) => {
    e.preventDefault();
    const parsed = Math.max(1, Number(requiredUnits) || 1);
    setRequiredUnits(parsed);
    setSearchCriteria({
      institutionId: isDemoUser ? requestingInstitutionId : defaultInstId,
      bloodGroup,
      requiredUnits: parsed,
    });
    setRequestFeedback('');
    setErrorMsg('');
  };

  const candidateMatches = useMemo(() => {
    return inventoryRecords
      .filter(
        (r) =>
          r.bloodGroup === searchCriteria.bloodGroup &&
          r.institutionId !== searchCriteria.institutionId
      )
      .map((rec) => {
        const extraAboveMin = Math.max(0, rec.units - rec.minThreshold);
        const hasEnoughTotal = rec.units >= searchCriteria.requiredUnits;
        const hasEnoughExtra = extraAboveMin >= searchCriteria.requiredUnits;
        return {
          ...rec,
          extraAboveMin,
          hasEnoughTotal,
          hasEnoughExtra,
        };
      })
      .sort((a, b) => {
        if (a.hasEnoughExtra !== b.hasEnoughExtra) return a.hasEnoughExtra ? -1 : 1;
        return b.units - a.units;
      });
  }, [inventoryRecords, searchCriteria]);

  const handleSendRequest = async (targetRow) => {
    if (saving) return;
    setErrorMsg('');
    setRequestFeedback('');

    const res = await onCreateRequest({
      requestingInstitutionId: searchCriteria.institutionId,
      targetInstitutionId: targetRow.institutionId,
      bloodGroup: searchCriteria.bloodGroup,
      requiredUnits: searchCriteria.requiredUnits,
      urgency: 'High',
      notes: `Requested from ${targetRow.institutionName} (pending verification).`,
    });

    if (!res.ok) {
      setErrorMsg(res.error || 'Failed to create blood request.');
    } else {
      setRequestFeedback(
        `Request saved to Supabase for ${searchCriteria.requiredUnits} units of ${searchCriteria.bloodGroup} (directed to ${targetRow.institutionName}).`
      );
    }
  };

  const requestingInstName =
    (isDemoUser
      ? liveInstitutions?.find((i) => i.id === searchCriteria.institutionId)?.name
      : currentInstitution?.name) || 'Your Facility';

  return (
    <>
      <SimulatedNotice title="Verification Required">
        Reported availability is prototype/network data only and must be verified directly with the
        facility before confirming clinical compatibility or physical transfer.
      </SimulatedNotice>

      {/* Search Form */}
      <div className="panel stagger-1">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Search Available Blood</h2>
            <p className="panel-subtitle">
              Choose the blood group and quantity needed to see which approved facilities report stock
            </p>
          </div>
        </div>
        <div className="panel-body">
          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="field">
              <span className="field-label">Required Blood Group</span>
              <div className="group-picker" role="radiogroup" aria-label="Select required blood group">
                {BLOOD_GROUPS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`group-chip ${bloodGroup === g ? 'selected' : ''}`}
                    onClick={() => setBloodGroup(g)}
                    aria-pressed={bloodGroup === g}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="matching-form">
              <div className="field">
                <label htmlFor="find-inst" className="field-label">Requesting Institution</label>
                {isDemoUser ? (
                  <select
                    id="find-inst"
                    className="select"
                    value={requestingInstitutionId}
                    onChange={(e) => setRequestingInstitutionId(e.target.value)}
                  >
                    {(liveInstitutions || []).map((inst) => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="find-inst"
                    type="text"
                    className="input"
                    value={currentInstitution?.name || ''}
                    disabled
                    readOnly
                  />
                )}
              </div>

              <div className="field">
                <label htmlFor="find-units" className="field-label">Required Quantity (Units)</label>
                <input
                  id="find-units"
                  type="number"
                  min={1}
                  max={5000}
                  step={1}
                  className="input tabular"
                  value={requiredUnits}
                  onChange={(e) => setRequiredUnits(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary">
                <Search size={15} /> Search Availability
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Match Results */}
      <div className="panel stagger-2">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Potential Matches for {searchCriteria.bloodGroup} ({searchCriteria.requiredUnits} units
              for {requestingInstName})
            </h2>
            <p className="panel-subtitle">
              Ranked by extra units available above each facility&apos;s minimum stock level (simulated
              availability only — not clinical compatibility)
            </p>
          </div>
          {requestFeedback && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onNavigate('requests')}
            >
              View Requests <ArrowRight size={14} />
            </button>
          )}
        </div>

        <div className="panel-body">
          {errorMsg && (
            <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {requestFeedback && (
            <div className="feedback-banner" style={{ marginTop: 0, marginBottom: 16 }} role="status">
              <CheckCircle2 size={16} />
              <span>{requestFeedback}</span>
            </div>
          )}

          {candidateMatches.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '12px 0' }}>
              No other approved facilities currently report {searchCriteria.bloodGroup} inventory.
            </p>
          ) : (
            <>
              {!candidateMatches.some((m) => m.hasEnoughTotal) && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--status-low-bg)',
                    border: '1px solid var(--status-low-border)',
                    color: 'var(--status-low-text)',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  No single facility currently reports at least {searchCriteria.requiredUnits} units
                  of {searchCriteria.bloodGroup}. Lower-stock facilities are listed below for reference.
                </div>
              )}

              <div className="list-stack">
                {candidateMatches.map((row) => (
                  <div className="list-row" key={row.id} style={{ alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <BloodGroupPill group={row.bloodGroup} />
                        <strong style={{ fontSize: 14 }}>{row.institutionName}</strong>
                        {row.units === 0 ? (
                          <span className="badge badge-critical">Unavailable (0 units)</span>
                        ) : row.hasEnoughExtra ? (
                          <span className="badge badge-healthy">Surplus Available (Verify)</span>
                        ) : row.hasEnoughTotal ? (
                          <span className="badge badge-low">Stock Available (Verify)</span>
                        ) : (
                          <span className="badge badge-critical">Less Than Needed</span>
                        )}
                      </div>
                      <div
                        className="tabular"
                        style={{
                          fontSize: 12.5,
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} /> {row.location} (~{row.distanceKm} km)
                        </span>
                        <span>•</span>
                        <span>
                          Reported stock: <strong>{row.units} units</strong> ({row.extraAboveMin}{' '}
                          above minimum)
                        </span>
                        <span>•</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          Updated {formatRelativeTime(row.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`btn btn-sm ${row.hasEnoughTotal ? 'btn-primary' : ''}`}
                      disabled={saving || row.units === 0}
                      style={{
                        opacity: saving || row.units === 0 ? 0.5 : 1,
                        cursor: saving || row.units === 0 ? 'not-allowed' : 'pointer',
                      }}
                      onClick={() => handleSendRequest(row)}
                    >
                      <Send size={13} /> {saving ? 'Sending...' : `Request ${searchCriteria.requiredUnits} Units`}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
