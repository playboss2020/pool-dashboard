import "./instrument";

import * as Sentry from "@sentry/react";
import { reactErrorHandler } from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";

if (new URLSearchParams(window.location.search).get("sentry-test") === "1") {
  const eventId = Sentry.captureException(new Error("Sentry production test from URL"));
  Sentry.flush(2000).then(() => {
    document.body.innerHTML = `<div style="padding:40px;font-family:system-ui;color:#fff;background:#000;min-height:100vh;text-align:center"><h1>Sentry test fired</h1><p>Event ID: ${eventId}</p><p>Refresh your Sentry Issues page in ~30 seconds.</p></div>`;
  });
} else {
  createRoot(document.getElementById("root")!, {
    onUncaughtError: reactErrorHandler(),
    onCaughtError: reactErrorHandler(),
    onRecoverableError: reactErrorHandler(),
  }).render(<App />);
}
