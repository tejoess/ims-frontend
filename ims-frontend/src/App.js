import { useState, useEffect, useCallback } from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Policies from "./pages/Policies";
import RiskProfile from "./pages/RiskProfile";
import Recommendations from "./pages/Recommendations";
import UploadClaim from "./pages/UploadClaim";
import MyClaims from "./pages/MyClaims";
import MyPolicies from "./pages/MyPolicies";
import AdminDashboard from "./pages/AdminDashboard";
import AuditLog from "./pages/AuditLog";
import ComparePage from "./pages/ComparePage";
import AppLayout from "./components/AppLayout";
import { apiFetch, SESSION_EXPIRED_EVENT } from "./utils/apiClient";
import { useToast } from "./context/ToastContext";

function App() {
  const toast = useToast();
  const [page, setPage] = useState("login");
  const [userId, setUserId] = useState(null);
  const [selectedClaimId, setSelectedClaimId] = useState(null);
  const [comparePolicies, setComparePolicies] = useState([]);
  const [checkingSession, setCheckingSession] = useState(true);

  const logout = useCallback(() => {
    localStorage.clear();
    setUserId(null);
    setPage("login");
  }, []);

  useEffect(() => {
    const onSessionExpired = () => {
      toast.error("Your session has expired. Please log in again.");
      logout();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [toast, logout]);

  useEffect(() => {
    const checkSession = async () => {
      const storedUserId = localStorage.getItem("user_id");
      const token = localStorage.getItem("token");

      if (!storedUserId || !token) {
        localStorage.clear();
        setPage("login");
        setCheckingSession(false);
        return;
      }

      try {
        await apiFetch("/policies");
        setUserId(storedUserId);
        setPage(localStorage.getItem("is_admin") === "true" ? "admin" : "policies");
      } catch (error) {
        localStorage.clear();
        setPage("login");
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checkingSession) {
    return (
      <div className="page-loader" style={{ minHeight: "100vh" }}>
        <span className="spinner spinner-dark" />
        Loading Edme Insurance…
      </div>
    );
  }

  const token = localStorage.getItem("token");
  const isAuthenticated = !!token;
  const isAdmin = localStorage.getItem("is_admin") === "true";

  if (!isAuthenticated) {
    if (page === "signup") {
      return <Signup goToLogin={() => setPage("login")} />;
    }
    return (
      <Login
        onLoginSuccess={(id) => {
          setUserId(id);
          setPage(localStorage.getItem("is_admin") === "true" ? "admin" : "policies");
        }}
        goToSignup={() => setPage("signup")}
      />
    );
  }

  const renderPage = () => {
    switch (page) {
      case "risk":
        return <RiskProfile userId={userId} onSubmitSuccess={(next) => setPage(next)} />;

      case "recommendations":
        return <Recommendations userId={userId} onBack={() => setPage("policies")} />;

      case "mypolicies":
        return <MyPolicies onBack={() => setPage("policies")} />;

      case "claims":
        return <MyClaims onBack={() => setPage("policies")} />;

      case "upload":
        return <UploadClaim claimId={selectedClaimId} onBack={() => setPage("claims")} />;

      case "admin":
        return <AdminDashboard />;

      case "auditlog":
        return <AuditLog />;

      case "compare":
        return <ComparePage policies={comparePolicies} onBack={() => setPage("policies")} />;

      default:
        return (
          <Policies
            goToUpload={(claimId) => {
              setSelectedClaimId(claimId);
              setPage("upload");
            }}
            goToComparePage={(policies) => {
              setComparePolicies(policies);
              setPage("compare");
            }}
          />
        );
    }
  };

  const activeKey = page === "upload" || page === "compare" ? "policies" : page;

  return (
    <AppLayout active={activeKey} isAdmin={isAdmin} onNavigate={setPage} onLogout={logout}>
      {renderPage()}
    </AppLayout>
  );
}

export default App;
