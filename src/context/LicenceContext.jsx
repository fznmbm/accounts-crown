import { createContext, useContext, useEffect, useState } from "react";
import { validateLicence } from "../lib/licence";
import { CONFIG } from "../config";

const LicenceContext = createContext(null);

function BlockedScreen({ reason, client }) {
  const messages = {
    suspended: {
      icon: "🔒",
      title: "Subscription suspended",
      body: "Your subscription has been suspended. Please contact support to restore access.",
      color: "red",
    },
    expired: {
      icon: "⏰",
      title: "Subscription expired",
      body: "Your subscription has expired. Please renew to continue using the system.",
      color: "amber",
    },
    invalid_key: {
      icon: "⚠️",
      title: "Invalid licence",
      body: "This installation has an invalid licence key. Please contact support.",
      color: "red",
    },
    unreachable: {
      icon: "🌐",
      title: "Cannot verify licence",
      body: "Unable to reach the licence server. Please check your internet connection and try again.",
      color: "amber",
    },
  };

  const msg = messages[reason] || messages.invalid_key;
  const colors = {
    red: {
      bg: "bg-red-50   dark:bg-red-900/20",
      border: "border-red-200   dark:border-red-800",
      title: "text-red-800   dark:text-red-300",
      body: "text-red-700   dark:text-red-400",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      border: "border-amber-200 dark:border-amber-800",
      title: "text-amber-800 dark:text-amber-300",
      body: "text-amber-700 dark:text-amber-400",
    },
  };
  const c = colors[msg.color];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          {CONFIG.logoUrl ? (
            <img
              src={CONFIG.logoUrl}
              alt={CONFIG.companyName}
              className="h-10 object-contain"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: CONFIG.primaryColour }}
            >
              {CONFIG.companyInitials}
            </div>
          )}
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {CONFIG.companyName}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Transport Management
            </p>
          </div>
        </div>

        {/* Blocked card */}
        <div
          className={`${c.bg} ${c.border} border rounded-2xl p-8 text-center`}
        >
          <div className="text-5xl mb-4">{msg.icon}</div>
          <h1 className={`text-xl font-bold ${c.title} mb-3`}>{msg.title}</h1>
          <p className={`text-sm ${c.body} mb-6 leading-relaxed`}>{msg.body}</p>

          <div className={`text-xs ${c.body} space-y-1`}>
            <p>To restore access please contact:</p>
            <a
              href="mailto:support@yourdomain.com"
              className="font-semibold underline"
            >
              support@yourdomain.com
            </a>
          </div>

          {client && (
            <div className="mt-6 pt-4 border-t border-current/20 text-xs text-gray-400 dark:text-gray-500">
              <p>Account: {client.client_name}</p>
              <p>Plan: {client.plan}</p>
              {client.expires_at && (
                <p>
                  Expired:{" "}
                  {new Date(client.expires_at).toLocaleDateString("en-GB")}
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 underline"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export function LicenceProvider({ children }) {
  const [status, setStatus] = useState("checking"); // 'checking' | 'valid' | 'blocked'
  const [reason, setReason] = useState("");
  const [client, setClient] = useState(null);

  useEffect(() => {
    validateLicence(CONFIG.licenceKey).then((result) => {
      if (result.valid) {
        localStorage.setItem("cc_last_valid_check", String(Date.now()));
        setStatus("valid");
      } else {
        setReason(result.reason);
        setClient(result.client || null);
        setStatus("blocked");
      }
    });
  }, []);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center space-y-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm mx-auto"
            style={{ background: CONFIG.primaryColour }}
          >
            {CONFIG.companyInitials}
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Verifying licence…
          </p>
        </div>
      </div>
    );
  }

  if (status === "blocked") {
    return <BlockedScreen reason={reason} client={client} />;
  }

  return (
    <LicenceContext.Provider value={{ client }}>
      {children}
    </LicenceContext.Provider>
  );
}

export const useLicence = () => useContext(LicenceContext);
