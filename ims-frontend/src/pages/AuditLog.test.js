/* TC-001..TC-019 — EPT-28: Frontend: Platform Audit Trail
   AC-01..AC-11 coverage per test-plan.md */

import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuditLog from "./AuditLog";
import Sidebar from "../components/Sidebar";
import { apiFetch, apiFetchBlob } from "../utils/apiClient";

jest.mock("../utils/apiClient", () => ({
  apiFetch: jest.fn(),
  apiFetchBlob: jest.fn(),
  SESSION_EXPIRED_EVENT: "covermate:session-expired",
}));

jest.mock("../context/ToastContext", () => ({
  useToast: () => ({ error: jest.fn(), success: jest.fn() }),
}));

jest.mock("../context/ConfirmContext", () => ({
  useConfirm: () => async () => false,
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

const EVENT_1 = {
  id: 1,
  event_name: "CLAIM_FRAUD_FLAGGED",
  category: "Claims",
  actor_email: "system@fraud-engine",
  entity_type: "Claim",
  entity_id: "42",
  severity: "WARNING",
  metadata: { claim_id: 42, flag_types: ["HIGH_AMOUNT"] },
  created_at: "2026-10-06T09:00:00Z",
};

const EVENT_2 = {
  id: 2,
  event_name: "USER_LOGIN_SUCCESS",
  category: "Authentication",
  actor_email: "user@example.com",
  entity_type: "User",
  entity_id: "5",
  severity: "INFO",
  metadata: { user_id: 5, email: "user@example.com" },
  created_at: "2026-10-06T08:00:00Z",
};

function makeResp(items = [EVENT_1], totalOverride, extra = {}) {
  const total = totalOverride !== undefined ? totalOverride : items.length;
  return {
    items,
    total_count: total,
    page: 1,
    page_size: 25,
    total_pages: Math.max(1, Math.ceil(total / 25)),
    ...extra,
  };
}

function make25Items(base = EVENT_1) {
  return Array.from({ length: 25 }, (_, i) => ({ ...base, id: i + 1 }));
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = jest.fn();
  localStorage.clear();
  localStorage.setItem("email", "admin@demo.com");
  localStorage.setItem("token", "fake-token");
  localStorage.setItem("is_admin", "true");
  apiFetch.mockReset();
  apiFetchBlob.mockReset();
});

// ── AC-01: sidebar link ──────────────────────────────────────────────────────

describe("TC-001–002 / AC-01: admin sidebar link", () => {
  test("TC-001 / AC-01: 'Platform Audit Log' link appears for admin and not for customer", () => {
    const { rerender } = render(
      <Sidebar active="auditlog" isAdmin={true} onNavigate={jest.fn()} onLogout={jest.fn()} />
    );
    expect(screen.getByRole("button", { name: /platform audit log/i })).toBeInTheDocument();

    rerender(
      <Sidebar active="policies" isAdmin={false} onNavigate={jest.fn()} onLogout={jest.fn()} />
    );
    expect(screen.queryByRole("button", { name: /platform audit log/i })).not.toBeInTheDocument();
  });

  test("TC-002 / AC-01: clicking the link calls onNavigate with 'auditlog'", async () => {
    const navigate = jest.fn();
    render(
      <Sidebar active="admin" isAdmin={true} onNavigate={navigate} onLogout={jest.fn()} />
    );
    await userEvent.click(screen.getByRole("button", { name: /platform audit log/i }));
    expect(navigate).toHaveBeenCalledWith("auditlog");
  });
});

// ── AC-02: filter query params ───────────────────────────────────────────────

describe("TC-003–005 / AC-02: filter controls → API query params", () => {
  test("TC-003 / AC-02: selecting the 'Claims' category chip adds category=Claims to the API call", async () => {
    apiFetch.mockResolvedValue(makeResp());
    render(<AuditLog />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    apiFetch.mockClear();
    apiFetch.mockResolvedValue(makeResp());

    await userEvent.click(screen.getByRole("button", { name: /^claims$/i }));

    await waitFor(() => {
      const url = apiFetch.mock.calls[0]?.[0] ?? "";
      expect(url).toContain("category=Claims");
    });
  });

  test("TC-004 / AC-02: selecting category + severity chips both appear in the same request (AND)", async () => {
    apiFetch.mockResolvedValue(makeResp());
    render(<AuditLog />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    apiFetch.mockClear();
    apiFetch.mockResolvedValue(makeResp());

    await userEvent.click(screen.getByRole("button", { name: /^claims$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^warning$/i }));

    await waitFor(() => {
      const url = apiFetch.mock.calls.slice(-1)[0]?.[0] ?? "";
      expect(url).toContain("category=Claims");
      expect(url).toContain("severity=WARNING");
    });
  });

  test("TC-005 / AC-02: selecting two severity chips sends both (OR within type)", async () => {
    apiFetch.mockResolvedValue(makeResp());
    render(<AuditLog />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    apiFetch.mockClear();
    apiFetch.mockResolvedValue(makeResp());

    await userEvent.click(screen.getByRole("button", { name: /^info$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^warning$/i }));

    await waitFor(() => {
      const url = apiFetch.mock.calls.slice(-1)[0]?.[0] ?? "";
      expect(url).toContain("severity=INFO");
      expect(url).toContain("severity=WARNING");
    });
  });
});

// ── AC-03 / AC-04: text-input filters with debounce ─────────────────────────

describe("TC-006–007 / AC-03 & AC-04: text input filters", () => {
  test("TC-006 / AC-03: typing in Actor Email sends actor_email param after debounce", async () => {
    apiFetch.mockResolvedValue(makeResp());
    render(<AuditLog />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    apiFetch.mockClear();
    apiFetch.mockResolvedValue(makeResp());

    jest.useFakeTimers();
    const input = screen.getByPlaceholderText(/filter by actor email/i);
    fireEvent.change(input, { target: { value: "admin" } });
    await act(async () => { jest.advanceTimersByTime(350); });
    jest.useRealTimers();

    await waitFor(() => {
      const url = apiFetch.mock.calls[0]?.[0] ?? "";
      expect(url).toContain("actor_email=admin");
    });
  });

  test("TC-007 / AC-04: typing in Search sends search param after debounce", async () => {
    apiFetch.mockResolvedValue(makeResp());
    render(<AuditLog />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    apiFetch.mockClear();
    apiFetch.mockResolvedValue(makeResp());

    jest.useFakeTimers();
    const input = screen.getByPlaceholderText(/search actor email or entity id/i);
    fireEvent.change(input, { target: { value: "42" } });
    await act(async () => { jest.advanceTimersByTime(350); });
    jest.useRealTimers();

    await waitFor(() => {
      const url = apiFetch.mock.calls[0]?.[0] ?? "";
      expect(url).toContain("search=42");
    });
  });
});

// ── AC-05: empty state ───────────────────────────────────────────────────────

describe("TC-008–009 / AC-05: empty state + Clear Filters", () => {
  test("TC-008 / AC-05: zero results shows 'No events match your current filters.' and no table", async () => {
    apiFetch.mockResolvedValue(makeResp([], 0));
    render(<AuditLog />);
    await waitFor(() =>
      expect(screen.getByText(/no events match your current filters/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("TC-009 / AC-05: Clear Filters button in empty state resets filters and restores the table", async () => {
    apiFetch.mockResolvedValue(makeResp([EVENT_1]));
    render(<AuditLog />);
    await waitFor(() => screen.getByRole("table"));

    // Apply a filter that returns no results
    apiFetch.mockResolvedValue(makeResp([], 0));
    await userEvent.click(screen.getByRole("button", { name: /^claims$/i }));
    await waitFor(() => screen.getByText(/no events match your current filters/i));

    // Clear Filters should restore the table
    apiFetch.mockResolvedValue(makeResp([EVENT_1]));
    await userEvent.click(screen.getByRole("button", { name: /^clear filters$/i }));
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  });
});

// ── AC-06: row expand / collapse ────────────────────────────────────────────

describe("TC-010–011 / AC-06: row expand and collapse", () => {
  test("TC-010 / AC-06: clicking a table row expands the metadata panel", async () => {
    apiFetch.mockResolvedValue(makeResp([EVENT_1]));
    render(<AuditLog />);
    await waitFor(() => screen.getByRole("table"));

    const row = screen.getByText("CLAIM_FRAUD_FLAGGED").closest("tr");
    await userEvent.click(row);

    await waitFor(() =>
      expect(screen.getByText(/event metadata/i)).toBeInTheDocument()
    );
  });

  test("TC-011 / AC-06: clicking the expanded row again collapses the metadata panel", async () => {
    apiFetch.mockResolvedValue(makeResp([EVENT_1]));
    render(<AuditLog />);
    await waitFor(() => screen.getByRole("table"));

    const row = screen.getByText("CLAIM_FRAUD_FLAGGED").closest("tr");
    await userEvent.click(row); // expand
    await waitFor(() => screen.getByText(/event metadata/i));

    await userEvent.click(row); // collapse
    await waitFor(() =>
      expect(screen.queryByText(/event metadata/i)).not.toBeInTheDocument()
    );
  });
});

// ── AC-07: export CSV ────────────────────────────────────────────────────────

describe("TC-012 / AC-07: export CSV download", () => {
  test("TC-012 / AC-07: Export CSV calls apiFetchBlob with /admin/audit-log/export and triggers download", async () => {
    apiFetch.mockResolvedValue(makeResp([EVENT_1]));
    apiFetchBlob.mockResolvedValue(new Blob(["col1,val1"], { type: "text/csv" }));

    render(<AuditLog />);
    await waitFor(() => screen.getByRole("table"));

    await userEvent.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() => {
      expect(apiFetchBlob).toHaveBeenCalled();
      const url = apiFetchBlob.mock.calls[0][0];
      expect(url).toContain("/admin/audit-log/export");
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

// ── AC-08: pagination ────────────────────────────────────────────────────────

describe("TC-013–015 / AC-08: pagination", () => {
  test("TC-013 / AC-08: renders correct row count and results label on first page", async () => {
    const items = make25Items();
    apiFetch.mockResolvedValue({ items, total_count: 60, page: 1, page_size: 25, total_pages: 3 });
    render(<AuditLog />);
    await waitFor(() => screen.getByRole("table"));

    // 25 data rows rendered
    const dataRows = screen
      .getAllByRole("row")
      .filter((r) => !r.closest("thead"));
    expect(dataRows.length).toBe(25);

    // Results label contains totals
    expect(screen.getByText(/60/)).toBeInTheDocument();

    // Page indicator
    expect(screen.getByText(/page 1/i)).toBeInTheDocument();
  });

  test("TC-014 / AC-08: clicking Next fires API with page=2", async () => {
    const items = make25Items();
    apiFetch.mockResolvedValue({ items, total_count: 60, page: 1, page_size: 25, total_pages: 3 });
    render(<AuditLog />);
    await waitFor(() => screen.getByRole("table"));
    apiFetch.mockClear();
    apiFetch.mockResolvedValue({ items: [EVENT_2], total_count: 60, page: 2, page_size: 25, total_pages: 3 });

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      const url = apiFetch.mock.calls[0]?.[0] ?? "";
      expect(url).toContain("page=2");
    });
  });

  test("TC-015 / AC-08: Previous is disabled on page 1; enabled on page 2 and calls page=1", async () => {
    const items = make25Items();
    apiFetch.mockResolvedValue({ items, total_count: 60, page: 1, page_size: 25, total_pages: 3 });
    render(<AuditLog />);
    await waitFor(() => screen.getByRole("table"));

    // Disabled on page 1
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();

    // Navigate to page 2
    apiFetch.mockResolvedValue({ items: [EVENT_2], total_count: 60, page: 2, page_size: 25, total_pages: 3 });
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() =>
      apiFetch.mock.calls.some((c) => (c[0] ?? "").includes("page=2"))
    );
    apiFetch.mockClear();
    apiFetch.mockResolvedValue({ items, total_count: 60, page: 1, page_size: 25, total_pages: 3 });

    // Now enabled
    const prev = screen.getByRole("button", { name: /previous/i });
    expect(prev).not.toBeDisabled();
    await userEvent.click(prev);

    await waitFor(() => {
      const url = apiFetch.mock.calls[0]?.[0] ?? "";
      expect(url).toContain("page=1");
    });
  });
});

// ── AC-09: three-state UI ────────────────────────────────────────────────────

describe("TC-016–017 / AC-09: loading / error states", () => {
  test("TC-016 / AC-09: skeleton renders while the API request is in flight", () => {
    apiFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<AuditLog />);
    expect(document.querySelector(".skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("TC-017 / AC-09: error state shows a Retry button; clicking Retry re-fires the request", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Server error"));
    render(<AuditLog />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
    );

    apiFetch.mockResolvedValue(makeResp([EVENT_1]));
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  });
});

// ── AC-10: date validation ───────────────────────────────────────────────────

describe("TC-018 / AC-10: date range validation", () => {
  test("TC-018 / AC-10: Date To earlier than Date From shows validation message and makes no extra API call", async () => {
    apiFetch.mockResolvedValue(makeResp([EVENT_1]));
    render(<AuditLog />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    apiFetch.mockClear();

    const dateFrom = screen.getByLabelText(/date from/i);
    const dateTo = screen.getByLabelText(/date to/i);

    fireEvent.change(dateFrom, { target: { value: "2026-10-07" } });
    fireEvent.change(dateTo, { target: { value: "2026-10-01" } });

    await waitFor(() =>
      expect(
        screen.getByText(/date to must be on or after date from/i)
      ).toBeInTheDocument()
    );
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

// ── AC-11: export warning ────────────────────────────────────────────────────

describe("TC-019 / AC-11: export row-count warning", () => {
  test("TC-019 / AC-11: warning banner is visible when total_count > 1000", async () => {
    const items = make25Items();
    apiFetch.mockResolvedValue({ items, total_count: 1250, page: 1, page_size: 25, total_pages: 50 });
    render(<AuditLog />);
    await waitFor(() =>
      expect(
        screen.getByText(/export is limited to 1,?000 rows/i)
      ).toBeInTheDocument()
    );
  });
});
