const colors = {
  green: 'text-green-700 dark:text-green-400',
  red:   'text-red-600   dark:text-red-400',
  amber: 'text-amber-600 dark:text-amber-400',
  blue:  'text-blue-600  dark:text-blue-400',
  gray:  'text-gray-500  dark:text-gray-400',
}

export default function MetricCard({ label, value, sub, color }) {
  return (
    <div className="metric">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${colors[color] || 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}
