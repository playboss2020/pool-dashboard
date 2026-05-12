import { useCallback, useEffect, useMemo, useState } from "react";
import {
  connectMockSmartHome,
  fetchSmartHomeBootstrap,
  sendSmartHomeCommand,
  startGoogleHomeOAuth,
  syncSmartHomeDevices,
  type SmartHomeBootstrap,
} from "../lib/smartHomeApi";

export function useSmartHome(enabled = true) {
  const [data, setData] = useState<SmartHomeBootstrap | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async (options: { quiet?: boolean } = {}) => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      setError("");
      return;
    }

    if (!options.quiet) setLoading(true);

    try {
      setError("");
      setData(await fetchSmartHomeBootstrap());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Enterprise");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const connectDemo = useCallback(async () => {
    setBusy("connect");
    try {
      setError("");
      await connectMockSmartHome();
      await refresh({ quiet: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect demo smart home");
    } finally {
      setBusy("");
    }
  }, [refresh]);

  const connectGoogleHome = useCallback(async () => {
    setBusy("google");
    try {
      setError("");
      const { authorization_url } = await startGoogleHomeOAuth();
      window.location.href = authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start Google Home authorization");
      setBusy("");
    }
  }, []);

  const syncDevices = useCallback(async () => {
    setBusy("sync");
    try {
      setError("");
      await syncSmartHomeDevices();
      await refresh({ quiet: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync smart home devices");
    } finally {
      setBusy("");
    }
  }, [refresh]);

  const sendCommand = useCallback(async (deviceId: string, commandType: string, payload: Record<string, unknown> = {}) => {
    setBusy(deviceId);
    try {
      setError("");
      await sendSmartHomeCommand(deviceId, commandType, payload);
      await refresh({ quiet: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send smart home command");
    } finally {
      setBusy("");
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      data,
      loading,
      busy,
      error,
      refresh,
      connectDemo,
      connectGoogleHome,
      syncDevices,
      sendCommand,
    }),
    [busy, connectDemo, connectGoogleHome, data, error, loading, refresh, sendCommand, syncDevices],
  );
}
