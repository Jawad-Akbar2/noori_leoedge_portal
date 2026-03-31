import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { EscapeStackProvider } from "./context/EscapeStack";

import ErrorBoundary from "./components/Common/ErrorBoundary";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <EscapeStackProvider>
        <App />
      </EscapeStackProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
