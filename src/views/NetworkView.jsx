import React, { useMemo, useState } from 'react';
import { MapPin, Building2, Search } from 'lucide-react';
import { BloodGroupPill, SimulatedNotice, StatusBadge } from '../components/UiComponents';

export default function NetworkView({ institutions }) {
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch] = useState('');

  const facilityTypes = ['All', ...new Set(institutions.map((i) => i.type))];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return institutions.filter((inst) => {
      const matchesType = typeFilter === 'All' || inst.type === typeFilter;
      const matchesSearch =
        !q ||
        inst.name.toLowerCase().includes(q) ||
        inst.location.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [institutions, typeFilter, search]);

  return (
    <>
      <SimulatedNotice title="Fictional Network Directory">
        All hospitals and blood banks shown here are fictional institutions created for this
        hackathon prototype. Stock summaries update live when inventory is modified.
      </SimulatedNotice>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Connected Institutions ({filtered.length})</h2>
            <p className="panel-subtitle">Regional blood banks and hospital facilities in the prototype network</p>
          </div>
          <div className="filter-group">
            <div className="input-wrap">
              <Search size={15} className="input-icon" />
              <input
                type="text"
                className="input input-with-icon"
                placeholder="Search facility or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search network facilities"
              />
            </div>
            <select
              className="select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by institution type"
            >
              {facilityTypes.map((t) => (
                <option key={t} value={t}>
                  {t === 'All' ? 'All Facility Types' : t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="panel-body">
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)' }}>
              <p style={{ marginBottom: 10 }}>No facilities match your search or filter.</p>
              {(search || typeFilter !== 'All') && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setSearch('');
                    setTypeFilter('All');
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid-2">
            {filtered.map((inst) => (
              <div
                key={inst.id}
                className="panel"
                style={{ padding: '18px 20px', boxShadow: 'none', background: 'var(--bg-subtle)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building2 size={16} style={{ color: 'var(--brand-primary)' }} />
                      <h3 style={{ fontSize: 15, fontWeight: 600 }}>{inst.name}</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12.5, color: 'var(--text-muted)' }}>
                      <MapPin size={13} />
                      <span>{inst.location}</span>
                      <span>•</span>
                      <span>{inst.type}</span>
                    </div>
                  </div>
                  <StatusBadge status={inst.status} />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 10,
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid var(--border-light)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Total Stock</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{inst.totalUnits} units</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Healthy Groups</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#065f46' }}>
                      {inst.healthyCount} / 8
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Low / Critical</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: inst.criticalCount > 0 ? '#b91c1c' : '#92400e' }}>
                      {inst.lowCount + inst.criticalCount} groups
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {inst.records.map((rec) => (
                    <span
                      key={rec.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 7px',
                        borderRadius: 5,
                        background: '#ffffff',
                        border: '1px solid var(--border-light)',
                        fontSize: 12,
                      }}
                    >
                      <BloodGroupPill group={rec.bloodGroup} />
                      <span style={{ fontWeight: 600 }}>{rec.units}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
