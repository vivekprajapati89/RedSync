import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { fetchLiveInventory, upsertOwnInventory } from '../services/inventoryService';

export function useSupabaseInventory({ enabled, userId, institutionId, isDemo }) {
  const [inventoryRecords, setInventoryRecords] = useState([]);
  const [liveInstitutions, setLiveInstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected' | 'error'
  const savingRef = useRef(false);

  const refreshInventory = useCallback(async () => {
    if (!enabled || !supabase) {
      setInventoryRecords([]);
      setLiveInstitutions([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await fetchLiveInventory(isDemo);
      setInventoryRecords(result.inventoryRecords);
      setLiveInstitutions(result.institutions);
    } catch (err) {
      setError(err?.message || 'Failed to load inventory from Supabase.');
    } finally {
      setLoading(false);
    }
  }, [enabled, isDemo]);

  useEffect(() => {
    if (!enabled || !supabase || !userId) {
      setInventoryRecords([]);
      setLiveInstitutions([]);
      setRealtimeStatus('disconnected');
      return;
    }

    refreshInventory();

    setRealtimeStatus('connecting');
    const channelName = `blood_inventory_${userId}_${isDemo ? 'demo' : 'prod'}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blood_inventory',
          filter: `is_demo=eq.${Boolean(isDemo)}`,
        },
        () => {
          // Reconcile full inventory list so institution metadata & derived metrics stay consistent
          refreshInventory();
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
  }, [enabled, userId, isDemo, refreshInventory]);

  const saveInventory = useCallback(
    async ({ targetInstitutionId, bloodGroup, units, minThreshold }) => {
      if (savingRef.current) {
        return { ok: false, error: 'A save operation is already in progress.' };
      }

      const effectiveInstId = targetInstitutionId || institutionId;
      if (!isDemo && effectiveInstId !== institutionId) {
        return { ok: false, error: 'You can only update inventory for your own institution.' };
      }

      savingRef.current = true;
      setSaving(true);
      try {
        const updatedRow = await upsertOwnInventory({
          institutionId: effectiveInstId,
          bloodGroup,
          units,
          minThreshold,
          isDemo,
        });

        setInventoryRecords((prev) => {
          const exists = prev.some(
            (r) =>
              r.institutionId === updatedRow.institutionId &&
              r.bloodGroup === updatedRow.bloodGroup
          );
          if (exists) {
            return prev.map((r) =>
              r.institutionId === updatedRow.institutionId &&
              r.bloodGroup === updatedRow.bloodGroup
                ? updatedRow
                : r
            );
          }
          return [...prev, updatedRow];
        });

        return { ok: true, data: updatedRow };
      } catch (err) {
        return {
          ok: false,
          error: err?.message || 'Unable to update inventory.',
        };
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [institutionId, isDemo]
  );

  return {
    inventoryRecords,
    liveInstitutions,
    loading,
    saving,
    error,
    realtimeStatus,
    refreshInventory,
    saveInventory,
  };
}
