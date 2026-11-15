'use client'

import { useState } from 'react'
import { FileText, Plus, Trash2, UploadCloud } from 'lucide-react'

type QuoteAttachment = {
  pathname: string
  fileName: string
  contentType: string
  size: number
}

type RequestLine = {
  id: string
  itemName: string
  quantity: string
  note: string
  attachments: QuoteAttachment[]
}

const acceptedFileTypes = '.pdf,.png,.jpg,.jpeg,.xls,.xlsx'
const maxFilesPerLine = 5
const maxFileSize = 10 * 1024 * 1024

function createLine(id: string): RequestLine {
  return { id, itemName: '', quantity: '1', note: '', attachments: [] }
}

export function PurchaseRequestLines({ draftId }: { draftId: string }) {
  const [lines, setLines] = useState<RequestLine[]>([createLine('line-1')])
  const [uploadMessages, setUploadMessages] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

  function updateLine(id: string, changes: Partial<RequestLine>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line))
  }

  function addLine() {
    setLines((current) => current.length >= 30 ? current : [...current, createLine(`line-${crypto.randomUUID()}`)])
  }

  async function uploadQuotes(line: RequestLine, files: File[], input: HTMLInputElement) {
    setUploadMessages((current) => ({ ...current, [line.id]: '' }))
    if (line.attachments.length + files.length > maxFilesPerLine) {
      setUploadMessages((current) => ({ ...current, [line.id]: `You can attach up to ${maxFilesPerLine} quotes per line.` }))
      input.value = ''
      return
    }
    if (files.some((file) => file.size > maxFileSize)) {
      setUploadMessages((current) => ({ ...current, [line.id]: 'Each quote must be 10 MB or smaller.' }))
      input.value = ''
      return
    }

    const formData = new FormData()
    formData.set('draftId', draftId)
    formData.set('lineId', line.id)
    files.forEach((file) => formData.append('files', file))
    setUploading((current) => ({ ...current, [line.id]: true }))

    try {
      const response = await fetch('/api/purchase-request-quotes', { method: 'POST', body: formData })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Quote upload failed.')
      updateLine(line.id, { attachments: [...line.attachments, ...result.attachments] })
    } catch (error) {
      setUploadMessages((current) => ({ ...current, [line.id]: error instanceof Error ? error.message : 'Quote upload failed.' }))
    } finally {
      setUploading((current) => ({ ...current, [line.id]: false }))
      input.value = ''
    }
  }

  async function removeQuote(line: RequestLine, attachment: QuoteAttachment) {
    try {
      const response = await fetch('/api/purchase-request-quotes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname: attachment.pathname }),
      })
      if (!response.ok) throw new Error('Could not remove this quote.')
      updateLine(line.id, { attachments: line.attachments.filter((item) => item.pathname !== attachment.pathname) })
    } catch (error) {
      setUploadMessages((current) => ({ ...current, [line.id]: error instanceof Error ? error.message : 'Could not remove this quote.' }))
    }
  }

  async function removeLine(line: RequestLine) {
    if (uploading[line.id]) return
    const results = await Promise.all(line.attachments.map((attachment) => fetch('/api/purchase-request-quotes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pathname: attachment.pathname }),
    })))
    if (results.some((response) => !response.ok)) {
      setUploadMessages((current) => ({ ...current, [line.id]: 'Could not remove this line and its quote files.' }))
      return
    }
    setLines((current) => current.length > 1 ? current.filter((item) => item.id !== line.id) : current)
  }

  const serializedLines = lines.map((line, index) => ({
    lineNumber: index + 1,
    itemName: line.itemName,
    quantity: Number(line.quantity),
    note: line.note,
    attachments: line.attachments,
    acceptedQuote: null,
  }))

  return (
    <section className="request-lines-tree" aria-labelledby="request-lines-title">
      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="lineItems" value={JSON.stringify(serializedLines)} />
      <input type="hidden" name="quoteUploadsPending" value={Object.values(uploading).some(Boolean) ? 'true' : 'false'} />
      <div className="lines-heading">
        <div>
          <h3 id="request-lines-title">Purchase request lines</h3>
          <p>Each line is saved under this request.</p>
        </div>
        <button type="button" className="button-secondary add-line-button" onClick={addLine} disabled={lines.length >= 30}><Plus size={14} /> Add line</button>
      </div>
      <ol className="request-line-tree">
        {lines.map((line, index) => (
          <li className="request-line-node" key={line.id}>
            <fieldset className="request-line-card">
              <legend><span>Line {String(index + 1).padStart(2, '0')}</span>{lines.length > 1 && <button type="button" className="remove-line-button" onClick={() => void removeLine(line)} disabled={uploading[line.id]}>Remove line</button>}</legend>
              <div className="form-row">
                <label>Item or service name<input name={`line-${index}-item`} value={line.itemName} onChange={(event) => updateLine(line.id, { itemName: event.target.value })} placeholder="Search catalog or enter a custom item" minLength={2} maxLength={160} required /></label>
                <label>Quantity<input name={`line-${index}-quantity`} type="number" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} min="0.01" step="0.01" required /></label>
              </div>
              <label>Line notes<textarea name={`line-${index}-note`} value={line.note} onChange={(event) => updateLine(line.id, { note: event.target.value })} placeholder="Optional specifications or conditions for this line" rows={2} maxLength={1000} /></label>
              <label className="quote-upload-label">Attached quotations <span className="quote-upload-control"><UploadCloud size={15} /><span>{uploading[line.id] ? 'Uploading…' : 'Add quote files'}</span><input type="file" accept={acceptedFileTypes} multiple disabled={uploading[line.id]} aria-label={`Attach quotation files for line ${index + 1}`} onChange={(event) => { const input = event.currentTarget; const files = Array.from(input.files ?? []); if (files.length) void uploadQuotes(line, files, input) }} /></span><small>Optional · PDF, PNG, JPG or Excel · up to 5 files, 10 MB each</small></label>
              {line.attachments.length > 0 && <ul className="quote-file-list">{line.attachments.map((attachment) => <li key={attachment.pathname}><a href={`/api/purchase-request-quotes?pathname=${encodeURIComponent(attachment.pathname)}`} target="_blank" rel="noreferrer"><FileText size={13} />{attachment.fileName}</a><button type="button" aria-label={`Remove ${attachment.fileName}`} onClick={() => void removeQuote(line, attachment)}><Trash2 size={13} /></button></li>)}</ul>}
              {uploadMessages[line.id] && <p className="field-error" role="alert">{uploadMessages[line.id]}</p>}
              <div className="accepted-quote-field"><span>Accepted quotation</span><strong>Pending purchasing review</strong><small>Selection is reserved for the purchasing team.</small></div>
            </fieldset>
            {index < lines.length - 1 && <span className="tree-connector" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </section>
  )
}
