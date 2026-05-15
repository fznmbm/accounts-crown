import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { LicenceProvider } from "./context/LicenceContext";
import "./index.css";

// ReactDOM.createRoot(document.getElementById("root")).render(
//   <React.StrictMode>
//     <ThemeProvider>
//       <LicenceProvider>
//         <App />
//       </LicenceProvider>
//     </ThemeProvider>
//   </React.StrictMode>,
// );

const app = (
  <ThemeProvider>
    <LicenceProvider>
      <App />
    </LicenceProvider>
  </ThemeProvider>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  import.meta.env.DEV ? <React.StrictMode>{app}</React.StrictMode> : app,
);
