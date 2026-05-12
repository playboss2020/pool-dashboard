import { useState } from "react";
import { CheckCircle2, Plus, Search, X } from "lucide-react";
import type { PoolDevice } from "../lib/deviceApi";

type HubSwitcherSheetProps = {
  devices: PoolDevice[];
  selectedDeviceId: string;
  onClose: () => void;
  onSelectDevice: (deviceId: string) => void;
  onAddDevice?: () => void;
};

function formatValue(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${Number(value).toFixed(suffix === " kWh" ? 2 : 0)}${suffix}`;
}

function wasSeenRecently(lastSeen: string | null | undefined) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 120000;
}

function hubStatus(device: Pick<PoolDevice, "last_seen" | "online_status">) {
  return device.online_status === "online" && wasSeenRecently(device.last_seen) ? "Online" : "Offline";
}

export function HubSwitcherSheet({ devices, selectedDeviceId, onClose, onSelectDevice, onAddDevice }: HubSwitcherSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const trimmed = searchQuery.trim().toLowerCase();
  const filteredDevices = trimmed
    ? devices.filter((device) => {
        const haystack = [
          device.name ?? "",
          device.serial_number ?? "",
          device.device_id ?? "",
        ].join(" ").toLowerCase();
        return haystack.includes(trimmed);
      })
    : devices;

  function renderHubCard(hub: PoolDevice) {
    const selected = hub.device_id === selectedDeviceId;
    const status = hubStatus(hub);
    return (
      <button
        className={selected ? "hub-switch-card selected" : "hub-switch-card"}
        type="button"
        key={hub.device_id}
        disabled={selected}
        onClick={() => onSelectDevice(hub.device_id)}
      >
        <div className="hub-switch-main">
          <span className={status === "Online" ? "hub-status-dot online" : "hub-status-dot"} />
          <div>
            <strong>{hub.name || "Pool Hub"}</strong>
            <small>{hub.serial_number || hub.device_id}</small>
          </div>
        </div>
        <div className="hub-switch-metrics">
          <span>{formatValue(hub.current_temp, "°F")}</span>
          <span>{hub.pump_on ? "Pump on" : "Pump off"}</span>
          <span>{hub.heater_enabled ? "Heat on" : "Heat off"}</span>
        </div>
        {selected ? (
          <span className="hub-selected-pill">
            <CheckCircle2 size={14} />
            Active
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="calibration-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="hub-switch-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="health-sheet-header">
          <div>
            <span className="eyebrow">My Hubs</span>
            <h3>Switch Pool</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close hub switcher">
            <X size={20} />
          </button>
        </div>

        <div className="hub-switch-toolbar">
          <div className="hub-switch-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name or serial…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                className="hub-switch-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          {onAddDevice ? (
            <button
              type="button"
              className="hub-switch-add"
              onClick={onAddDevice}
              aria-label="Add a new hub"
              title="Claim a new hub"
            >
              <Plus size={18} />
            </button>
          ) : null}
        </div>

        <div className="hub-switch-list">
          {devices.length === 0 ? (
            <div className="hub-switch-empty">
              <strong>No claimed hubs yet</strong>
              <span>Tap the + above to claim your first hub by serial number.</span>
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="hub-switch-empty">
              <strong>No hubs match "{searchQuery}"</strong>
              <span>Try a different serial, name, or address.</span>
            </div>
          ) : (
            filteredDevices.map(renderHubCard)
          )}
        </div>
      </div>
    </div>
  );
}
