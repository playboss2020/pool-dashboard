import { requireSupabase } from "./supabase";

export type SmartHomeProperty = {
  id: string;
  owner_user_id: string;
  name: string;
  address_label: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type SmartHomeProvider = {
  id: string;
  display_name: string;
  category: "thermostat" | "lock" | "camera" | "multi";
  supports_oauth: boolean;
  enabled: boolean;
  notes: string | null;
};

export type SmartHomeIntegration = {
  id: string;
  property_id: string;
  provider_id: string;
  status: "not_connected" | "connected" | "needs_reauth" | "disabled" | "error";
  scopes: string[];
  external_account_id: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type SmartHomeDevice = {
  id: string;
  property_id: string;
  integration_id: string;
  provider_id: string;
  external_device_id: string;
  device_type: "thermostat" | "lock" | "camera" | "unknown";
  display_name: string;
  room_name: string | null;
  capabilities: Record<string, unknown>;
  current_status: Record<string, unknown>;
  online_status: "online" | "offline" | "unknown" | "stale";
  last_seen_at: string | null;
  updated_at: string;
};

export type SmartHomeCommand = {
  id: string;
  property_id: string;
  device_id: string;
  requested_by_user_id: string | null;
  command_type: string;
  command_payload: Record<string, unknown>;
  status: "queued" | "sent" | "succeeded" | "failed" | "cancelled";
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export type SmartHomeBootstrap = {
  property: SmartHomeProperty;
  providers: SmartHomeProvider[];
  integrations: SmartHomeIntegration[];
  devices: SmartHomeDevice[];
  recent_commands: SmartHomeCommand[];
};

function requireFunctionData<T>(data: T | null, error: unknown, fallbackMessage: string): T {
  if (error) {
    const message = error instanceof Error ? error.message : fallbackMessage;
    throw new Error(message);
  }

  if (!data) throw new Error(fallbackMessage);
  return data;
}

export async function fetchSmartHomeBootstrap() {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<SmartHomeBootstrap>("smart-home-bootstrap", {
    body: {},
  });

  return requireFunctionData(data, error, "Unable to load Enterprise smart home data");
}

export async function connectMockSmartHome() {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<{ synced_devices: number }>("smart-home-mock-connect", {
    body: {},
  });

  return requireFunctionData(data, error, "Unable to connect demo smart home");
}

export async function startGoogleHomeOAuth() {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<{
    authorization_url: string;
    expires_at: string;
  }>("smart-home-google-oauth-start", {
    body: {
      redirect_to: window.location.origin,
    },
  });

  return requireFunctionData(data, error, "Unable to start Google Home authorization");
}

export async function syncSmartHomeDevices() {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<{ synced_devices: number }>("smart-home-sync-devices", {
    body: {},
  });

  return requireFunctionData(data, error, "Unable to sync smart home devices");
}

export async function sendSmartHomeCommand(
  deviceId: string,
  commandType: string,
  payload: Record<string, unknown> = {},
) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke<{
    command: SmartHomeCommand;
    device_status?: Record<string, unknown>;
    error?: string;
  }>("smart-home-command", {
    body: {
      device_id: deviceId,
      command_type: commandType,
      payload,
    },
  });

  return requireFunctionData(data, error, "Unable to send smart home command");
}
