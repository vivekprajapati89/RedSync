import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Check, X, Ban, RotateCcw, LogOut, RefreshCw, Droplet } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { StatusBadge } from '../components/UiComponents';

export default function CoordinatorApprovalView({ profile, onSignOut }) {
  const [institutions, setInstitutions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadCoordinatorData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [{ data: instData, error: instErr }, { data: logData, error: logErr }] =
        await Promise.all([
          supabase
            .from('institutions')
            .select('id, name, type, location, approval_status, is_demo, created_at, approved_at')
            .eq('is_demo', false)
            .order('created_at', { ascending: false }),
          supabase
            .from('audit_logs')
            .select('id, action, entity_type, institution_id, before_data, after_data, created_at')
            .eq('is_demo', false)
            .order('created_at', { ascending: false })
            .limit(15),
        ]);

      if (instErr) throw instErr;
      if (logErr) throw logErr;

      setInstitutions(instData || []);
      setAuditLogs(logData || []);
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to load coordinator data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoordinatorData();
  }, [loadCoordinatorData]);

  const handleReview = async (inst, newStatus) => {
    setErrorMsg('');
    setFeedback('');
    const { error } = await supabase.rpc('review_institution_registration', {
      p_institution_id: inst.id,
      p_new_status: newStatus,
      p_reason: `Coordinator set status to ${newStatus}`,
    });
    if (error) {
      setErrorMsg(error.message);
    } else {
      setFeedback(`${inst.name} marked as ${newStatus}.`);
      await loadCoordinatorData();
    }
  };

  return (
    <div className="app-shell" style={{ display: 'block', minHeight: '100vh' }}>
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-mark" aria-hidden="true">
            <Droplet size={18} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="page-title">RedSync — Coordinator Approval</h1>
            <p className="page-subtitle">
              Signed in as {profile?.full_name} ({profile?.role})
            </p>
          </div>
        </div>
        <div className="topbar-right">
          <button type="button" className="btn btn-sm" onClick={loadCoordinatorData} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" className="btn btn-sm" onClick={onSignOut}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      <main className="content-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {errorMsg && (
          <div className="auth-error" role="alert">
            <span>{errorMsg}</span>
          </div>
        )}
        {feedback && (
          <div className="feedback-banner" role="status" style={{ marginTop: 0 }}>
            <ShieldCheck size={16} />
            <span>{feedback}</span>
          </div>
        )}

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Institution Registrations ({institutions.length})</h2>
              <p className="panel-subtitle">
                Approve, reject, suspend, or restore non-demo institutional accounts via RLS-enforced RPC
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Type & Location</th>
                  <th>Approval Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {institutions.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                      No non-demo institution registrations found.
                    </td>
                  </tr>
                ) : (
                  institutions.map((inst) => (
                    <tr key={inst.id}>
                      <td style={{ fontWeight: 600 }}>{inst.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {inst.type} · {inst.location}
                      </td>
                      <td>
                        <StatusBadge status={inst.approval_status} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {inst.approval_status !== 'approved' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => handleReview(inst, 'approved')}
                            >
                              <Check size={13} /> {inst.approval_status === 'suspended' ? 'Restore' : 'Approve'}
                            </button>
                          )}
                          {inst.approval_status === 'pending' && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => handleReview(inst, 'rejected')}
                            >
                              <X size={13} /> Reject
                            </button>
                          )}
                          {inst.approval_status === 'approved' && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => handleReview(inst, 'suspended')}
                            >
                              <Ban size={13} /> Suspend
                            </button>
                          )}
                          {inst.approval_status === 'rejected' && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => handleReview(inst, 'approved')}
                            >
                              <RotateCcw size={13} /> Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Recent Security & Approval Audit Logs</h2>
              <p className="panel-subtitle">Read-only append-only audit trail</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <StatusBadge status={log.action} />
                      </td>
                      <td>{log.entity_type}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {JSON.stringify(log.after_data)}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
