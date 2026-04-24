import { useState } from 'react'
import { useApp } from '../context/AppContext'
import PageHeader from '../components/PageHeader'
import Modal, { ModalFooter } from '../components/Modal'
import EmptyState from '../components/EmptyState'
import DropZone from '../components/DropZone'
import { parseRemittancePDF } from '../lib/pdfParser'
import { uid, fmt, fmtD } from '../lib/utils'

export default function Remittances() {
  const { remittances, setRemittances, invoices, setInvoices } = useApp()
  const [parsing,  setParsing]  = useState(false)
  const [parseErr, setParseErr] = useState('')
  const [preview,  setPreview]  = useState(null)
  const [detail,   setDetail]   = useState(null)

  const handleFile = async (files) => {
    setParsing(true); setParseErr(''); setPreview(null)
    try {
      const r = await parseRemittancePDF(files[0])
      if (r.items.length === 0) setParseErr('No invoice data found. Check this is a WSCC remittance advice PDF.')
      else setPreview(r)
    } catch (e) { setParseErr('Parse failed: ' + e.message) }
    setParsing(false)
  }

  const confirmSave = () => {
    if (!preview) return
    const rem = { id: uid(), paymentNumber: preview.paymentNumber, total: preview.total, paymentDate: preview.paymentDate, items: preview.items, fileName: preview.fileName, createdAt: Date.now() }
    const updatedInvoices = invoices.map((inv) => {
      const match = preview.items.find((it) => it.invoiceNumber === inv.invoiceNumber)
      if (!match) return inv
      return { ...inv, paidAmount: match.amount, status: Math.abs(match.amount - inv.total) < 0.02 ? 'paid' : 'partial', remittanceId: rem.id }
    })
    setRemittances([...remittances, rem])
    setInvoices(updatedInvoices)
    setPreview(null)
  }

  const del = (id) => {
    if (confirm('Delete this remittance? Invoice statuses will not be reverted.'))
      setRemittances(remittances.filter((r) => r.id !== id))
  }

  const sorted = [...remittances].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Remittances" subtitle="Upload WSCC payment advice PDFs to auto-reconcile invoices" />

      <div className="page-body">
        {!preview && (
          <>
            <DropZone multiple={false} onFiles={handleFile}
              label={parsing ? 'Parsing remittance PDF…' : 'Drop WSCC remittance advice PDF here'}
              sublabel="One remittance at a time"
            />
            {parseErr && <div className="alert-danger text-sm text-red-700 dark:text-red-400">{parseErr}</div>}
          </>
        )}

        {preview && (
          <div className="card overflow-hidden border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between px-5 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">PDF parsed — Payment #{preview.paymentNumber}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{preview.items.length} invoices · {fmt(preview.total)} · due {fmtD(preview.paymentDate)}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary text-xs" onClick={() => setPreview(null)}>Cancel</button>
                <button className="btn-primary text-xs" onClick={confirmSave}>✓ Save &amp; reconcile invoices</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="thead-row">
                  <th className="th">Invoice #</th><th className="th-r">Amount</th><th className="th">Match</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {preview.items.map((it, i) => {
                    const inv = invoices.find((x) => x.invoiceNumber === it.invoiceNumber)
                    return (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="td font-mono font-semibold">#{it.invoiceNumber}</td>
                        <td className="td-r font-medium">{fmt(it.amount)}</td>
                        <td className="td">
                          {inv
                            ? <span className="chip-green">✓ {inv.routeName || `Route ${inv.routeNumber}`}</span>
                            : <span className="chip-amber">⚠ no invoice on file</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="tfoot-row">
                    <td className="td font-semibold">Total</td>
                    <td className="td-r font-semibold text-green-700 dark:text-green-400">{fmt(preview.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {sorted.length === 0 ? (
          <EmptyState icon="💳" title="No remittances yet" description="Upload your first WSCC remittance advice PDF above." />
        ) : (
          <div className="card overflow-hidden">
            <div className="card-section">
              <h3 className="section-title">All remittances ({remittances.length})</h3>
            </div>
            <table className="min-w-full">
              <thead><tr className="thead-row">
                <th className="th">Payment #</th><th className="th">File</th>
                <th className="th">Invoices</th><th className="th">Payment date</th>
                <th className="th-r">Total</th><th className="th"></th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sorted.map((r) => (
                  <tr key={r.id} className="tr cursor-pointer" onClick={() => setDetail(r)}>
                    <td className="td font-mono font-semibold text-gray-900 dark:text-gray-100">#{r.paymentNumber}</td>
                    <td className="td text-xs text-gray-500 dark:text-gray-400">{r.fileName}</td>
                    <td className="td text-gray-600 dark:text-gray-400">{r.items?.length} invoices</td>
                    <td className="td text-gray-600 dark:text-gray-400">{fmtD(r.paymentDate)}</td>
                    <td className="td-r font-semibold text-green-700 dark:text-green-400">{fmt(r.total)}</td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-ghost text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => del(r.id)}>Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && (
        <Modal title={`Remittance — Payment #${detail.paymentNumber}`} onClose={() => setDetail(null)}>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="metric"><p className="muted mb-1">Payment date</p><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{fmtD(detail.paymentDate)}</p></div>
            <div className="metric"><p className="muted mb-1">Total paid</p><p className="text-sm font-semibold text-green-700 dark:text-green-400">{fmt(detail.total)}</p></div>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="th">Invoice #</th><th className="th-r">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {detail.items?.map((it, i) => (
                <tr key={i}>
                  <td className="td font-mono">#{it.invoiceNumber}</td>
                  <td className="td-r font-medium">{fmt(it.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="tfoot-row">
                <td className="td font-semibold">Total</td>
                <td className="td-r font-semibold text-green-700 dark:text-green-400">{fmt(detail.total)}</td>
              </tr>
            </tfoot>
          </table>
          <ModalFooter><button className="btn-secondary" onClick={() => setDetail(null)}>Close</button></ModalFooter>
        </Modal>
      )}
    </div>
  )
}
