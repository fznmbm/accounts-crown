const variants = {
  paid:       'bg-green-50  text-green-700  ring-green-200  dark:bg-green-900/30  dark:text-green-400  dark:ring-green-800',
  partial:    'bg-amber-50  text-amber-700  ring-amber-200  dark:bg-amber-900/30  dark:text-amber-400  dark:ring-amber-800',
  unpaid:     'bg-red-50    text-red-700    ring-red-200    dark:bg-red-900/30    dark:text-red-400    dark:ring-red-800',
  active:     'bg-green-50  text-green-700  ring-green-200  dark:bg-green-900/30  dark:text-green-400  dark:ring-green-800',
  inactive:   'bg-gray-100  text-gray-500   ring-gray-200   dark:bg-gray-700      dark:text-gray-400   dark:ring-gray-600',
  driver:     'bg-blue-50   text-blue-700   ring-blue-200   dark:bg-blue-900/30   dark:text-blue-400   dark:ring-blue-800',
  pa:         'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:ring-purple-800',
  driver_pa:  'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:ring-indigo-800',
  regular:    'bg-gray-100  text-gray-600   ring-gray-200   dark:bg-gray-700      dark:text-gray-300   dark:ring-gray-600',
  advance:    'bg-amber-50  text-amber-700  ring-amber-200  dark:bg-amber-900/30  dark:text-amber-400  dark:ring-amber-800',
  partial_pay:'bg-blue-50   text-blue-700   ring-blue-200   dark:bg-blue-900/30   dark:text-blue-400   dark:ring-blue-800',
  default:    'bg-gray-100  text-gray-600   ring-gray-200   dark:bg-gray-700      dark:text-gray-300   dark:ring-gray-600',
}

const labels = {
  paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid',
  active: 'Active', inactive: 'Inactive',
  driver: 'Driver', pa: 'PA', driver_pa: 'Driver / PA',
  regular: 'Regular', advance: 'Advance', partial_pay: 'Partial',
}

export default function Badge({ type, label }) {
  const cls  = variants[type] || variants.default
  const text = label ?? labels[type] ?? type
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${cls}`}>
      {text}
    </span>
  )
}
