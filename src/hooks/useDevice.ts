import { useCallback, useEffect, useRef, useState } from "react";
import { deviceId, supabase } from "../lib/supabase";
import { fetchDevice, markStaleDevicesOffline, type PoolDevice } from "../lib/deviceApi";
import { isDirectMqttConfigured, subscribeDirectMqttState } from "../lib/mqttClient";

const DEVICE_REFRESH_MS = isDirectMqttConfigured() ? 60000 : 15000;
const DEVICE_HIDDEN_REFRESH_MS = 120000;
const DEVICE_REFRESH_BURST_MS = isDirectMqttConfigured()
  ? [2500, 10000]
  : [0, 1000, 3000, 7000, 15000];

function numberOrNull(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function useDevice() {
  const [device, setDevice] = useState<PoolDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const lastDeviceJsonRef = useRef("");
  const lastDeviceUpdatedAtRef = useRef(0);
  const refreshInFlightRef = useRef(false);
  const refreshBurstTimeoutsRef = useRef<number[]>([]);
  const deviceRef = useRef<PoolDevice | null>(null);

  const setDeviceIfChanged = useCallback((nextDevice: PoolDevice | null) => {
    const nextUpdatedAt = nextDevice?.updated_at ? new Date(nextDevice.updated_at).getTime() : 0;
    const lastUpdatedAt = lastDeviceUpdatedAtRef.current;

    if (nextUpdatedAt > 0 && lastUpdatedAt > 0 && nextUpdatedAt < lastUpdatedAt) return;

    const nextJson = JSON.stringify(nextDevice);
    if (lastDeviceJsonRef.current === nextJson) return;

    if (nextUpdatedAt >= lastUpdatedAt) {
      lastDeviceUpdatedAtRef.current = nextUpdatedAt;
    }

    lastDeviceJsonRef.current = nextJson;
    deviceRef.current = nextDevice;
    setDevice(nextDevice);
  }, []);

  const applyMqttState = useCallback(
    (payload: string) => {
      try {
        const state = JSON.parse(payload) as Partial<PoolDevice> & { ts?: number; published_at?: string };
        if (state.device_id && state.device_id !== deviceId) return;

        const current = deviceRef.current;

        // MQTT brokers deliver RETAINED messages (the last message they held)
        // when a client subscribes. That retained message could be days old —
        // it does NOT prove the hub is alive right now. So we never trust MQTT
        // alone for online_status or last_seen. The cloud row (updated by the
        // hub's device-state HTTP calls every ~30s) is the source of truth.
        //
        // If the payload carries a fresh `ts` (epoch seconds) or `published_at`
        // ISO string from the hub firmware, we accept it as a real liveness
        // signal — but only when it's recent (< 30s).
        const nowMs = Date.now();
        let publishedAtMs = 0;
        if (typeof state.ts === "number") {
          publishedAtMs = state.ts > 1e12 ? state.ts : state.ts * 1000;
        } else if (typeof state.published_at === "string") {
          const parsed = Date.parse(state.published_at);
          if (!Number.isNaN(parsed)) publishedAtMs = parsed;
        }
        const isLivePayload = publishedAtMs > 0 && (nowMs - publishedAtMs) < 30000;

        const nextDevice: PoolDevice = {
          id: current?.id ?? state.id ?? deviceId,
          user_id: current?.user_id ?? state.user_id ?? "",
          device_id: state.device_id ?? current?.device_id ?? deviceId,
          serial_number: current?.serial_number ?? state.serial_number ?? null,
          name: current?.name ?? state.name ?? "Pool Hub",
          current_temp: numberOrNull(state.current_temp),
          pump_on: Boolean(state.pump_on),
          heater_enabled: Boolean(state.heater_enabled),
          heater_relay_on: Boolean(state.heater_relay_on ?? state.heater_enabled),
          setpoint: numberOrNull(state.setpoint),
          pump_watts: numberOrNull(state.pump_watts),
          heater_watts: numberOrNull(state.heater_watts),
          total_kwh: numberOrNull(state.total_kwh),
          run_kwh: numberOrNull(state.run_kwh),
          last_run_kwh: numberOrNull(state.last_run_kwh),
          electricity_rate_per_kwh: current?.electricity_rate_per_kwh ?? numberOrNull(state.electricity_rate_per_kwh) ?? 0.18,
          temp_calibration_offset: numberOrNull(state.temp_calibration_offset),
          wattage_calibration_scale: numberOrNull(state.wattage_calibration_scale),
          // Preserve the cloud's last_seen / online_status. Only bump them if
          // the MQTT payload self-identifies as a fresh, live publish.
          last_seen: isLivePayload ? new Date().toISOString() : current?.last_seen ?? null,
          online_status: isLivePayload ? "online" : current?.online_status ?? "offline",
          firmware_version: state.firmware_version ?? current?.firmware_version ?? null,
          wifi_ssid: state.wifi_ssid ?? current?.wifi_ssid ?? null,
          wifi_rssi: typeof state.wifi_rssi === "number" ? state.wifi_rssi : current?.wifi_rssi ?? null,
          updated_at: current?.updated_at ?? new Date().toISOString(),
        };

        setDeviceIfChanged(nextDevice);
      } catch {
        // Ignore non-JSON MQTT messages on the state topic.
      }
    },
    [setDeviceIfChanged],
  );

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      setError("");
      // Flip any stale "online" rows to "offline" before reading. This keeps
      // cloud status in sync with reality without needing a server-side cron.
      // Fire-and-forget — don't block the actual fetch on this.
      void markStaleDevicesOffline().catch((err) => {
        console.warn("Stale offline check failed", err);
      });
      const nextDevice = await fetchDevice();
      setDeviceIfChanged(nextDevice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load device");
    } finally {
      refreshInFlightRef.current = false;
      setLoading(false);
    }
  }, [setDeviceIfChanged]);

  const refreshBurst = useCallback(() => {
    refreshBurstTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    refreshBurstTimeoutsRef.current = [];

    refreshBurstTimeoutsRef.current = DEVICE_REFRESH_BURST_MS.map((delay) =>
      window.setTimeout(() => {
        void refresh();
      }, delay),
    );

    return () => {
      refreshBurstTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      refreshBurstTimeoutsRef.current = [];
    };
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh();
    }, document.visibilityState === "hidden" ? DEVICE_HIDDEN_REFRESH_MS : DEVICE_REFRESH_MS);

    const handleFocus = () => {
      if (document.visibilityState !== "hidden") {
        void refresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.clearInterval(interval);
      refreshBurstTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [refresh]);

  useEffect(() => {
    const client = supabase;
    if (!client) return undefined;

    const channel = client
      .channel(`device:${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          setDeviceIfChanged(payload.new as PoolDevice);
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [setDeviceIfChanged]);

  useEffect(() => subscribeDirectMqttState(applyMqttState), [applyMqttState]);

  return { device, loading, error, refresh, refreshBurst };
}
