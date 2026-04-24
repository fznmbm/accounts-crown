import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { fmtD, MONTHS_SHORT } from "../lib/utils";

const ACTION_STYLES = {
  create: "chip-green",
  update: "chip-blue",
  delete: "chip-red",
};

const ENTITY_ICONS = {
  invoice: "🧾",
  payment: "💷",
  route: "🛣️",
  staff: "👤",
  allocation: "📋",
  remittance: "💳",
};

function formatChanges(changes) {
  if (!changes) return null;
  if (typeof changes === "string") return changes;
  const entries = Object.entries(changes);
  if (entries.length === 0) return null;
  return entries.map(([key, val]) => {
    if (
      typeof val === "object" &&
      val !== null &&
      "from" in val &&
      "to" in val
    ) {
      return (
        <div key={key} className="flex items-start gap-2 text-xs">
          <span className="text-gray-400 dark:text-gray-500 w-28 flex-shrink-0 capitalize">
            {key.replace(/([A-Z])/g, " $1").trim()}
          </span>
          <span className="text-red-500 dark:text-red-400 line-through">
            {String(val.from)}
          </span>
          <span className="text-gray-400 dark:text-gray-500">→</span>
          <span className="text-green-600 dark:text-green-400">
            {String(val.to)}
          </span>
        </div>
      );
    }
    return (
      <div key={key} className="flex items-start gap-2 text-xs">
        <span className="text-gray-400 dark:text-gray-500 w-28 flex-shrink-0 capitalize">
          {key.replace(/([A-Z])/g, " $1").trim()}
        </span>
        <span className="text-gray-700 dark:text-gray-300">{String(val)}</span>
      </div>
    );
  });
}

export default function AuditLog() {
  const { auditLog } = useApp();

  const grouped = auditLog.reduce((acc, entry) => {
    const date = new Date(entry.createdAt).toLocaleDateString("en-GB");
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Audit log"
        subtitle={`${auditLog.length} events recorded`}
      />

      <div className="page-body">
        {auditLog.length === 0 ? (
          <EmptyState
            icon="📜"
            title="No audit events yet"
            description="Changes to invoices, payments, routes and staff will appear here."
          />
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, entries]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                  {date}
                </p>
                <div className="card overflow-hidden">
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-4 px-5 py-3"
                      >
                        {/* Icon */}
                        <div className="text-xl flex-shrink-0 mt-0.5">
                          {ENTITY_ICONS[entry.entity] || "📝"}
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span
                              className={
                                ACTION_STYLES[entry.action] || "chip-gray"
                              }
                            >
                              {entry.action}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {entry.entityLabel}
                            </span>
                          </div>
                          {entry.changes && (
                            <div className="mt-1.5 space-y-0.5">
                              {formatChanges(entry.changes)}
                            </div>
                          )}
                        </div>

                        {/* Time */}
                        <div className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleTimeString(
                            "en-GB",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
