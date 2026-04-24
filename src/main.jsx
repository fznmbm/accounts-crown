import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { LicenceProvider } from "./context/LicenceContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <LicenceProvider>
        <App />
      </LicenceProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
