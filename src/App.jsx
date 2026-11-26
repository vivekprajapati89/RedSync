import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from './components/Layout';
import OverviewView from './views/OverviewView';
import InventoryView from './views/InventoryView';
import PredictionsView from './views/PredictionsView';
import NetworkView from './views/NetworkView';
import MatchingView from './views/MatchingView';
import RequestsView from './views/RequestsView';
import AnalyticsView from './views/AnalyticsView';
import AlertsView from './views/AlertsView';
import AuthView from './views/AuthView';
import OnboardingView from './views/OnboardingView';
import CoordinatorApprovalView from './views/CoordinatorApprovalView';
import { createInitialPrototypeState, INSTITUTIONS } from './data/mockData';
import {
  clearPrototypeState,
  loadPrototypeState,
  savePrototypeState,
} from './services/storage';
import { isSupabaseConfigured, supabase } from './services/supabaseClient';
import { useSupabaseInventory } from './hooks/useSupabaseInventory';
import { useSupabaseConsumption } from './hooks/useSupabaseConsumption';
import { useSupabaseRequests } from './hooks/useSupabaseRequests';
import {
  computeDemandMetrics,
  computeInstitutionSummaries,
  computeInventoryStatus,
  computeLiveAlerts,
  computeNetworkSummary,
} from './utils/calculations';

export default function App() {
  const [activeView, setActiveView] = useState('overview');
  const [state, setState] = useState(() => loadPrototypeState(createInitialPrototypeState()));
  const [matchingPrefill, setMatchingPrefill] = useState(null);

  // Stage 2: Supabase Auth & Onboarding state
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [institution, setInstitution] = useState(null);
  const [refreshingAccount, setRefreshingAccount] = useState(false);

  const loadAccountContext = useCallback(async (userId) => {
    if (!supabase || !userId) {
      setProfile(null);
      setInstitution(null);
      return;
    }

    setRefreshingAccount(true);
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, institution_id, is_active')
        .eq('id', userId)
        .maybeSingle();

      setProfile(prof || null);

      if (prof?.institution_id) {
        const { data: inst } = await supabase
          .from('institutions')
          .select('id, name, type, location, approval_status, is_demo')
          .eq('id', prof.institution_id)
          .maybeSingle();
        setInstitution(inst || null);
      } else {
        setInstitution(null);
      }
    } finally {
      setRefreshingAccount(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const currentSession = data.session || null;
      setSession(currentSession);
      if (currentSession?.user?.id) {
        await loadAccountContext(currentSession.user.id);
      }
      if (mounted) setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      if (nextSession?.user?.id) {
        loadAccountContext(nextSession.user.id);
      } else {
        setProfile(null);
        setInstitution(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadAccountContext]);

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setProfile(null);
    setInstitution(null);
  };

  useEffect(() => {
    savePrototypeState(state);
  }, [state]);

  const isDemoUser = profile?.role === 'demo_user';
  const isApprovedMember = Boolean(
    session && (isDemoUser || institution?.approval_status === 'approved')
  );

  // Stage 4: Live Supabase-backed inventory & Realtime synchronization
  const {
    inventoryRecords: supabaseInventory,
    liveInstitutions,
    loading: inventoryLoading,
    saving: inventorySaving,
    error: inventoryError,
    realtimeStatus,
    refreshInventory,
    saveInventory,
  } = useSupabaseInventory({
    enabled: isApprovedMember,
    userId: session?.user?.id,
    institutionId: institution?.id || null,
    isDemo: isDemoUser,
  });

  // Stage 5: Live Supabase-backed consumption logs & Realtime synchronization
  const {
    consumptionRecords: supabaseConsumption,
    loading: consumptionLoading,
    saving: consumptionSaving,
    error: consumptionError,
    refreshConsumption,
    addConsumption,
  } = useSupabaseConsumption({
    enabled: isApprovedMember,
    userId: session?.user?.id,
    institutionId: institution?.id || null,
    isDemo: isDemoUser,
  });

  // Stage 6: Live Supabase-backed blood requests & atomic completion
  const {
    shortageRequests: supabaseRequests,
    loading: requestsLoading,
    saving: requestsSaving,
    error: requestsError,
    realtimeStatus: requestsRealtimeStatus,
    refreshRequests,
    createRequest,
    respondToRequest,
  } = useSupabaseRequests({
    enabled: isApprovedMember,
    userId: session?.user?.id,
    institutionId: institution?.id || null,
    isDemo: isDemoUser,
    onInventoryTransferred: refreshInventory,
  });

  const demandMetrics = useMemo(
    () =>
      computeDemandMetrics(
        supabaseInventory,
        supabaseConsumption,
        state.safetyConfig
      ),
    [supabaseInventory, supabaseConsumption, state.safetyConfig]
  );

  const liveAlerts = useMemo(
    () => computeLiveAlerts(supabaseInventory, demandMetrics.bloodGroupForecasts),
    [supabaseInventory, demandMetrics.bloodGroupForecasts]
  );

  const institutionSummaries = useMemo(
    () => computeInstitutionSummaries(supabaseInventory, liveInstitutions),
    [supabaseInventory, liveInstitutions]
  );

  const networkSummary = useMemo(
    () => computeNetworkSummary(supabaseInventory, demandMetrics, liveAlerts),
    [supabaseInventory, demandMetrics, liveAlerts]
  );

  const unacknowledgedCount = useMemo(
    () => liveAlerts.filter((a) => !state.acknowledgedAlertIds.includes(a.id)).length,
    [liveAlerts, state.acknowledgedAlertIds]
  );

  const pendingRequestCount = useMemo(
    () => supabaseRequests.filter((r) => r.status === 'Pending').length,
    [supabaseRequests]
  );

  // 1. Add or update inventory record
  const handleUpsertInventory = ({ institutionId, bloodGroup, units, minThreshold }) => {
    const parsedUnits = Math.max(0, Number(units) || 0);
    const parsedThreshold = Math.max(1, Number(minThreshold) || 1);
    const nowIso = new Date().toISOString();

    setState((prev) => {
      const recordId = `${institutionId}-${bloodGroup}`;
      const exists = prev.inventoryRecords.some((r) => r.id === recordId);

      let nextRecords;
      if (exists) {
        nextRecords = prev.inventoryRecords.map((r) =>
          r.id === recordId
            ? {
                ...r,
                units: parsedUnits,
                minThreshold: parsedThreshold,
                status: computeInventoryStatus(parsedUnits, parsedThreshold),
                updatedAt: nowIso,
              }
            : r
        );
      } else {
        const inst = INSTITUTIONS.find((i) => i.id === institutionId);
        if (!inst) return prev;
        nextRecords = [
          ...prev.inventoryRecords,
          {
            id: recordId,
            institutionId: inst.id,
            institutionName: inst.name,
            institutionType: inst.type,
            location: inst.location,
            distanceKm: inst.distanceKm,
            bloodGroup,
            units: parsedUnits,
            minThreshold: parsedThreshold,
            status: computeInventoryStatus(parsedUnits, parsedThreshold),
            updatedAt: nowIso,
          },
        ];
      }

      return { ...prev, inventoryRecords: nextRecords };
    });
  };

  // 2. Log or update consumption record
  const handleAddConsumption = ({ day, bloodGroup, department, unitsConsumed, unitsReplenished }) => {
    const parsedConsumed = Math.max(0, Number(unitsConsumed) || 0);
    const parsedReplenished = Math.max(0, Number(unitsReplenished) || 0);
    const nowIso = new Date().toISOString();

    setState((prev) => ({
      ...prev,
      consumptionRecords: [
        ...prev.consumptionRecords,
        {
          id: `cons-${Date.now()}`,
          day,
          bloodGroup,
          department,
          unitsConsumed: parsedConsumed,
          unitsReplenished: parsedReplenished,
          updatedAt: nowIso,
        },
      ],
    }));
  };

  // 3. Update configurable safety thresholds
  const handleUpdateSafetyConfig = (nextConfig) => {
    setState((prev) => ({
      ...prev,
      safetyConfig: {
        ...prev.safetyConfig,
        ...nextConfig,
      },
    }));
  };

  // 4. Create simulated shortage request
  const handleCreateShortageRequest = ({
    requestingInstitutionId,
    bloodGroup,
    requiredUnits,
    urgency,
    notes,
    respondedByInstitutionName,
  }) => {
    const inst = INSTITUTIONS.find((i) => i.id === requestingInstitutionId);
    if (!inst) return;

    const newReq = {
      id: `req-${Date.now()}`,
      requestingInstitutionId: inst.id,
      requestingInstitutionName: inst.name,
      bloodGroup,
      requiredUnits: Math.max(1, Number(requiredUnits) || 1),
      urgency: urgency || 'High',
      notes: notes?.trim() || 'Requested via Find Blood.',
      status: 'Pending',
      respondedByInstitutionName: respondedByInstitutionName || null,
      responseNote: respondedByInstitutionName
        ? `Awaiting verification from ${respondedByInstitutionName}.`
        : '',
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      shortageRequests: [newReq, ...prev.shortageRequests],
    }));
  };

  // 5. Simulated institution response / completion on a shortage request
  const handleRespondToRequest = (requestId, status, responderInstitutionName, responseNote) => {
    setState((prev) => {
      const targetReq = prev.shortageRequests.find((r) => r.id === requestId);
      if (!targetReq) return prev;

      let nextInventory = prev.inventoryRecords;

      // Update prototype inventory only when a request transitions into 'Completed'
      if (status === 'Completed' && targetReq.status !== 'Completed') {
        const sourceInstName = responderInstitutionName || targetReq.respondedByInstitutionName;
        const sourceRecord = prev.inventoryRecords.find(
          (r) =>
            r.institutionName === sourceInstName &&
            r.bloodGroup === targetReq.bloodGroup
        );
        const destRecord = prev.inventoryRecords.find(
          (r) =>
            r.institutionId === targetReq.requestingInstitutionId &&
            r.bloodGroup === targetReq.bloodGroup
        );

        if (sourceRecord && destRecord && sourceRecord.units >= targetReq.requiredUnits) {
          const nowIso = new Date().toISOString();
          nextInventory = prev.inventoryRecords.map((r) => {
            if (r.id === sourceRecord.id) {
              const units = r.units - targetReq.requiredUnits;
              return {
                ...r,
                units,
                status: computeInventoryStatus(units, r.minThreshold),
                updatedAt: nowIso,
              };
            }
            if (r.id === destRecord.id) {
              const units = r.units + targetReq.requiredUnits;
              return {
                ...r,
                units,
                status: computeInventoryStatus(units, r.minThreshold),
                updatedAt: nowIso,
              };
            }
            return r;
          });
        }
      }

      return {
        ...prev,
        inventoryRecords: nextInventory,
        shortageRequests: prev.shortageRequests.map((req) =>
          req.id === requestId
            ? {
                ...req,
                status,
                respondedByInstitutionName: responderInstitutionName || req.respondedByInstitutionName,
                responseNote: responseNote || req.responseNote,
              }
            : req
        ),
      };
    });
  };

  // 6. Toggle alert acknowledgement
  const handleToggleAcknowledge = (id) => {
    setState((prev) => {
      const exists = prev.acknowledgedAlertIds.includes(id);
      return {
        ...prev,
        acknowledgedAlertIds: exists
          ? prev.acknowledgedAlertIds.filter((item) => item !== id)
          : [...prev.acknowledgedAlertIds, id],
      };
    });
  };

  // 7. Navigate from an alert directly to Matching with prefilled blood group & site
  const handleOpenMatchingForAlert = (alert) => {
    setMatchingPrefill({
      bloodGroup: alert.bloodGroup,
      requiredUnits: Math.max(1, alert.thresholdUnits - alert.currentUnits),
      institutionId: alert.institutionId !== 'network' ? alert.institutionId : 'inst-2',
    });
    setActiveView('matching');
  };

  const handleFindBloodForGroup = (bloodGroup) => {
    setMatchingPrefill({
      bloodGroup,
      requiredUnits: 10,
      institutionId: 'inst-2',
    });
    setActiveView('matching');
  };

  // 8. Reset prototype storage
  const handleResetDemoData = () => {
    clearPrototypeState();
    setState(createInitialPrototypeState());
  };

  const renderView = () => {
    switch (activeView) {
      case 'overview':
        return (
          <OverviewView
            summary={networkSummary}
            demandMetrics={demandMetrics}
            institutions={institutionSummaries}
            alerts={liveAlerts}
            pendingRequestCount={pendingRequestCount}
            onNavigate={setActiveView}
            onFindBloodForGroup={handleFindBloodForGroup}
          />
        );
      case 'inventory':
        return (
          <InventoryView
            inventoryRecords={supabaseInventory}
            liveInstitutions={liveInstitutions}
            currentInstitution={institution}
            isDemoUser={isDemoUser}
            loading={inventoryLoading}
            saving={inventorySaving}
            error={inventoryError}
            realtimeStatus={realtimeStatus}
            onRefresh={refreshInventory}
            onSaveInventory={saveInventory}
          />
        );
      case 'predictions':
        return (
          <PredictionsView
            summary={networkSummary}
            demandMetrics={demandMetrics}
            safetyConfig={state.safetyConfig}
            onUpdateSafetyConfig={handleUpdateSafetyConfig}
          />
        );
      case 'network':
        return <NetworkView institutions={institutionSummaries} />;
      case 'matching':
        return (
          <MatchingView
            inventoryRecords={supabaseInventory}
            liveInstitutions={liveInstitutions}
            currentInstitution={institution}
            isDemoUser={isDemoUser}
            saving={requestsSaving}
            onCreateRequest={createRequest}
            onNavigate={setActiveView}
            prefill={matchingPrefill}
          />
        );
      case 'requests':
        return (
          <RequestsView
            shortageRequests={supabaseRequests}
            currentInstitution={institution}
            isDemoUser={isDemoUser}
            loading={requestsLoading}
            saving={requestsSaving}
            error={requestsError}
            realtimeStatus={requestsRealtimeStatus}
            onRefresh={refreshRequests}
            onUpdateRequestStatus={respondToRequest}
            onNavigate={setActiveView}
          />
        );
      case 'analytics':
        return (
          <AnalyticsView
            summary={networkSummary}
            demandMetrics={demandMetrics}
            consumptionRecords={supabaseConsumption}
            liveInstitutions={liveInstitutions}
            currentInstitution={institution}
            isDemoUser={isDemoUser}
            loading={consumptionLoading}
            saving={consumptionSaving}
            error={consumptionError}
            onRefresh={refreshConsumption}
            onAddConsumption={addConsumption}
          />
        );
      case 'alerts':
        return (
          <AlertsView
            alerts={liveAlerts}
            acknowledgedIds={state.acknowledgedAlertIds}
            onToggleAcknowledge={handleToggleAcknowledge}
            onCreateMatchRequest={handleOpenMatchingForAlert}
          />
        );
      default:
        return (
          <OverviewView
            summary={networkSummary}
            demandMetrics={demandMetrics}
            institutions={institutionSummaries}
            alerts={liveAlerts}
            onNavigate={setActiveView}
          />
        );
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="auth-shell">
        <div className="auth-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            Supabase Not Configured
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Missing <code>VITE_SUPABASE_URL</code> or <code>VITE_SUPABASE_ANON_KEY</code> in{' '}
            <code>.env</code>. Copy <code>.env.example</code> to <code>.env</code> with your local
            Supabase values.
          </p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card" style={{ padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Checking local session...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthView />;
  }

  if (profile?.role === 'network_coordinator') {
    return <CoordinatorApprovalView profile={profile} onSignOut={handleSignOut} />;
  }

  if (!isDemoUser && (!institution || institution.approval_status !== 'approved')) {
    return (
      <OnboardingView
        profile={profile}
        institution={institution}
        onRefreshStatus={() => loadAccountContext(session.user.id)}
        onSignOut={handleSignOut}
        refreshing={refreshingAccount}
      />
    );
  }

  return (
    <Layout
      activeView={activeView}
      onSelectView={setActiveView}
      alertCount={unacknowledgedCount}
      pendingRequestCount={pendingRequestCount}
      onResetDemoData={handleResetDemoData}
      userInstitutionName={isDemoUser ? 'Demo Sandbox (Simulated)' : institution?.name}
      onSignOut={handleSignOut}
    >
      <div key={activeView} className="view-transition">
        {renderView()}
      </div>
    </Layout>
  );
}
