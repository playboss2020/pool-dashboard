import { useEffect, useState } from "react";
import { AddDeviceSheet } from "./components/AddDeviceSheet";
import { PoolShell } from "./components/PoolShell";
import { useAuth } from "./hooks/useAuth";
import { useAlerts } from "./hooks/useAlerts";
import { useDevice } from "./hooks/useDevice";
import { useDevices } from "./hooks/useDevices";
import { HubSwitcherSheet } from "./components/HubSwitcherSheet";
import { AlertsPage } from "./pages/AlertsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { DashboardPage, NoDeviceDashboard } from "./pages/DashboardPage";
import { EnterprisePage } from "./pages/EnterprisePage";
import { LoginPage } from "./pages/LoginPage";
import { SchedulesPage } from "./pages/SchedulesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useSubscription } from "./hooks/useSubscription";
import { SubscriptionSheet } from "./components/SubscriptionSheet";
import { Lock } from "lucide-react";
import { deviceId, selectDeviceId } from "./lib/supabase";
import "./styles.css";

type Tab = "dashboard" | "schedules" | "analytics" | "enterprise" | "alerts" | "settings";
const claimSuccessStorageKey = "pool-dashboard-claim-success";

const enterpriseFeatureFlag = import.meta.env.VITE_ENTERPRISE_DASHBOARD_ENABLED === "true";
const adminEmailList: string[] = ((import.meta.env.VITE_ADMIN_EMAILS as string | undefined) ?? "")
  .split(",")
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email: string | undefined | null) {
  if (!email) return false;
  return adminEmailList.includes(email.toLowerCase());
}

function getInitialTab(canSeeEnterprise: boolean): Tab {
  if (canSeeEnterprise) {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("smart_home") === "google_connected") return "enterprise";
    } catch {
      // ignore
    }
  }
  return "dashboard";
}

export default function App() {
  const auth = useAuth();
  const isAdmin = isAdminEmail(auth.user?.email);
  const enterpriseEnabled = enterpriseFeatureFlag && isAdmin;
  const [activeTab, setActiveTab] = useState<Tab>(() => getInitialTab(enterpriseEnabled));
  const [showHubSwitcher, setShowHubSwitcher] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState("");
  const [subSheetOpen, setSubSheetOpen] = useState(false);
  const [subSheetReason, setSubSheetReason] = useState<string | undefined>();
  const subscription = useSubscription(auth.user?.id);
  const { device, loading, error, refresh, refreshBurst } = useDevice();
  const devices = useDevices(Boolean(auth.user));
  const alerts = useAlerts(Boolean(auth.user));
  const checkingDevices = Boolean(auth.user) && devices.loading;
  const hasNoDevices = Boolean(auth.user) && !devices.loading && devices.devices.length === 0;

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("smart_home")) {
        params.delete("smart_home");
        const newSearch = params.toString();
        window.history.replaceState(
          {},
          "",
          newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname,
        );
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const message = window.sessionStorage.getItem(claimSuccessStorageKey);
      if (!message) return;
      window.sessionStorage.removeItem(claimSuccessStorageKey);
      setClaimSuccess(message);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!claimSuccess) return undefined;
    const timeout = window.setTimeout(() => setClaimSuccess(""), 6500);
    return () => window.clearTimeout(timeout);
  }, [claimSuccess]);

  useEffect(() => {
    if (!auth.user || devices.loading || devices.devices.length === 0) return;
    const selectedDeviceExists = devices.devices.some((nextDevice) => nextDevice.device_id === deviceId);
    if (selectedDeviceExists) return;

    selectDeviceId(devices.devices[0].device_id);
    window.location.reload();
  }, [auth.user, devices.devices, devices.loading]);

  function handleDeviceClaimed(nextDeviceId: string) {
    selectDeviceId(nextDeviceId);
    setShowAddDevice(false);
    const message = "Congratulations, your pool hub was added.";
    setClaimSuccess(message);
    try {
      window.sessionStorage.setItem(claimSuccessStorageKey, message);
    } catch {
      // ignore
    }
    window.setTimeout(() => window.location.reload(), 650);
  }

  if (!auth.configured) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>Supabase missing</h1>
          <p className="login-copy">Create `.env.local` from `.env.example` and add your anon key.</p>
        </div>
      </div>
    );
  }

  if (auth.loading) {
    return (
      <div className="login-screen">
        <div className="loading-box">Opening Pool Dashboard...</div>
      </div>
    );
  }

  if (!auth.user) {
    return <LoginPage />;
  }

  const subscriptionLocked = !subscription.loading && !subscription.active;

  function requireSubscription(reason: string) {
    setSubSheetReason(reason);
    setSubSheetOpen(true);
  }

  return (
    <PoolShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      alertCount={alerts.activeAlertCount}
      onHubSwitcherOpen={() => setShowHubSwitcher(true)}
      enterpriseEnabled={enterpriseEnabled}
    >
      {claimSuccess ? <div className="success-box app-success-banner">{claimSuccess}</div> : null}
      {subscriptionLocked ? (
        <div className="sub-locked-banner">
          <Lock size={16} />
          <div>
            <strong>View-only mode</strong>
            <span>Subscribe to control your pool, schedules, and devices.</span>
          </div>
          <button type="button" onClick={() => requireSubscription("unlock your account")}>Subscribe</button>
        </div>
      ) : null}
      {activeTab === "dashboard" && checkingDevices ? <div className="loading-box">Checking your hubs...</div> : null}
      {activeTab === "dashboard" && !checkingDevices && hasNoDevices ? (
        <NoDeviceDashboard error={devices.error} onAddDevice={() => setShowAddDevice(true)} />
      ) : null}
      {activeTab === "dashboard" && !checkingDevices && !hasNoDevices ? (
        <DashboardPage
          device={device}
          userId={auth.user.id}
          loading={loading}
          error={error || devices.error}
          onRefresh={refresh}
          onCommandSettled={refreshBurst}
          subscriptionLocked={subscriptionLocked}
          onSubscriptionRequired={requireSubscription}
        />
      ) : null}
      {activeTab === "schedules" ? <SchedulesPage userId={auth.user.id} /> : null}
      {activeTab === "analytics" ? <AnalyticsPage device={device} /> : null}
      {enterpriseEnabled && activeTab === "enterprise" ? <EnterprisePage /> : null}
      {activeTab === "alerts" ? <AlertsPage alerts={alerts} /> : null}
      {activeTab === "settings" ? <SettingsPage device={device} userId={auth.user.id} /> : null}
      {showHubSwitcher ? (
        <HubSwitcherSheet
          devices={devices.devices}
          selectedDeviceId={deviceId}
          onClose={() => setShowHubSwitcher(false)}
          onSelectDevice={(nextDeviceId) => {
            if (nextDeviceId === deviceId) return;
            selectDeviceId(nextDeviceId);
            window.location.reload();
          }}
        />
      ) : null}
      {showAddDevice ? <AddDeviceSheet onCancel={() => setShowAddDevice(false)} onClaimed={handleDeviceClaimed} /> : null}
      <SubscriptionSheet
        open={subSheetOpen}
        onClose={() => setSubSheetOpen(false)}
        triggerReason={subSheetReason}
      />
    </PoolShell>
  );
}
