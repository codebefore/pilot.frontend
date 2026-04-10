import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { applyRuntimeConfig } from "./lib/api";
import "./styles/index.css";

async function bootstrap() {
  try {
    const response = await fetch("/env-config.json", { cache: "no-store" });

    if (response.ok) {
      const config = (await response.json()) as {
        apiBaseUrl?: string;
        publicUrl?: string;
      };

      applyRuntimeConfig(config);
    }
  } catch {
    // The app can still use build-time defaults when runtime config is unavailable.
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void bootstrap();
