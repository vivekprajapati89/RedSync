import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { fetchConsumptionLogs, insertConsumptionLog } from '../services/consumptionService';

export function useSupabaseConsumption({ enabled, userId, institutionId, isDemo }) {
  const [consumptionRecords, setConsumptionRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  const refreshConsumption = useCallback(async () => {
    if (!enabled || !supabase) {
      setConsumptionRecords([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const rows = await fetchConsumptionLogs(isDemo);
      setConsumptionRecords(rows);
    } catch (err) {
      setError(err?.message || 'Failed to load consumption logs.');
    } finally {
      setLoading(false);
    }
  }, [enabled, isDemo]);

  useEffect(() => {
    if (!enabled || !supabase || !userId) {
      setConsumptionRecords([]);
      return;
    }

    refreshConsumption();

    const filterStr = isDemo
      ? 'is_demo=eq.true'
      : institutionId
        ? `institution_id=eq.${institutionId}`
        : 'is_demo=eq.false';

    const channel = supabase
      .channel(`consumption_logs_${userId}_${isDemo ? 'demo' : 'prod'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'consumption_logs',
          filter: filterStr,
        },
        () => {
          refreshConsumption();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, userId, institutionId, isDemo, refreshConsumption]);

  const addConsumption = useCallback(
    async ({ targetInstitutionId, logDate, bloodGroup, department, unitsConsumed, unitsReplenished }) => {
      if (savingRef.current) {
        return { ok: false, error: 'A consumption entry is already being saved.' };
      }

      const effectiveInstId = targetInstitutionId || institutionId;
      if (!isDemo && effectiveInstId !== institutionId) {
        return { ok: false, error: 'You can only log consumption for your own institution.' };
      }

      savingRef.current = true;
      setSaving(true);
      try {
        const created = await insertConsumptionLog({
          institutionId: effectiveInstId,
          logDate,
          bloodGroup,
          department,
          unitsConsumed,
          unitsReplenished,
          isDemo,
        });

        setConsumptionRecords((prev) => {
          if (prev.some((r) => r.id === created.id)) return prev;
          return [created, ...prev];
        });

        return { ok: true, data: created };
      } catch (err) {
        return {
          ok: false,
          error: err?.message || 'Unable to save consumption record.',
        };
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [institutionId, isDemo]
  );

  return {
    consumptionRecords,
    loading,
    saving,
    error,
    refreshConsumption,
    addConsumption,
  };
}
