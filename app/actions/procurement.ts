'use server'

import { auth } from '@/lib/auth'
import { del, put } from '@vercel/blob'
import { db } from '@/lib/db'
import { procurementRecords } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

const starterRecords = [
  { recordType: 'request', recordNumber: 'PR-2026-11-024', title: 'Annual software licensing renewal', entityName: 'Digital Insurance', status: 'Awaiting finance', amount: '48500', dueDate: '2026-11-25', payload: { category: 'Services', requester: 'Sarah Al-Harbi', costCenter: 'Digital Insurance' } },
  { recordType: 'request', recordNumber: 'PR-2026-11-023', title: 'Regional office network equipment', entityName: 'Riyadh Branch', status: 'In sourcing', amount: '127800', dueDate: '2026-11-30', payload: { category: 'Products', requester: 'Omar Nasser', costCenter: 'Riyadh' } },
  { recordType: 'request', recordNumber: 'PR-2026-11-022', title: 'Q4 compliance advisory services', entityName: 'Jeddah Branch', status: 'Approved', amount: '36000', dueDate: '2026-12-03', payload: { category: 'Consulting', requester: 'Lina Mansour', costCenter: 'Jeddah' } },
  { recordType: 'order', recordNumber: 'PO-2026-11-018', title: 'Cybersecurity monitoring platform', entityName: 'Nexa Systems Ltd.', status: 'Receiving pending', amount: '186000', dueDate: '2026-11-28', payload: { vendorId: 'VEN-00142', received: false, requester: 'Faisal Rahman' } },
  { recordType: 'order', recordNumber: 'PO-2026-11-016', title: 'Claims workflow implementation', entityName: 'Brightpath Consulting', status: 'Installment due soon', amount: '92000', dueDate: '2026-12-10', payload: { vendorId: 'VEN-00139', received: true, requester: 'Sarah Al-Harbi' } },
  { recordType: 'vendor', recordNumber: 'VEN-00142', title: 'Nexa Systems Ltd.', entityName: 'Nexa Systems Ltd.', status: 'Qualified', amount: '0', payload: { category: 'Technology', location: 'Riyadh', expiry: '2027-08-14' } },
  { recordType: 'vendor', recordNumber: 'VEN-00139', title: 'Brightpath Consulting', entityName: 'Brightpath Consulting', status: 'Qualified', amount: '0', payload: { category: 'Consulting', location: 'Jeddah', expiry: '2027-04-30' } },
  { recordType: 'receipt', recordNumber: 'GR-2026-11-009', title: 'Claims workflow — phase 1', entityName: 'Brightpath Consulting', status: 'Pending requester approval', amount: '46000', dueDate: '2026-11-18', payload: { order: 'PO-2026-11-016', installment: 1 } },
]

type PurchaseQuoteAttachment = { pathname: string; fileName: string; contentType: string; size: number }
type PurchaseRequestLine = { lineNumber: number; itemName: string; quantity: number; note: string; attachments: PurchaseQuoteAttachment[]; acceptedQuote: null }
const allowedQuoteTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])

function parsePurchaseRequestLines(raw: string, userId: string, draftId: string): PurchaseRequestLine[] {
  if (!/^[a-f0-9-]{36}$/i.test(draftId)) throw new Error('Please refresh the request form and try again.')
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('Please provide valid purchase request lines.') }
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new Error('A request must include between 1 and 30 lines.')
  const attachmentPrefix = `purchase-request-quotes/${userId}/${draftId}/`

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error('Please provide valid purchase request lines.')
    const line = entry as Record<string, unknown>
    const itemName = typeof line.itemName === 'string' ? line.itemName.trim().slice(0, 160) : ''
    const quantity = Number(line.quantity)
    const note = typeof line.note === 'string' ? line.note.trim().slice(0, 1000) : ''
    const attachments = Array.isArray(line.attachments) ? line.attachments : []
    if (itemName.length < 2 || !Number.isFinite(quantity) || quantity <= 0 || attachments.length > 5) throw new Error(`Please check line ${index + 1}.`)
    const normalizedAttachments = attachments.map((attachment) => {
      if (!attachment || typeof attachment !== 'object') throw new Error(`Please check quote files on line ${index + 1}.`)
      const file = attachment as Record<string, unknown>
      const pathname = typeof file.pathname === 'string' ? file.pathname : ''
      const fileName = typeof file.fileName === 'string' ? file.fileName.trim().slice(0, 120) : ''
      const contentType = typeof file.contentType === 'string' ? file.contentType : ''
      const size = Number(file.size)
      if (!pathname.startsWith(attachmentPrefix) || pathname.includes('..') || !fileName || !allowedQuoteTypes.has(contentType) || !Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) throw new Error(`Please check quote files on line ${index + 1}.`)
      return { pathname, fileName, contentType, size }
    })
    return { lineNumber: index + 1, itemName, quantity, note, attachments: normalizedAttachments, acceptedQuote: null }
  })
}

export async function getProcurementData() {
  const userId = await getUserId()
  const existing = await db.select({ id: procurementRecords.id }).from(procurementRecords).where(eq(procurementRecords.userId, userId)).limit(1)
  if (existing.length === 0) {
    await db.insert(procurementRecords).values(starterRecords.map((record) => ({ ...record, id: `${userId}:${record.recordNumber}`, userId }))).onConflictDoNothing()
  }
  const rows = await db.select().from(procurementRecords).where(eq(procurementRecords.userId, userId)).orderBy(desc(procurementRecords.createdAt))
  const uniqueRecords = new Map<string, (typeof rows)[number]>()
  for (const row of rows) uniqueRecords.set(`${row.recordType}:${row.recordNumber}`, row)
  return [...uniqueRecords.values()]
}

export async function createPurchaseRequest(formData: FormData) {
  const userId = await getUserId()
  const title = String(formData.get('title') ?? '').trim().slice(0, 160)
  const category = String(formData.get('category') ?? '')
  const costCenter = String(formData.get('costCenter') ?? '')
  const jobTitle = String(formData.get('jobTitle') ?? '').trim().slice(0, 120)
  const department = String(formData.get('department') ?? '').trim().slice(0, 120)
  const justification = String(formData.get('justification') ?? '').trim().slice(0, 1500)
  const financialReviewNotes = String(formData.get('financialReviewNotes') ?? '').trim().slice(0, 1500)
  const draftId = String(formData.get('draftId') ?? '')
  if (formData.get('quoteUploadsPending') === 'true') throw new Error('Wait for quote uploads to finish before submitting.')
  const lineItems = parsePurchaseRequestLines(String(formData.get('lineItems') ?? ''), userId, draftId)
  const amount = Number(formData.get('amount'))
  if (title.length < 3 || jobTitle.length < 2 || department.length < 2 || justification.length < 8 || !Number.isFinite(amount) || amount <= 0 || !['Services', 'Products', 'Consulting'].includes(category) || !['Jeddah', 'Riyadh', 'Khobar', 'Digital Insurance'].includes(costCenter)) {
    throw new Error('Please provide valid request details.')
  }
  const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '')
  const count = await db.select({ id: procurementRecords.id }).from(procurementRecords).where(and(eq(procurementRecords.userId, userId), eq(procurementRecords.recordType, 'request')))
  const number = `PR-${yearMonth}-${String(count.length + 1).padStart(3, '0')}`
  const neededBy = String(formData.get('neededBy') ?? '')
  const neededByDate = neededBy && /^\d{4}-\d{2}-\d{2}$/.test(neededBy) && !Number.isNaN(Date.parse(neededBy)) ? neededBy : null
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const requestedAt = new Date().toISOString()
  await db.insert(procurementRecords).values({
    id: crypto.randomUUID(),
    userId,
    recordType: 'request',
    recordNumber: number,
    title,
    entityName: costCenter,
    status: 'Awaiting manager approval',
    amount: String(amount),
    currency: 'SAR',
    dueDate: neededByDate,
    payload: {
      category,
      justification,
      requester: session.user.name,
      jobTitle,
      department,
      costCenter,
      requestDate: requestedAt,
      requestedAt,
      financialReviewNotes,
      directManagerApproval: { status: 'Pending', approverName: '', date: null, signature: '' },
      assistantAdministrativeApproval: { status: 'Pending', approverName: '', date: null, signature: '' },
      lineItems,
    },
  })
  revalidatePath('/')
}

const vendorDocumentFields = ['commercialRegistration', 'vatCertificate', 'bankCertificate', 'nationalAddressProof', 'codeOfConduct', 'ndaAgreement'] as const
const vendorDocumentLabels: Record<(typeof vendorDocumentFields)[number], string> = {
  commercialRegistration: 'Commercial Registration certificate',
  vatCertificate: 'VAT certificate',
  bankCertificate: 'bank certificate',
  nationalAddressProof: 'National Address proof',
  codeOfConduct: 'signed Supplier Code of Conduct',
  ndaAgreement: 'signed NDA',
}
const vendorFileTypes = new Set(['application/pdf', 'image/jpeg', 'image/png'])

async function matchesVendorFileType(file: File) {
  if (!vendorFileTypes.has(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) return false
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (file.type === 'application/pdf') return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
  if (file.type === 'image/png') return bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10'
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

function validIban(value: string) {
  const iban = value.replace(/\\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}\\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

function vendorValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim()
}

export async function createWorkspaceRecord(recordType: 'vendor' | 'order' | 'receipt', formData: FormData) {
  const userId = await getUserId()
  const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '')
  const title = String(formData.get('title') ?? '').trim().slice(0, 160)
  const amount = Number(formData.get('amount'))
  const currency = String(formData.get('currency') ?? 'SAR')
  const sequence = await db.select({ id: procurementRecords.id }).from(procurementRecords).where(and(eq(procurementRecords.userId, userId), eq(procurementRecords.recordType, recordType)))

  if (recordType === 'vendor') {
    const email = vendorValue(formData, 'email').slice(0, 254)
    const representativeEmail = vendorValue(formData, 'representativeEmail').slice(0, 254)
    const contact = vendorValue(formData, 'contact').slice(0, 120)
    const category = vendorValue(formData, 'category')
    const businessType = vendorValue(formData, 'businessType')
    const classification = vendorValue(formData, 'classification')
    const country = vendorValue(formData, 'country')
    const crNumber = vendorValue(formData, 'crNumber').toUpperCase()
    const vatNumber = vendorValue(formData, 'vatNumber').toUpperCase()
    const bankName = vendorValue(formData, 'bankName').slice(0, 120)
    const beneficiaryName = vendorValue(formData, 'beneficiaryName').slice(0, 160)
    const accountNumber = vendorValue(formData, 'accountNumber').slice(0, 50)
    const iban = vendorValue(formData, 'iban').replace(/\\s/g, '').toUpperCase()
    const swift = vendorValue(formData, 'swift').toUpperCase()
    const ifsc = vendorValue(formData, 'ifsc').toUpperCase()
    const crExpiry = vendorValue(formData, 'crExpiry')
    const countryValues = ['Saudi Arabia', 'India', 'United Arab Emirates', 'United States', 'United Kingdom', 'Other']
    const categoryValues = ['Service Provider', 'Goods Supplier', 'Consultations']
    const fileValidity = await Promise.all(vendorDocumentFields.map(async (name) => {
      const file = formData.get(name)
      return file instanceof File && await matchesVendorFileType(file) ? null : name
    }))
    const missingFile = fileValidity.find((name) => name !== null)
    if (title.length < 2 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(representativeEmail) || contact.length < 2 || !categoryValues.includes(category) || !['Company', 'Individual Establishment'].includes(businessType) || !['Local Vendor', 'International Vendor'].includes(classification) || !countryValues.includes(country) || !crNumber || !vatNumber || !validIban(iban) || !bankName || !beneficiaryName || !accountNumber || !/^\\d{4}-\\d{2}-\\d{2}$/.test(crExpiry) || new Date(`${crExpiry}T00:00:00`) <= new Date(new Date().toDateString()) || (classification === 'International Vendor' && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swift)) || (classification === 'International Vendor' && country === 'India' && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) || formData.get('vendorDeclarationAccepted') !== 'yes' || (classification === 'International Vendor' && formData.get('withholdingAccepted') !== 'yes') || formData.get('cybersecurityAccepted') !== 'yes' || !vendorValue(formData, 'vendorApprovalName') || !vendorValue(formData, 'vendorApprovalDate') || missingFile) {
      throw new Error(missingFile ? `Attach a valid ${vendorDocumentLabels[missingFile]} (PDF, JPG or PNG, up to 10 MB).` : 'Complete all vendor qualification fields and provide a valid IBAN, approvals, declarations, and documents.')
    }

    const duplicates = await db.select({ payload: procurementRecords.payload }).from(procurementRecords).where(and(eq(procurementRecords.userId, userId), eq(procurementRecords.recordType, 'vendor')))
    if (duplicates.some(({ payload }) => String(payload.crNumber ?? '').toUpperCase() === crNumber || String(payload.vatNumber ?? '').toUpperCase() === vatNumber)) throw new Error('A vendor with this Commercial Registration or VAT number already exists.')

    const uploadId = crypto.randomUUID()
    const uploadedFiles: string[] = []
    try {
      const documents = await Promise.all(vendorDocumentFields.map(async (name) => {
        const file = formData.get(name) as File
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || name
        const blob = await put(`vendor-qualification/${userId}/${uploadId}/${name}-${safeName}`, file, { access: 'private', addRandomSuffix: false, contentType: file.type })
        uploadedFiles.push(blob.pathname)
        return { name, label: vendorDocumentLabels[name], pathname: blob.pathname, fileName: safeName, contentType: file.type, size: file.size }
      }))
      await db.insert(procurementRecords).values({
        id: crypto.randomUUID(), userId, recordType, recordNumber: `VEN-PENDING-${uploadId.slice(0, 8).toUpperCase()}`, title, entityName: title, status: 'Under qualification', amount: '0',
        payload: {
          requiredAction: vendorValue(formData, 'requiredAction'), businessType, category, country, classification, nationalAddress: vendorValue(formData, 'nationalAddress').slice(0, 500),
          phone: vendorValue(formData, 'phone').slice(0, 40), email, language: vendorValue(formData, 'language'), crNumber, vatNumber,
          contact, representativePhone: vendorValue(formData, 'representativePhone').slice(0, 40), extension: vendorValue(formData, 'extension').slice(0, 10), mobile: vendorValue(formData, 'mobile').slice(0, 40), representativeEmail,
          bankName, bankCurrency: vendorValue(formData, 'bankCurrency'), beneficiaryName, accountNumber, iban, swift: classification === 'International Vendor' ? swift : '', ifsc: classification === 'International Vendor' && country === 'India' ? ifsc : '',
          crExpiry, documents, vendorApproval: { representativeName: vendorValue(formData, 'vendorApprovalName').slice(0, 120), date: vendorValue(formData, 'vendorApprovalDate'), declarationAccepted: true },
          declarations: { withholdingApplicable: classification === 'International Vendor', withholdingAccepted: formData.get('withholdingAccepted') === 'yes', cybersecurityAccepted: true },
          bankHistory: [{ changedAt: new Date().toISOString(), changedBy: userId, reason: 'Initial registration', iban, bankName, beneficiaryName, accountNumber }],
          financeNotificationRequired: false,
        },
      })
    } catch (error) {
      if (uploadedFiles.length) await del(uploadedFiles).catch(() => undefined)
      throw error
    }
  } else if (recordType === 'order') {
    const vendorId = String(formData.get('vendorId') ?? '')
    const requestId = String(formData.get('requestId') ?? '')
    const vendor = await db.select().from(procurementRecords).where(and(eq(procurementRecords.id, vendorId), eq(procurementRecords.userId, userId), eq(procurementRecords.recordType, 'vendor'), eq(procurementRecords.status, 'Qualified'))).limit(1)
    const request = await db.select().from(procurementRecords).where(and(eq(procurementRecords.id, requestId), eq(procurementRecords.userId, userId), eq(procurementRecords.recordType, 'request'))).limit(1)
    const installments = [1, 2, 3].map((index) => ({ amount: Number(formData.get(`installmentAmount${index}`) ?? 0), dueDate: String(formData.get(`installmentDate${index}`) ?? '') })).filter((item) => item.amount > 0)
    const totalInstallments = installments.reduce((total, item) => total + item.amount, 0)
    if (title.length < 3 || !Number.isFinite(amount) || amount <= 0 || !['SAR', 'USD', 'EUR'].includes(currency) || !vendor[0] || !request[0] || !['Approved', 'Awaiting purchase order'].includes(request[0].status) || installments.length === 0 || Math.abs(totalInstallments - amount) > 0.01 || installments.some((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate))) throw new Error('Choose an approved request and qualified vendor. Installments must match the order total.')
    await db.insert(procurementRecords).values({ id: crypto.randomUUID(), userId, recordType, recordNumber: `PO-${yearMonth}-${String(sequence.length + 1).padStart(3, '0')}`, title, entityName: vendor[0].title, status: 'Awaiting approval', amount: String(amount), currency, dueDate: installments[0].dueDate, payload: { requestNumber: request[0].recordNumber, vendorId, installments: installments.map((item, index) => ({ number: index + 1, ...item, requiresReceipt: true, receivingStatus: 'Not received', paymentStatus: 'Not due' })) } })
  } else {
    const orderId = String(formData.get('orderId') ?? '')
    const order = await db.select().from(procurementRecords).where(and(eq(procurementRecords.id, orderId), eq(procurementRecords.userId, userId), eq(procurementRecords.recordType, 'order'))).limit(1)
    const nature = String(formData.get('nature') ?? '')
    const scope = String(formData.get('scope') ?? '')
    const notes = String(formData.get('notes') ?? '').trim().slice(0, 1000)
    if (!order[0] || !['Products', 'Services', 'Products and services'].includes(nature) || !['Full', 'Partial'].includes(scope) || notes.length < 5) throw new Error('Complete the receiving details before submitting.')
    await db.insert(procurementRecords).values({ id: crypto.randomUUID(), userId, recordType, recordNumber: `GR-${yearMonth}-${String(sequence.length + 1).padStart(3, '0')}`, title: title || 'Goods & services receipt', entityName: order[0].entityName, status: 'Pending requester approval', amount: order[0].amount, currency: order[0].currency, dueDate: new Date().toISOString().slice(0, 10), payload: { order: order[0].recordNumber, orderId, nature, scope, notes, receivedAt: new Date().toISOString(), outcome: 'Pending review', approvals: ['Requester', 'Procurement'] } })
  }
  revalidatePath('/')
}

export async function advanceRecord(id: string) {
  const userId = await getUserId()
  const [record] = await db.select().from(procurementRecords).where(and(eq(procurementRecords.id, id), eq(procurementRecords.userId, userId))).limit(1)
  if (!record) throw new Error('Record not found.')
  const transitions: Record<string, Record<string, string>> = {
    request: { 'Awaiting manager approval': 'Awaiting finance', 'Awaiting finance': 'In sourcing', 'In sourcing': 'Approved', 'Approved': 'Awaiting purchase order' },
    vendor: { 'Under qualification': 'Qualified' },
    order: { 'Awaiting approval': 'Approved', Approved: 'Issued' },
    receipt: { 'Pending requester approval': 'Pending procurement approval', 'Pending procurement approval': 'Received and approved' },
  }
  const nextStatus = transitions[record.recordType]?.[record.status]
  if (!nextStatus) throw new Error('This item is not ready to advance.')
  let payload = record.payload
  let recordNumber = record.recordNumber
  if (record.recordType === 'request') {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) throw new Error('Unauthorized')
    const approvedAt = new Date().toISOString()
    payload = { ...record.payload }
    if (record.status === 'Awaiting manager approval') {
      payload.directManagerApproval = { status: 'Approved', approverName: session.user.name, date: approvedAt, signature: 'Electronic approval recorded' }
    } else if (record.status === 'Awaiting finance') {
      payload.financialReview = { status: 'Reviewed', reviewerName: session.user.name, date: approvedAt, notes: typeof record.payload.financialReviewNotes === 'string' ? record.payload.financialReviewNotes : '' }
    } else if (record.status === 'In sourcing') {
      payload.assistantAdministrativeApproval = { status: 'Approved', approverName: session.user.name, date: approvedAt, signature: 'Electronic approval recorded' }
    }
  } else if (record.recordType === 'vendor') {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) throw new Error('Unauthorized')
    const docs = Array.isArray(record.payload.documents) ? record.payload.documents : []
    const expectedNames = new Set(vendorDocumentFields)
    const attachedNames = new Set(docs.map((entry) => entry && typeof entry === 'object' ? String((entry as Record<string, unknown>).name) : ''))
    const expiry = typeof record.payload.crExpiry === 'string' ? new Date(`${record.payload.crExpiry}T00:00:00`) : new Date(0)
    const declarations = record.payload.declarations as { withholdingApplicable?: boolean; withholdingAccepted?: boolean; cybersecurityAccepted?: boolean } | undefined
    const vendorApproval = record.payload.vendorApproval as { representativeName?: string; date?: string; declarationAccepted?: boolean } | undefined
    if (docs.length !== expectedNames.size || [...expectedNames].some((name) => !attachedNames.has(name)) || !Number.isFinite(expiry.getTime()) || expiry <= new Date(new Date().toDateString()) || !validIban(String(record.payload.iban ?? '')) || (declarations?.withholdingApplicable === true && !declarations.withholdingAccepted) || !declarations?.cybersecurityAccepted || !vendorApproval?.declarationAccepted || !vendorApproval.representativeName || !vendorApproval.date) {
      throw new Error('Qualification cannot be approved until required documents, declarations, IBAN, and vendor approval details are valid.')
    }
    const approvedAt = new Date().toISOString()
    payload = { ...record.payload, procurementApproval: { status: 'Approved', approverName: session.user.name, date: approvedAt, signature: 'Electronic approval recorded' } }
    const yearMonth = approvedAt.slice(0, 7).replace('-', '')
    recordNumber = `VEN-${yearMonth}-${record.id.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase()}`
  }
  await db.update(procurementRecords).set({ status: nextStatus, recordNumber, payload, updatedAt: new Date() }).where(and(eq(procurementRecords.id, id), eq(procurementRecords.userId, userId)))
  revalidatePath('/')
}
