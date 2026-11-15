import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { PurchaseRequestPrintButton } from '@/components/purchase-request-print-button'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { procurementRecords } from '@/lib/db/schema'

type QuoteAttachment = { pathname: string; fileName: string }
type RequestLine = { lineNumber?: number; itemName?: string; name?: string; quantity?: number; note?: string; attachments?: QuoteAttachment[]; acceptedQuote?: string | null }
type Approval = { status?: string; approverName?: string; date?: string | null; signature?: string; notes?: string }

function asText(value: unknown, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function formatDate(value: unknown) {
  if (typeof value !== 'string' || !value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(date)
}

export default async function PurchaseRequestPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const { id } = await params
  const [record] = await db.select().from(procurementRecords).where(and(
    eq(procurementRecords.id, id),
    eq(procurementRecords.userId, session.user.id),
    eq(procurementRecords.recordType, 'request'),
  )).limit(1)
  if (!record || !['Approved', 'Awaiting purchase order'].includes(record.status)) notFound()

  const payload = record.payload
  const lines = Array.isArray(payload.lineItems) ? payload.lineItems as RequestLine[] : []
  const directManager = payload.directManagerApproval as Approval | undefined
  const assistant = payload.assistantAdministrativeApproval as Approval | undefined
  const finance = payload.financialReview as Approval | undefined
  const requestDate = payload.requestDate ?? record.createdAt.toISOString()

  return (
    <main className="print-request-page">
      <div className="print-toolbar"><span>Purchase request · {record.recordNumber}</span><PurchaseRequestPrintButton /></div>
      <article className="print-request-sheet">
        <header className="print-request-header"><div><span className="print-kicker">PROCUREMENT · INTERNAL FORM</span><h1>Purchase Request</h1><p>{record.recordNumber}</p></div><span className="print-status">{record.status}</span></header>
        <section className="print-request-meta" aria-label="Purchase request fields">
          <div><span>Request number</span><strong>{record.recordNumber}</strong></div>
          <div><span>Request title</span><strong>{record.title}</strong></div>
          <div><span>Request date</span><strong>{formatDate(requestDate)}</strong></div>
          <div><span>Requester name</span><strong>{asText(payload.requester)}</strong></div>
          <div><span>Position / job title</span><strong>{asText(payload.jobTitle)}</strong></div>
          <div><span>Request type</span><strong>{asText(payload.category)}</strong></div>
          <div><span>Administrative department</span><strong>{asText(payload.department)}</strong></div>
          <div><span>Cost center</span><strong>{asText(payload.costCenter, record.entityName)}</strong></div>
          <div><span>Estimated amount</span><strong>{new Intl.NumberFormat('en-SA', { style: 'currency', currency: record.currency, minimumFractionDigits: 2 }).format(Number(record.amount))}</strong></div>
          <div><span>Needed by</span><strong>{formatDate(record.dueDate)}</strong></div>
        </section>

        <section className="print-lines-section">
          <div className="print-section-heading"><h2>Purchase request lines</h2><span>{lines.length} {lines.length === 1 ? 'line' : 'lines'}</span></div>
          <table className="print-lines-table">
            <thead><tr><th>Line #</th><th>Item / service name</th><th>Quantity</th><th>Line notes</th><th>Attached quotations</th><th>Accepted quotation</th></tr></thead>
            <tbody>{lines.map((line, index) => <tr key={`${record.id}-line-${index}`}>
              <td>{line.lineNumber ?? index + 1}</td>
              <td>{asText(line.itemName ?? line.name)}</td>
              <td>{line.quantity ?? '—'}</td>
              <td>{asText(line.note)}</td>
              <td>{line.attachments?.length ? <ul className="print-quote-list">{line.attachments.map((attachment) => <li key={attachment.pathname}><a href={`/api/purchase-request-quotes?pathname=${encodeURIComponent(attachment.pathname)}`} target="_blank" rel="noreferrer">{attachment.fileName}</a></li>)}</ul> : '—'}</td>
              <td>{asText(line.acceptedQuote, 'Pending purchasing review')}</td>
            </tr>)}</tbody>
          </table>
        </section>

        <section className="print-text-field"><h2>Purchase justification</h2><p>{asText(payload.justification)}</p></section>
        <section className="print-text-field"><h2>Financial review notes</h2><p>{asText(finance?.notes ?? payload.financialReviewNotes)}</p></section>

        <section className="print-approvals">
          <h2>Approvals</h2>
          <table><thead><tr><th>Approval stage</th><th>Name</th><th>Date</th><th>Signature / status</th></tr></thead><tbody>
            <tr><th>Direct department manager</th><td>{asText(directManager?.approverName)}</td><td>{formatDate(directManager?.date)}</td><td>{asText(directManager?.signature, directManager?.status ?? 'Pending')}</td></tr>
            <tr><th>Assistant, Administrative Affairs</th><td>{asText(assistant?.approverName)}</td><td>{formatDate(assistant?.date)}</td><td>{asText(assistant?.signature, assistant?.status ?? 'Pending')}</td></tr>
          </tbody></table>
        </section>
        <footer className="print-request-footer"><span>Requester: {asText(payload.requester)}</span><span>Printed from the procurement workspace</span></footer>
      </article>
    </main>
  )
}
