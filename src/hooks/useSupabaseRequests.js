import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  completeBloodRequest,
  createBloodRequest,
  fetchRequests,
  updateRequestStatus,
} from '../services/requestService';

export function useSupabaseRequests({
  enabled,
  userId,
  institutionId,
  isDemo,
  onInventoryTransferred,
}) {
  const [shortageRequests, setShortageRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected');
  const savingRef = useRef(false);

  const refreshRequests = useCallback(async () => {
    if (!enabled || !supabase) {
      setShortageRequests([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const rows = await fetchRequests(isDemo);
      setShortageRequests(rows);
    } catch (err) {
      setError(err?.message || 'Failed to load blood requests.');
    } finally {
      setLoading(false);
    }
  }, [enabled, isDemo]);

  useEffect(() => {
    if (!enabled || !supabase || !userId) {
      setShortageRequests([]);
      setRealtimeStatus('disconnected');
      return;
    }

    refreshRequests();
    setRealtimeStatus('connecting');

    const channel = supabase
      .channel(`blood_requests_${userId}_${isDemo ? 'demo' : 'prod'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blood_requests',
          filter: `is_demo=eq.${Boolean(isDemo)}`,
        },
        () => {
          refreshRequests();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error');
        } else if (status === 'CLOSED') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setRealtimeStatus('disconnected');
    };
  }, [enabled, userId, isDemo, refreshRequests]);

  const createRequest = useCallback(
    async ({
      requestingInstitutionId,
      targetInstitutionId,
      bloodGroup,
      requiredUnits,
      urgency,
      notes,
    }) => {
      if (savingRef.current) {
        return { ok: false, error: 'A request operation is already in progress.' };
      }

      const effectiveRequester = isDemo ? requestingInstitutionId : institutionId;
      if (!effectiveRequester) {
        return { ok: false, error: 'No requesting institution found.' };
      }

      savingRef.current = true;
      setSaving(true);
      try {
        const created = await createBloodRequest({
          requestingInstitutionId: effectiveRequester,
          targetInstitutionId,
          bloodGroup,
          requiredUnits,
          urgency,
          notes,
          isDemo,
        });
        setShortageRequests((prev) => {
          if (prev.some((r) => r.id === created.id)) return prev;
          return [created, ...prev];
        });
        return { ok: true, data: created };
      } catch (err) {
        return { ok: false, error: err?.message || 'Unable to create blood request.' };
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [institutionId, isDemo]
  );

  const respondToRequest = useCallback(
    async (requestId, nextStatus, responseNote) => {
      if (savingRef.current) {
        return { ok: false, error: 'A request operation is already in progress.' };
      }

      savingRef.current = true;
      setSaving(true);
      try {
        if (nextStatus === 'Completed') {
          await completeBloodRequest({ requestId, responseNote });
          await refreshRequests();
          if (onInventoryTransferred) {
            await onInventoryTransferred();
          }
          return { ok: true };
        }

        const updated = await updateRequestStatus({
          requestId,
          status: nextStatus,
          responseNote,
        });
        setShortageRequests((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
        return { ok: true, data: updated };
      } catch (err) {
        return { ok: false, error: err?.message || 'Unable to update blood request.' };
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [refreshRequests, onInventoryTransferred]
  );

  return {
    shortageRequests,
    loading,
    saving,
    error,
    realtimeStatus,
    refreshRequests,
    createRequest,
    respondToRequest,
  };
}
