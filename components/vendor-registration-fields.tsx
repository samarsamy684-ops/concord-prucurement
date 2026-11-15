'use client'

import { useState } from 'react'

const requiredDocuments = [
  ['commercialRegistration', 'Commercial Registration certificate'],
  ['vatCertificate', 'VAT Registration certificate'],
  ['bankCertificate', 'Approved bank certificate'],
  ['nationalAddressProof', 'National Address proof'],
  ['codeOfConduct', 'Signed and stamped Supplier Code of Conduct'],
  ['ndaAgreement', 'Signed Non-Disclosure Agreement'],
] as const

export function VendorRegistrationFields() {
  const [classification, setClassification] = useState('Local Vendor')
  const [country, setCountry] = useState('Saudi Arabia')

  return <>
    <p className="form-section-label">GENERAL INFORMATION</p>
    <div className="form-row"><label>Business entity type<select name="businessType" required><option>Company</option><option>Individual Establishment</option></select></label><label>Vendor activity type<select name="category" required><option>Service Provider</option><option>Goods Supplier</option><option>Consultations</option></select></label></div>
    <div className="form-row"><label>Required action<select name="requiredAction" required><option>New Registration</option><option>Data Update</option></select></label><label>Official vendor name<input name="title" placeholder="Legal name from Commercial Registration" required minLength={2} maxLength={160} /></label></div>
    <label>Approved national address<textarea name="nationalAddress" rows={2} required maxLength={500} placeholder="Registered national address" /></label>
    <div className="form-row"><label>Country<select name="country" value={country} onChange={(event) => setCountry(event.target.value)} required><option>Saudi Arabia</option><option>India</option><option>United Arab Emirates</option><option>United States</option><option>United Kingdom</option><option>Other</option></select></label><label>Vendor classification<select name="classification" value={classification} onChange={(event) => setClassification(event.target.value)} required><option>Local Vendor</option><option>International Vendor</option></select></label></div>
    <div className="form-row"><label>Commercial Registration number<input name="crNumber" required maxLength={40} /></label><label>VAT number<input name="vatNumber" required maxLength={40} /></label></div>
    <div className="form-row"><label>Establishment phone<input name="phone" type="tel" required maxLength={40} /></label><label>Company email<input name="email" type="email" required maxLength={254} placeholder="vendor@example.com" /></label></div>
    <label>Approved correspondence language<select name="language" required><option>Arabic</option><option>English</option></select></label>

    <p className="form-section-label">AUTHORIZED REPRESENTATIVE</p>
    <div className="form-row"><label>Representative name<input name="contact" required maxLength={120} /></label><label>Representative direct phone<input name="representativePhone" type="tel" required maxLength={40} /></label></div>
    <div className="form-row"><label>Telephone extension <span>(optional)</span><input name="extension" type="number" min="0" max="99999" /></label><label>Direct mobile number<input name="mobile" type="tel" required maxLength={40} /></label></div>
    <label>Representative professional email<input name="representativeEmail" type="email" required maxLength={254} /></label>

    <p className="form-section-label">BANKING INFORMATION</p>
    <div className="form-row"><label>Bank name<input name="bankName" required maxLength={120} /></label><label>Bank account currency<select name="bankCurrency" required><option>SAR</option><option>USD</option><option>EUR</option><option>GBP</option><option>INR</option></select></label></div>
    <div className="form-row"><label>Beneficiary name<input name="beneficiaryName" required maxLength={160} /></label><label>Bank account number<input name="accountNumber" required maxLength={50} /></label></div>
    <label>IBAN<input name="iban" required maxLength={34} autoCapitalize="characters" placeholder="Enter IBAN without spaces" /></label>
    {classification === 'International Vendor' && <div className="form-row"><label>SWIFT code<input name="swift" required maxLength={11} /></label>{country === 'India' && <label>IFSC code<input name="ifsc" required maxLength={11} /></label>}</div>}

    <p className="form-section-label">QUALIFICATION DOCUMENTS</p>
    <div className="form-row"><label>Commercial Registration expiry date<input name="crExpiry" type="date" required /></label><label>Commercial Registration certificate<input name="commercialRegistration" type="file" accept="application/pdf,image/png,image/jpeg" required /></label></div>
    {requiredDocuments.slice(1).map(([name, label]) => <label key={name}>{label}<input name={name} type="file" accept="application/pdf,image/png,image/jpeg" required /></label>)}

    <p className="form-section-label">VENDOR APPROVAL & DECLARATIONS</p>
    <div className="form-row"><label>Vendor representative approval name<input name="vendorApprovalName" required maxLength={120} /></label><label>Vendor approval date<input name="vendorApprovalDate" type="date" required /></label></div>
    <label className="declaration-check"><input name="vendorDeclarationAccepted" type="checkbox" value="yes" required /> I confirm that I am authorized to submit this registration and approve the information provided.</label>
    {classification === 'International Vendor' && <><div className="declaration-card"><strong>Withholding tax declaration</strong><p>Foreign vendors acknowledge that service payments are subject to Saudi Income Tax Law, Article 68, and that Concord will deduct 5% in favor of the Zakat, Tax and Customs Authority.</p></div>
    <label className="declaration-check"><input name="withholdingAccepted" type="checkbox" value="yes" required /> I acknowledge the withholding tax declaration.</label></>}
    <div className="declaration-card"><strong>Cybersecurity compliance declaration</strong><p>The vendor agrees that Concord and the Insurance Authority may conduct cybersecurity reviews and audits, will cooperate and provide requested information and documentation, and will do so without compromising service continuity.</p></div>
    <label className="declaration-check"><input name="cybersecurityAccepted" type="checkbox" value="yes" required /> I accept the cybersecurity compliance declaration.</label>
    <div className="form-guidance"><strong>Procurement approval:</strong> captured as an authenticated approval event when Procurement advances this qualification. The Vendor ID is assigned only at that stage. Official Supplier Code of Conduct, NDA template/clause text, and approved declaration wording must be supplied by the business owner before production use.</div>
  </>
}
