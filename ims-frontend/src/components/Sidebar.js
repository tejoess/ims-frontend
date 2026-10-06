import { useState } from "react";
import { useConfirm } from "../context/ConfirmContext";

const CUSTOMER_LINKS = [
  { key: "policies", label: "Policies", icon: "📄" },
  { key: "mypolicies", label: "My Policies", icon: "📑" },
  { key: "recommendations", label: "Recommendations", icon: "✨" },
  { key: "claims", label: "My Claims", icon: "🗂️" },
  { key: "risk", label: "Preferences", icon: "⚙️" },
];

const ADMIN_LINKS = [
  { key: "admin", label: "Admin Dashboard", icon: "🛠️" },
  { key: "auditlog", label: "Platform Audit Log", icon: "📋" },
];

function Sidebar({ active, isAdmin, onNavigate, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const confirm = useConfirm();
  const email = localStorage.getItem("email");
  const initials = (email || "?").slice(0, 2).toUpperCase();

  const links = isAdmin ? ADMIN_LINKS : CUSTOMER_LINKS;

  const go = (key) => {
    setMobileOpen(false);
    onNavigate(key);
  };

  const handleLogout = async () => {
    setMobileOpen(false);
    const ok = await confirm({
      title: "Log out?",
      message: "You'll need to sign in again to access your account.",
      confirmLabel: "Log out",
      tone: "danger",
    });
    if (ok) onLogout();
  };

  return (
    <>
      <header className="mobile-topbar">
        <div className="navbar-brand">
          <span className="navbar-brand-icon" aria-hidden="true">🛡️</span>
          Edme Insurance
        </div>
        <button
          className="navbar-menu-toggle"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          ☰
        </button>
      </header>

      {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="navbar-brand-icon" aria-hidden="true">🛡️</span>
          <span>Edme Insurance</span>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {links.map((link) => (
            <button
              key={link.key}
              className={`sidebar-link ${active === link.key ? "active" : ""}`}
              onClick={() => go(link.key)}
            >
              <span className="sidebar-link-icon" aria-hidden="true">
                {link.icon}
              </span>
              {link.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-email" title={email || ""}>
              {email}
            </div>
          </div>
          <button className="btn btn-secondary btn-block btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
