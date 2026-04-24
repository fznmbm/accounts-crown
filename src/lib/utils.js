export const uid = () => `${Date.now()}_${Math.random().toString(36).substr(2, 7)}`

export const fmt = (n) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0)

export const fmtD = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—')

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export const YEARS = [2024, 2025, 2026, 2027, 2028]

export const currentMonth = () => new Date().getMonth()
export const currentYear  = () => new Date().getFullYear()

// Returns "March 2026" style label
export const periodLabel = (month, year) => `${MONTHS[month]} ${year}`
