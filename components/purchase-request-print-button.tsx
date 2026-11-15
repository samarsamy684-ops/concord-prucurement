'use client'

import { Printer } from 'lucide-react'

export function PurchaseRequestPrintButton() {
  return <button className="print-trigger" type="button" onClick={() => window.print()}><Printer size={15} /> Print / save PDF</button>
}
