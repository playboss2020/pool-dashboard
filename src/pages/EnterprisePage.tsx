import {
  Camera,
  CheckCircle2,
  Clock3,
  Database,
  DoorClosed,
  Lock,
  RefreshCw,
  ShieldCheck,
  Thermometer,
} from "lucide-react";
import { useSmartHome } from "../hooks/useSmartHome";
import type { SmartHomeDevice, SmartHomeIntegration } from "../lib/smartHomeApi";

const integrationCards = [
  {
    provider: "Ecobee",
    type: "Thermostats",
    status: "Access paused",
    detail: "Ready when Ecobee approves new developer registrations.",
    icon: Thermometer,
  },
  {
    provider: "Google Nest",
    type: "Thermostats & cameras",
    status: "First OAuth target",
    detail: "Device Access approval, events, and privacy-safe media.",
    icon: Camera,
  },
  {
    provider: "Schlage / Yale",
    type: "Smart locks",
    status: "Partner access required",
    detail: "Lock state, audited commands, and access-code controls.",
    icon: Lock,
  },
];

function formatTime(value: string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusNumber(value: unknown, fallback = "--") {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value).toString() : fallback;
}

function providerConnected(integrations: SmartHomeIntegration[], providerId: string) {
  return integrations.some((integration) => integration.provider_id === providerId && integration.status === "connected");
}

function DeviceCard({
  device,
  busy,
  onCommand,
}: {
  device: SmartHomeDevice;
  busy: boolean;
  onCommand: (deviceId: string, commandType: string, payload?: Record<string, unknown>) => void;
}) {
  const status = device.current_status ?? {};

  if (device.device_type === "thermostat") {
    const target = Number(status.targetTemperatureF ?? 76);
    return (
      <article className="enterprise-live-device">
        <div className="enterprise-card-icon">
          <Thermometer size={21} />
        </div>
        <div className="enterprise-live-device-main">
          <span>{device.room_name || "Thermostat"}</span>
          <strong>{device.display_name}</strong>
          <p>
            {statusNumber(status.temperatureF)}° now / {statusNumber(status.humidityPercent)}% humidity
          </p>
        </div>
        <div className="enterprise-device-controls">
          <button
            type="button"
            disabled={busy}
            onClick={() => onCommand(device.id, "set_temperature", { targetTemperatureF: target - 1 })}
            aria-label={`Lower ${device.display_name} setpoint`}
          >
            -
          </button>
          <strong>{statusNumber(status.targetTemperatureF)}°</strong>
          <button
            type="button"
            disabled={busy}
            onClick={() => onCommand(device.id, "set_temperature", { targetTemperatureF: target + 1 })}
            aria-label={`Raise ${device.display_name} setpoint`}
          >
            +
          </button>
        </div>
      </article>
    );
  }

  if (device.device_type === "lock") {
    const locked = status.locked !== false;
    return (
      <article className="enterprise-live-device">
        <div className="enterprise-card-icon">
          <Lock size={21} />
        </div>
        <div className="enterprise-live-device-main">
          <span>{device.room_name || "Lock"}</span>
          <strong>{device.display_name}</strong>
          <p>{statusNumber(status.batteryPercent)}% battery</p>
        </div>
        <button
          className={locked ? "enterprise-command-button locked" : "enterprise-command-button"}
          type="button"
          disabled={busy}
          onClick={() => onCommand(device.id, locked ? "unlock" : "lock")}
        >
          {locked ? "Unlock" : "Lock"}
        </button>
      </article>
    );
  }

  return (
    <article className="enterprise-live-device">
      <div className="enterprise-card-icon">
        <Camera size={21} />
      </div>
      <div className="enterprise-live-device-main">
        <span>{device.room_name || "Camera"}</span>
        <strong>{device.display_name}</strong>
        <p>{String(status.latestEventType ?? "No events")} / {formatTime(String(status.latestEventAt ?? ""))}</p>
      </div>
      <span className="enterprise-mini-status">{device.online_status}</span>
    </article>
  );
}

export function EnterprisePage() {
  const smartHome = useSmartHome(true);
  const property = smartHome.data?.property;
  const integrations = smartHome.data?.integrations ?? [];
  const devices = smartHome.data?.devices ?? [];
  const recentCommands = smartHome.data?.recent_commands ?? [];
  const demoConnected = providerConnected(integrations, "mock");
  const googleConnected = providerConnected(integrations, "google_home");
  const hasConnectedIntegration = integrations.some((i) => i.status === "connected");

  return (
    <div className="screen-stack enterprise-page">
      <section className="section-heading">
        <div>
          <span className="eyebrow">Enterprise</span>
          <h2>{property?.name ?? "Property Control"}</h2>
        </div>
        <span className="status-pill enterprise-status">
          <Database size={14} />
          Core
        </span>
      </section>

      {smartHome.loading ? <div className="loading-box">Loading Enterprise...</div> : null}
      {smartHome.error ? <div className="error-box">{smartHome.error}</div> : null}

      <section className="enterprise-hero">
        <div>
          <span className="eyebrow">Smart Home Module</span>
          <h3>{devices.length > 0 ? `${devices.length} smart devices linked to this property.` : "Enterprise core is ready for account-linked devices."}</h3>
        </div>
        <div className="enterprise-health-grid" aria-label="Enterprise module status">
          <div>
            <CheckCircle2 size={18} />
            <strong>{integrations.length}</strong>
            <span>Integrations</span>
          </div>
          <div>
            <Clock3 size={18} />
            <strong>{formatTime(integrations[0]?.last_sync_at)}</strong>
            <span>Last sync</span>
          </div>
        </div>
      </section>

      <section className="enterprise-activity">
        <div className="enterprise-section-title">
          <ShieldCheck size={16} />
          <span>Core Controls</span>
        </div>
        <div className="enterprise-action-grid">
          <button className="primary-button compact" type="button" disabled={smartHome.busy === "google"} onClick={smartHome.connectGoogleHome}>
            <ShieldCheck size={18} />
            <span>{googleConnected ? "Reconnect Google" : "Connect Google"}</span>
          </button>
          <button className="primary-button compact" type="button" disabled={smartHome.busy === "connect"} onClick={smartHome.connectDemo}>
            <Database size={18} />
            <span>{demoConnected ? "Reconnect Demo" : "Connect Demo"}</span>
          </button>
          <button className="secondary-button compact" type="button" disabled={!hasConnectedIntegration || smartHome.busy === "sync"} onClick={smartHome.syncDevices}>
            <RefreshCw size={18} />
            <span>Sync</span>
          </button>
        </div>
      </section>

      {devices.length > 0 ? (
        <section className="enterprise-section">
          <div className="enterprise-section-title">
            <Thermometer size={16} />
            <span>Live Devices</span>
          </div>
          <div className="enterprise-card-list">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                busy={smartHome.busy === device.id}
                onCommand={(deviceId, commandType, payload) => void smartHome.sendCommand(deviceId, commandType, payload)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="enterprise-section">
        <div className="enterprise-section-title">
          <Thermometer size={16} />
          <span>Integration Roadmap</span>
        </div>
        <div className="enterprise-card-list">
          {integrationCards.map((card) => {
            const Icon = card.icon;
            return (
              <article className="enterprise-integration-card" key={card.provider}>
                <div className="enterprise-card-icon">
                  <Icon size={21} />
                </div>
                <div>
                  <span>{card.type}</span>
                  <strong>{card.provider}</strong>
                  <p>{card.detail}</p>
                </div>
                <small>{card.status}</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="enterprise-section">
        <div className="enterprise-section-title">
          <ShieldCheck size={16} />
          <span>Recent Commands</span>
        </div>
        <div className="enterprise-command-list">
          {recentCommands.length === 0 ? (
            <div className="enterprise-empty-line">No smart-home commands yet.</div>
          ) : (
            recentCommands.map((command) => (
              <div className="enterprise-command-row" key={command.id}>
                <span>{command.command_type.replace(/_/g, " ")}</span>
                <strong>{command.status}</strong>
                <small>{formatTime(command.created_at)}</small>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="enterprise-device-strip" aria-label="Future enterprise device groups">
        <div>
          <Thermometer size={17} />
          <span>Thermostats</span>
        </div>
        <div>
          <DoorClosed size={17} />
          <span>Locks</span>
        </div>
        <div>
          <Camera size={17} />
          <span>Cameras</span>
        </div>
      </section>
    </div>
  );
}
