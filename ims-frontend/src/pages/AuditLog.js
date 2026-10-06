import React, { useState, useEffect, useCallback } from "react";
import { apiFetch, apiFetchBlob } from "../utils/apiClient";
import { useToast } from "../context/ToastContext";
import "./AuditLog.css";

const CATEGORIES = [
  "Authentication",
  "Claims",
  "Policies",
  "User Profile",
  "Recommendations",
  "Admin Actions",
];

const SEVERITIES = ["INFO", "WARNING", "CRITICAL"];
const ENTITY_TYPES = ["User", "Claim", "UserPolicy"];

const CATEGORY_DOT_COLORS = {
  Authentication: "#8B5CF6",
  Claims: "#EF4444",
  Policies: "#10B981",
  "User Profile": "#F59E0B",
  Recommendations: "#06B6D4",
  "Admin Actions": "#6366F1",
};

const SEVERITY_STYLES = {
  INFO: { background: "#EFF6FF", color: "#1E40AF" },
  WARNING: { background: "#FFFBEB", color: "#92400E" },
  CRITICAL: { background: "#FEF2F2", color: "#991B1B" },
};

function formatTs(isoStr) {
  return new Date(isoStr).toLocaleString("en-GB");
}

function entityLabel(type, id) {
  if (!type && !id) return "—";
  return `${type} #${id}`;
}

function CategoryDot({ category }) {
  return (
    <span
      className="audit-cat-dot"
      style={{ background: CATEGORY_DOT_COLORS[category] || "#9CA3AF" }}
    />
  );
}

function SeverityBadge({ severity }) {
  const style = SEVERITY_STYLES[severity] || {};
  return (
    <span className="audit-severity-badge" style={style}>
      {severity}
    </span>
  );
}

function MetadataPanel({ event }) {
  const entries = event.metadata ? Object.entries(event.metadata) : [];
  return (
    <div className="audit-metadata-panel">
      <div className="audit-metadata-header">
        <span className="audit-metadata-icon" aria-hidden="true">ℹ️</span>
        Event Metadata · {event.event_name}
      </div>
      <div className="audit-meta-cards">
        {entries.length === 0 ? (
          <p className="audit-meta-empty">No metadata available.</p>
        ) : (
          entries.map(([k, v]) => (
            <div key={k} className="audit-meta-card">
              <div className="audit-meta-key">{k.toUpperCase()}</div>
              <div className="audit-meta-value">
                {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="audit-skeleton-row">
          {[120, 90, 160, 70, 140, 100, 24].map((w, j) => (
            <div key={j} className="skeleton" style={{ width: w, height: 16 }} />
          ))}
        </div>
      ))}
    </>
  );
}

function AuditLog() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedRow, setExpandedRow] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportWarning, setExportWarning] = useState(false);

  // UI filter state (immediate, drives display)
  const [categories, setCategories] = useState([]);
  const [severities, setSeverities] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState("");

  // Debounced values — drive the API call (300 ms)
  const [debouncedDateFrom, setDebouncedDateFrom] = useState("");
  const [debouncedDateTo, setDebouncedDateTo] = useState("");
  const [debouncedActorEmail, setDebouncedActorEmail] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedDateFrom(dateFrom), 300);
    return () => clearTimeout(t);
  }, [dateFrom]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedDateTo(dateTo), 300);
    return () => clearTimeout(t);
  }, [dateTo]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedActorEmail(actorEmail), 300);
    return () => clearTimeout(t);
  }, [actorEmail]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Derived validation — shown immediately from UI state, not debounced
  const dateErrorMsg =
    dateFrom && dateTo && dateTo < dateFrom
      ? "Date To must be on or after Date From."
      : "";

  const fetchEvents = useCallback(
    async (pageNum) => {
      // Use debounced date values for the validation guard too
      if (debouncedDateFrom && debouncedDateTo && debouncedDateTo < debouncedDateFrom) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        categories.forEach((v) => params.append("category", v));
        severities.forEach((v) => params.append("severity", v));
        if (debouncedDateFrom) params.set("date_from", debouncedDateFrom);
        if (debouncedDateTo) params.set("date_to", debouncedDateTo);
        if (debouncedActorEmail.trim()) params.set("actor_email", debouncedActorEmail.trim());
        if (entityType) params.set("entity_type", entityType);
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        params.set("page", pageNum);
        params.set("page_size", 25);
        const data = await apiFetch("/admin/audit-log?" + params.toString());
        setEvents(data.items);
        setTotalCount(data.total_count);
        setPage(data.page);
        setTotalPages(data.total_pages);
        setExportWarning(data.total_count > 1000);
      } catch (err) {
        setError(err.message || "Failed to load audit log.");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      categories,
      severities,
      debouncedDateFrom,
      debouncedDateTo,
      debouncedActorEmail,
      entityType,
      debouncedSearch,
    ]
  );

  useEffect(() => {
    fetchEvents(1);
  }, [fetchEvents]);

  const toggleCategory = (cat) =>
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const toggleSeverity = (sev) =>
    setSeverities((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
    );

  const clearAllFilters = () => {
    setCategories([]);
    setSeverities([]);
    setDateFrom("");
    setDateTo("");
    setActorEmail("");
    setEntityType("");
    setSearch("");
    // Reset debounced values immediately so the API fires without delay
    setDebouncedDateFrom("");
    setDebouncedDateTo("");
    setDebouncedActorEmail("");
    setDebouncedSearch("");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      categories.forEach((v) => params.append("category", v));
      severities.forEach((v) => params.append("severity", v));
      if (debouncedDateFrom) params.set("date_from", debouncedDateFrom);
      if (debouncedDateTo) params.set("date_to", debouncedDateTo);
      if (debouncedActorEmail.trim()) params.set("actor_email", debouncedActorEmail.trim());
      if (entityType) params.set("entity_type", entityType);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

      const blob = await apiFetchBlob("/admin/audit-log/export?" + params.toString());
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `audit_log_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success("Exported audit log as CSV.");
    } catch (err) {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const toggleRow = (id) =>
    setExpandedRow((prev) => (prev === id ? null : id));

  const hasFilters =
    categories.length > 0 ||
    severities.length > 0 ||
    dateFrom !== "" ||
    dateTo !== "" ||
    actorEmail !== "" ||
    entityType !== "" ||
    search !== "";

  return (
    <div className="audit-log-page">
      {/* Header */}
      <div className="audit-header-row">
        <div>
          <h1 className="audit-page-title">Platform Audit Log</h1>
          <p className="audit-page-subtitle">
            Tamper-visible record of all platform events.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {/* Export warning banner */}
      {exportWarning && (
        <div className="audit-export-warning" role="alert">
          ⚠️ Export is limited to 1,000 rows. Apply additional filters to narrow results.
        </div>
      )}

      {/* Filter card */}
      <div className="audit-filter-card">
        <div className="audit-filter-row">
          <input
            className="audit-input"
            type="text"
            placeholder="Search actor email or entity ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            className="audit-input"
            type="text"
            placeholder="Filter by actor email…"
            value={actorEmail}
            onChange={(e) => setActorEmail(e.target.value)}
          />
          <select
            className="audit-select"
            value={entityType}
            aria-label="Entity Type"
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">All Entity Types</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className="audit-date-group">
            <label htmlFor="audit-date-from" className="audit-date-label">From</label>
            <input
              id="audit-date-from"
              type="date"
              className="audit-input audit-date-input"
              aria-label="Date From"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="audit-date-group">
            <label htmlFor="audit-date-to" className="audit-date-label">To</label>
            <input
              id="audit-date-to"
              type="date"
              className="audit-input audit-date-input"
              aria-label="Date To"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        {dateErrorMsg && (
          <p className="audit-date-error" role="alert">{dateErrorMsg}</p>
        )}

        <div className="audit-chip-row">
          <span className="audit-chip-label">Category</span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`audit-chip${categories.includes(cat) ? " audit-chip-active" : ""}`}
              onClick={() => toggleCategory(cat)}
            >
              <CategoryDot category={cat} />
              {cat}
            </button>
          ))}
          <span className="audit-chip-divider" aria-hidden="true" />
          <span className="audit-chip-label">Severity</span>
          {SEVERITIES.map((sev) => (
            <button
              key={sev}
              className={`audit-chip${severities.includes(sev) ? " audit-chip-active" : ""}`}
              onClick={() => toggleSeverity(sev)}
            >
              {sev}
            </button>
          ))}
          {hasFilters && (
            <button className="audit-clear-all-btn" onClick={clearAllFilters}>
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Results bar */}
      {!loading && !error && (
        <div className="audit-results-bar">
          <span>
            Showing <strong>{events.length}</strong> of <strong>{totalCount}</strong> events
          </span>
          <span>Page {page} / {totalPages}</span>
        </div>
      )}

      {/* Table card */}
      <div className="audit-table-card">
        {loading ? (
          <div className="audit-skeleton-wrapper" aria-label="Loading audit log">
            <SkeletonRows />
          </div>
        ) : error ? (
          <div className="audit-error-state">
            <p className="audit-error-msg">⚠️ {error}</p>
            <button className="btn btn-primary" onClick={() => fetchEvents(1)}>
              Retry
            </button>
          </div>
        ) : totalCount === 0 ? (
          <div className="audit-empty-state">
            <div className="audit-empty-icon" aria-hidden="true">🔍</div>
            <p className="audit-empty-title">No events match your current filters.</p>
            <p className="audit-empty-subtitle">Adjust or remove filters to see more results.</p>
            <button className="btn btn-primary" onClick={clearAllFilters}>
              Clear Filters
            </button>
          </div>
        ) : (
          <table className="audit-table" aria-label="Audit log">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Category</th>
                <th>Event</th>
                <th>Severity</th>
                <th>Actor</th>
                <th>Entity</th>
                <th aria-label="Expand" />
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const isExpanded = expandedRow === ev.id;
                return (
                  <React.Fragment key={ev.id}>
                    <tr
                      className={`audit-row${isExpanded ? " audit-row-expanded" : ""}`}
                      onClick={() => toggleRow(ev.id)}
                      aria-expanded={isExpanded}
                    >
                      <td className="audit-ts">{formatTs(ev.created_at)}</td>
                      <td className="audit-cat">
                        <CategoryDot category={ev.category} />
                        {ev.category}
                      </td>
                      <td className="audit-event-name">{ev.event_name}</td>
                      <td><SeverityBadge severity={ev.severity} /></td>
                      <td className="audit-actor" title={ev.actor_email}>{ev.actor_email}</td>
                      <td>{entityLabel(ev.entity_type, ev.entity_id)}</td>
                      <td className="audit-expand-arrow" aria-hidden="true">
                        {isExpanded ? "▲" : "▾"}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="audit-meta-row">
                        <td colSpan={7} style={{ padding: 0 }}>
                          <MetadataPanel event={ev} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination — shown whenever we have data (even while re-fetching a page change) */}
      {totalCount > 0 && (
        <div className="audit-pagination">
          <button
            className="btn btn-secondary"
            disabled={page <= 1}
            onClick={() => {
              const p = page - 1;
              setPage(p);
              fetchEvents(p);
            }}
          >
            Previous
          </button>
          <span className="audit-page-badge">{page}</span>
          <span className="audit-page-of">of {totalPages}</span>
          <button
            className="btn btn-secondary"
            disabled={page >= totalPages}
            onClick={() => {
              const p = page + 1;
              setPage(p);
              fetchEvents(p);
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default AuditLog;
