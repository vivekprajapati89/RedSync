import { BLOOD_GROUPS, INSTITUTIONS, PRIOR_PERIOD_TOTAL_UNITS } from '../data/mockData.js';

export function formatRelativeTime(isoString) {
  if (!isoString) return 'Just now';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  return new Date(isoString).toLocaleDateString();
}

export function computeInventoryStatus(units, minThreshold) {
  if (units <= Math.round(minThreshold * 0.6)) return 'Critical';
  if (units <= minThreshold) return 'Low';
  return 'Healthy';
}

/**
 * Derive consumption trends and 7-day projections directly from consumptionRecords.
 */
export function computeDemandMetrics(inventoryRecords, consumptionRecords, safetyConfig) {
  const daysOrder = ['Day -6', 'Day -5', 'Day -4', 'Day -3', 'Day -2', 'Day -1', 'Today'];

  // Aggregate daily totals across all consumption records
  const dailyHistory = daysOrder.map((day) => {
    const dayRecords = consumptionRecords.filter((r) => r.day === day);
    const demand = dayRecords.reduce((sum, r) => sum + r.unitsConsumed, 0);
    const supplyReplenished = dayRecords.reduce((sum, r) => sum + (r.unitsReplenished || 0), 0);
    return { day, demand, supplyReplenished };
  });

  const past7dDemand = dailyHistory.reduce((sum, d) => sum + d.demand, 0);
  const past7dReplenished = dailyHistory.reduce((sum, d) => sum + d.supplyReplenished, 0);
  const avgDailyReplenishment = Math.round(past7dReplenished / 7);

  // Per-blood-group calculations derived from live inventory + consumptionRecords
  const bloodGroupForecasts = BLOOD_GROUPS.map((group) => {
    const inv = inventoryRecords.filter((r) => r.bloodGroup === group);
    const totalUnits = inv.reduce((sum, r) => sum + r.units, 0);
    const totalThreshold = inv.reduce((sum, r) => sum + r.minThreshold, 0);
    const criticalSites = inv.filter((r) => r.status === 'Critical').length;
    const lowSites = inv.filter((r) => r.status === 'Low').length;

    const groupCons = consumptionRecords.filter((r) => r.bloodGroup === group);
    const total7dConsumed = groupCons.reduce((sum, r) => sum + r.unitsConsumed, 0);
    const avgDailyDemand = total7dConsumed > 0 ? Math.max(1, Math.round(total7dConsumed / 7)) : 0;

    // Compare last 3 days vs first 3 days to compute transparent trend %
    const earlyDays = groupCons
      .filter((r) => ['Day -6', 'Day -5', 'Day -4'].includes(r.day))
      .reduce((sum, r) => sum + r.unitsConsumed, 0);
    const recentDays = groupCons
      .filter((r) => ['Day -2', 'Day -1', 'Today'].includes(r.day))
      .reduce((sum, r) => sum + r.unitsConsumed, 0);
    const trendPct = earlyDays > 0 ? (((recentDays - earlyDays) / earlyDays) * 100).toFixed(1) : '0.0';
    const trend = `${Number(trendPct) >= 0 ? '+' : ''}${trendPct}%`;

    const projected7dDemand = avgDailyDemand * 7;
    const safetyBufferDays =
      avgDailyDemand > 0 ? Number((totalUnits / avgDailyDemand).toFixed(1)) : null;
    const clinicalShare =
      past7dDemand > 0 ? `${((total7dConsumed / past7dDemand) * 100).toFixed(1)}%` : '0.0%';

    // Transparent shortage risk classification driven by configurable safety thresholds
    let riskLevel = 'Low';
    if (
      (safetyBufferDays !== null && safetyBufferDays < safetyConfig.highRiskBufferDays) ||
      criticalSites >= safetyConfig.highRiskCriticalSites
    ) {
      riskLevel = 'High';
    } else if (
      (safetyBufferDays !== null && safetyBufferDays < safetyConfig.moderateRiskBufferDays) ||
      criticalSites + lowSites >= 2
    ) {
      riskLevel = 'Moderate';
    }

    const totalSites = Math.max(1, new Set(inventoryRecords.map((r) => r.institutionId)).size);
    const affected = criticalSites + lowSites;
    const bufferLabel = safetyBufferDays !== null ? `${safetyBufferDays}d est. buffer` : 'no 7d usage logged';
    let riskReason = `All sites healthy (${totalUnits} units vs ${totalThreshold} min threshold; ${bufferLabel}).`;
    if (riskLevel === 'High') {
      riskReason = `${affected} of ${totalSites} sites below threshold (${criticalSites} critical) with ${bufferLabel} (${totalUnits} vs ${totalThreshold} min units).`;
    } else if (riskLevel === 'Moderate') {
      riskReason = `${affected} of ${totalSites} sites below threshold and ${bufferLabel} at ${avgDailyDemand} units/day usage.`;
    }

    return {
      bloodGroup: group,
      totalUnits,
      totalThreshold,
      criticalSites,
      lowSites,
      lowOrCriticalCount: affected,
      avgDailyDemand,
      total7dConsumed,
      projected7dDemand,
      safetyBufferDays,
      clinicalShare,
      trend,
      riskLevel,
      riskReason,
    };
  });

  // 7-day future stock estimation using transparent daily average
  const totalCurrentUnits = inventoryRecords.reduce((sum, r) => sum + r.units, 0);
  const estDailyDemand = bloodGroupForecasts.reduce((sum, g) => sum + g.avgDailyDemand, 0);
  let runningInventory = totalCurrentUnits;

  const forecast7d = Array.from({ length: 7 }, (_, i) => {
    const netChange = avgDailyReplenishment - estDailyDemand;
    runningInventory = Math.max(0, runningInventory + netChange);
    return {
      day: `Day +${i + 1}`,
      projectedDemand: estDailyDemand,
      projectedReplenishment: avgDailyReplenishment,
      netChange,
      projectedInventory: runningInventory,
    };
  });

  // Consumption by department
  const deptMap = {};
  consumptionRecords.forEach((r) => {
    deptMap[r.department] = (deptMap[r.department] || 0) + r.unitsConsumed;
  });
  const consumptionByDepartment = Object.entries(deptMap)
    .map(([department, avgWeeklyUnits]) => ({
      department,
      avgWeeklyUnits,
      share: past7dDemand > 0 ? Math.round((avgWeeklyUnits / past7dDemand) * 100) : 0,
    }))
    .sort((a, b) => b.avgWeeklyUnits - a.avgWeeklyUnits);

  return {
    dailyHistory,
    forecast7d,
    bloodGroupForecasts,
    consumptionByDepartment,
    past7dDemand,
    past7dReplenished,
    forecasted7dDemand: estDailyDemand * 7,
    avgDailyReplenishment,
    estDailyDemand,
  };
}

/**
 * Dynamically generate alerts from live inventory status & projected blood-group risk.
 */
export function computeLiveAlerts(inventoryRecords, bloodGroupForecasts) {
  const alerts = [];

  // 1. Site-level low/critical inventory warnings
  inventoryRecords.forEach((rec) => {
    if (rec.status === 'Critical' || rec.status === 'Low') {
      const pct = Math.round((rec.units / Math.max(1, rec.minThreshold)) * 100);
      alerts.push({
        id: `inv-${rec.id}`,
        priority: rec.status === 'Critical' ? 'Critical' : 'Moderate',
        type: 'Low Inventory',
        institutionId: rec.institutionId,
        institutionName: rec.institutionName,
        bloodGroup: rec.bloodGroup,
        currentUnits: rec.units,
        thresholdUnits: rec.minThreshold,
        timestamp: formatRelativeTime(rec.updatedAt),
        message: `${rec.bloodGroup} stock at ${pct}% of facility safety threshold (${rec.units} / ${rec.minThreshold} units).`,
      });
    }
  });

  // 2. Network-level projected shortage warnings for High/Moderate risk blood groups
  bloodGroupForecasts
    .filter((g) => g.riskLevel !== 'Low')
    .forEach((g) => {
      const bufferMsg =
        g.safetyBufferDays !== null
          ? `Estimated ${g.safetyBufferDays}d buffer at ${g.avgDailyDemand} units/day`
          : 'Insufficient usage history';
      alerts.push({
        id: `proj-${g.bloodGroup}`,
        priority: g.riskLevel === 'High' ? 'High' : 'Moderate',
        type: 'Projected Shortage',
        institutionId: 'network',
        institutionName: 'Network-Wide Projection',
        bloodGroup: g.bloodGroup,
        currentUnits: g.totalUnits,
        thresholdUnits: g.totalThreshold,
        timestamp: 'Live calculation',
        message: `${bufferMsg} (${g.lowOrCriticalCount} sites below threshold).`,
      });
    });

  const priorityOrder = { Critical: 0, High: 1, Moderate: 2 };
  return alerts.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));
}

export function computeInstitutionSummaries(inventoryRecords, institutionsList = INSTITUTIONS) {
  return institutionsList.map((inst) => {
    const records = inventoryRecords.filter((r) => r.institutionId === inst.id);
    const totalUnits = records.reduce((sum, r) => sum + r.units, 0);
    const criticalCount = records.filter((r) => r.status === 'Critical').length;
    const lowCount = records.filter((r) => r.status === 'Low').length;
    return {
      ...inst,
      totalUnits,
      criticalCount,
      lowCount,
      healthyCount: records.length - criticalCount - lowCount,
      records,
    };
  });
}

export function computeNetworkSummary(inventoryRecords, demandMetrics, alerts) {
  const totalUnits = inventoryRecords.reduce((sum, r) => sum + r.units, 0);
  const unitsDelta = totalUnits - PRIOR_PERIOD_TOTAL_UNITS;
  const unitsDeltaPct = ((unitsDelta / PRIOR_PERIOD_TOTAL_UNITS) * 100).toFixed(1);

  const atRiskGroups = demandMetrics.bloodGroupForecasts.filter((g) => g.riskLevel !== 'Low');
  const demandDelta = demandMetrics.forecasted7dDemand - demandMetrics.past7dDemand;
  const demandDeltaPct =
    demandMetrics.past7dDemand > 0
      ? ((demandDelta / demandMetrics.past7dDemand) * 100).toFixed(1)
      : '0.0';

  return {
    totalUnits,
    unitsDelta,
    unitsDeltaPct,
    connectedInstitutions: INSTITUTIONS.length,
    operationalInstitutions: INSTITUTIONS.filter((i) => i.status === 'Operational').length,
    bloodGroupsAtRisk: atRiskGroups.length,
    atRiskGroupNames: atRiskGroups.map((g) => g.bloodGroup),
    highRiskGroupsCount: atRiskGroups.filter((g) => g.riskLevel === 'High').length,
    moderateRiskGroupsCount: atRiskGroups.filter((g) => g.riskLevel === 'Moderate').length,
    totalAlerts: alerts.length,
    criticalAlertsCount: alerts.filter((a) => a.priority === 'Critical').length,
    past7dDemand: demandMetrics.past7dDemand,
    past7dReplenished: demandMetrics.past7dReplenished,
    forecasted7dDemand: demandMetrics.forecasted7dDemand,
    demandDelta,
    demandDeltaPct,
  };
}
