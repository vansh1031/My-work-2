import { useState } from "react";
import type { ApiError } from "../lib/api";
import { DATA_MODE } from "../lib/api";
import { defaultServerAddress, getServerAddress, setServerAddress } from "../lib/serverAddress";
import { ErrorNotice } from "./Notice";

/** Shown when the server cannot be reached at startup. Lets the user retry or, if allowed, change the address. */
export function ConnectionScreen({ error, onRetry }: { error: ApiError; onRetry(): void }) {
  const [address, setAddress] = useState(getServerAddress() || defaultServerAddress());
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>{DATA_MODE === "server" ? "Cannot connect" : "Cannot start"}</h1>
        <ErrorNotice error={error} />
        {__ALLOW_SERVER_CHANGE__ && DATA_MODE === "server" && (
          <div className="field">
            <label htmlFor="server">Server address</label>
            <input id="server" className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="https://atlas.example.com" />
            <span className="hint">Ask your administrator for the address if you do not know it.</span>
          </div>
        )}
        <div className="row">
          <button
            className="btn btn-primary"
            onClick={() => {
              if (__ALLOW_SERVER_CHANGE__ && DATA_MODE === "server") setServerAddress(address.trim() === defaultServerAddress() ? null : address.trim());
              onRetry();
            }}
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
