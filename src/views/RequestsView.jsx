import React, { useMemo, useState } from 'react';
import { Check, X, CheckCircle2, RotateCcw, RefreshCw, AlertCircle } from 'lucide-react';
import { formatRelativeTime } from '../utils/calculations';
import { BloodGroupPill, SimulatedNotice, StatusBadge } from '../components/UiComponents';

const REQUEST_STATUS_FILTERS = ['All', 'Pending', 'Accepted', 'Declined', 'Completed'];

export default function RequestsView({
  shortageRequests,
  currentInstitution,
  isDemoUser,
  loading,
  saving,
  error,
  realtimeStatus,
  onRefresh,
  onUpdateRequestStatus,
  onNavigate,
}) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');

  const counts = useMemo(() => {
    return {
      All: shortageRequests.length,
      Pending: shortageRequests.filter((r) => r.status === 'Pending').length,
      Accepted: shortageRequests.filter((r) => r.status === 'Accepted').length,
      Declined: shortageRequests.filter((r) => r.status === 'Declined').length,
      Completed: shortageRequests.filter((r) => r.status === 'Completed').length,
    };
  }, [shortageRequests]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'All') return shortageRequests;
    return shortageRequests.filter((r) => r.status === statusFilter);
  }, [shortageRequests, statusFilter]);

  const handleStatusChange = async (req, nextStatus, note) => {
    if (saving) return;
    setActionError('');
    setFeedback('');

    const res = await onUpdateRequestStatus(req.id, nextStatus, note);
    if (!res.ok) {
      setActionError(res.error || 'Unable to update request status.');
    } else {
      setFeedback(
        nextStatus === 'Completed'
          ? `Completed request for ${req.requiredUnits} units of ${req.bloodGroup} (${req.requestingInstitutionName}). Simulated inventory balances updated atomically.`
          : `Updated request for ${req.requiredUnits} units of ${req.bloodGroup} (${req.requestingInstitutionName}) to ${nextStatus}.`
      );
    }
  };

  const realtimeLabel =
    realtimeStatus === 'connected'
      ? 'Live Sync Active'
      : realtimeStatus === 'connecting'
        ? 'Connecting Sync...'
        : 'Sync Offline';

  return (
    <>
      <SimulatedNotice title="How Requests Work">
        <strong>Accept</strong> marks a request as agreed by the partner facility (stock does not
        change yet). <strong>Mark Completed</strong> runs an atomic simulated database transfer,
        moving units from the partner facility to the requesting facility.
      </SimulatedNotice>

      <div className="panel stagger-1">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Blood Requests ({shortageRequests.length})</h2>
            <p className="panel-subtitle tabular">
              {counts.Pending} Pending · {counts.Accepted} Accepted · {counts.Declined} Declined ·{' '}
              {counts.Completed} Completed
            </p>
          </div>
          <div className="filter-group">
            <span
              className={`badge ${realtimeStatus === 'connected' ? 'badge-healthy' : 'badge-neutral'}`}
            >
              {realtimeLabel}
            </span>
            <button type="button" className="btn btn-sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={13} /> {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => onNavigate('matching')}>
              + New Request
            </button>
          </div>
        </div>

        <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {REQUEST_STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status} ({counts[status]})
            </button>
          ))}
        </div>

        {(actionError || error) && (
          <div style={{ padding: '12px 22px 0' }}>
            <div className="auth-error" role="alert">
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{actionError || error}</span>
            </div>
          </div>
        )}

        {feedback && (
          <div style={{ padding: '12px 22px 0' }}>
            <div className="feedback-banner" role="status" style={{ marginTop: 0 }}>
              <CheckCircle2 size={16} />
              <span>{feedback}</span>
            </div>
          </div>
        )}

        <div className="table-wrap" style={{ marginTop: feedback || actionError || error ? 12 : 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Requesting Facility</th>
                <th>Blood Needed</th>
                <th>Urgency</th>
                <th>Status</th>
                <th>Target / Partner</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && shortageRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                    Loading blood requests from Supabase...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                    No {statusFilter === 'All' ? '' : `${statusFilter.toLowerCase()} `}requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const isRequester =
                    !isDemoUser && req.requestingInstitutionId === currentInstitution?.id;
                  const isTarget =
                    isDemoUser ||
                    (!isRequester &&
                      (req.targetInstitutionId === currentInstitution?.id ||
                        req.targetInstitutionId === null));

                  return (
                    <tr key={req.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>{req.requestingInstitutionName}</span>
                          {isRequester && <span className="badge badge-info">Outgoing</span>}
                        </div>
                        {req.notes && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{req.notes}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <BloodGroupPill group={req.bloodGroup} />
                          <span className="tabular" style={{ fontWeight: 600 }}>
                            {req.requiredUnits} units
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={req.urgency} />
                      </td>
                      <td>
                        <StatusBadge status={req.status} />
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {req.respondedByInstitutionName ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <strong>{req.respondedByInstitutionName}</strong>
                              {!isDemoUser && req.targetInstitutionId === currentInstitution?.id && (
                                <span className="badge badge-neutral">Incoming</span>
                              )}
                            </div>
                            {req.responseNote && (
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {req.responseNote}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Open to network</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatRelativeTime(req.createdAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {req.status === 'Pending' && isTarget && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={saving}
                                onClick={() =>
                                  handleStatusChange(
                                    req,
                                    'Accepted',
                                    'Accepted — pending simulated transfer completion.'
                                  )
                                }
                              >
                                <Check size={13} /> Accept
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={saving}
                                onClick={() =>
                                  handleStatusChange(
                                    req,
                                    'Declined',
                                    'Declined — insufficient surplus at this time.'
                                  )
                                }
                              >
                                <X size={13} /> Decline
                              </button>
                            </>
                          )}
                          {req.status === 'Pending' && !isTarget && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              Awaiting partner
                            </span>
                          )}
                          {req.status === 'Accepted' && isTarget && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={saving}
                              onClick={() =>
                                handleStatusChange(
                                  req,
                                  'Completed',
                                  'Simulated transfer completed.'
                                )
                              }
                            >
                              <CheckCircle2 size={13} /> {saving ? 'Completing...' : 'Mark Completed'}
                            </button>
                          )}
                          {req.status === 'Accepted' && !isTarget && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              Awaiting fulfillment
                            </span>
                          )}
                          {req.status === 'Declined' && (isRequester || isDemoUser) && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={saving}
                              onClick={() => handleStatusChange(req, 'Pending', '')}
                            >
                              <RotateCcw size={13} /> Reopen
                            </button>
                          )}
                          {req.status === 'Completed' && (
                            <span style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>
                              Transferred
                            </span>
                          )}
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
