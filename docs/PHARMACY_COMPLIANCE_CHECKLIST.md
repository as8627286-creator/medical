# Pharmacy compliance checklist

**This is a launch gate, not a formality.**

The application implements the *technical* controls that make an online
pharmacy possible. It does not make the pharmacy legal. Nothing in this
repository - and no setting inside the administration area - creates,
confirms or implies a licence, a registration or a permission to sell
medicines online.

The **Compliance confirmed** switch in **Store settings** records that a
qualified person has completed this checklist. It is a statement by the
pharmacy, not a certification by the software.

**Do not enable "Accept new orders" until every item in section 1 and
section 2 is confirmed in writing.**

---

## How to use this document

1. Each item has a **Status** column. Leave it as *Not started* until it is
   actually done.
2. Record **who** confirmed it and **when**. An unsigned checklist is not
   evidence of anything.
3. Where an item says "state-specific", the answer depends on the state in
   which the premises are located. Confirm it with a regulatory adviser or
   the state drug control authority, not from a web page.
4. Attach the evidence (licence copy, registration certificate, written
   confirmation) to the pharmacy's records. This document records that the
   evidence exists; it does not replace it.

Legend: **Required** - the storefront must not accept orders without it.
**Recommended** - strongly advised before go-live. **Operational** - a process
that must exist and be written down.

---

## 1. Licences and premises

| # | Item | Status | Confirmed by | Date | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1.1 | **Required.** A valid retail drug licence (for example Form 20/21, or the state equivalent) is held for the premises from which the medicines are dispensed. | Not started | | | |
| 1.2 | **Required.** The licence covers the exact premises that will dispatch the orders, and the premises are inspected and approved. | Not started | | | |
| 1.3 | **Required.** A separate licence or registration is held for the online sale of medicines, where the state or the central rules require one. | Not started | | | |
| 1.4 | **Required.** The online activity itself has been confirmed as permitted in the state where the customers are served, in writing. | Not started | | | |
| 1.5 | **Recommended.** The scope of the licence has been read against the list of products in the catalogue, including the restrictions that apply to specific schedules. | Not started | | | |
| 1.6 | **Required.** The licence details (number, issuing authority, validity) are entered in **Store settings** exactly as printed. | Not started | | | |
| 1.7 | **Operational.** A process exists to renew the licence and to suspend online sales if it lapses. | Not started | | | |

**Note.** Item 1.4 is the item that most often stops a project. Selling
medicines online is treated differently from selling them across a counter in
several jurisdictions. Do not assume that a retail licence is enough.

---

## 2. Personnel

| # | Item | Status | Confirmed by | Date | Evidence |
| --- | --- | --- | --- | --- | --- |
| 2.1 | **Required.** A registered pharmacist is appointed and is responsible for the dispensing of every prescription-only medicine. | Not started | | | |
| 2.2 | **Required.** The pharmacist's registration number is recorded in **Store settings**. | Not started | | | |
| 2.3 | **Required.** The pharmacist (or another person who holds the appropriate qualification) reviews every prescription before the order is dispensed. The application supports this; it does not perform the review. | Not started | | | |
| 2.4 | **Required.** The rules for accepting a prescription (who may sign it, how old it may be, which specialities are accepted, which controlled drugs are excluded) have been written down and configured. | Not started | | | |
| 2.5 | **Required.** Only authorised personnel have access to customer records and to prescription documents. The `PHARMACIST` and `ADMIN` roles exist for this. | Not started | | | |
| 2.6 | **Recommended.** A deputy is appointed for the pharmacist's absence, and the administration area can be used by a named person only. | Not started | | | |

---

## 3. Products

| # | Item | Status | Confirmed by | Date | Evidence |
| --- | --- | --- | --- | --- | --- |
| 3.1 | **Required.** The list of products that may be sold online has been confirmed against the applicable rules, including the schedules that are prohibited or restricted from online sale. | Not started | | | |
| 3.2 | **Required.** Every product that must not be sold online is flagged with a legal restriction. The application refuses to list a product with a binding restriction, whatever the sale-eligibility flag says. | Not started | | | |
| 3.3 | **Required.** The catalogue contains the information printed on the pack. No medical claims, no indications and no advice have been added. | Not started | | | |
| 3.4 | **Required.** Prices are correct, shown in rupees, and the tax treatment is right for the pharmacy. The application treats prices as tax inclusive and derives the tax component for reporting. | Not started | | | |
| 3.5 | **Recommended.** A second person checks new catalogue entries before they are published. | Not started | | | |
| 3.6 | **Operational.** A recall procedure exists: how a batch is quarantined, how customers are informed, and how the stock adjustment is recorded. | Not started | | | |

---

## 4. Prescriptions

| # | Item | Status | Confirmed by | Date | Evidence |
| --- | --- | --- | --- | --- | --- |
| 4.1 | **Required.** The prescription workflow in the application matches the pharmacy's own procedure, including what happens when a prescription is rejected. | Not started | | | |
| 4.2 | **Required.** Uploading a prescription is never treated as approval. The application requires a separate, recorded review decision. | Not started | | | |
| 4.3 | **Required.** The retention period for prescription records has been confirmed with the applicable rules, and the configured retention (three years by default) is set accordingly. | Not started | | | |
| 4.4 | **Required.** The pharmacy has decided who may see a prescription document, and the accounts have been created accordingly. | Not started | | | |
| 4.5 | **Operational.** A process exists for a customer who disputes a prescription rejection. | Not started | | | |

---

## 5. Delivery

| # | Item | Status | Confirmed by | Date | Evidence |
| --- | --- | --- | --- | --- | --- |
| 5.1 | **Required.** The serviceable PIN codes are the areas the pharmacy can actually serve. The delivery zones in the application list them. | Not started | | | |
| 5.2 | **Required.** The delivery charges and the minimum order values are commercially correct and are shown before the order is placed. | Not started | | | |
| 5.3 | **Required.** Any product that needs special handling (cold chain, controlled substance, age restriction) is either excluded from online sale or has a written procedure. | Not started | | | |
| 5.4 | **Required.** The delivery window shown to the customer is one the pharmacy can keep. The application shows the configured window and does not promise a date that is not configured. | Not started | | | |
| 5.5 | **Operational.** A procedure exists for a failed delivery and for a re-delivery attempt. | Not started | | | |

---

## 6. Consumer protection

| # | Item | Status | Confirmed by | Date | Evidence |
| --- | --- | --- | --- | --- | --- |
| 6.1 | **Required.** A returns and refunds policy has been written and published. The template in **Store settings** is a placeholder. | Not started | | | |
| 6.2 | **Required.** The policy states what happens to a medicine that has already been dispensed. | Not started | | | |
| 6.3 | **Required.** A grievance process exists, with a named contact, a response time and a record of complaints. | Not started | | | |
| 6.4 | **Required.** The cancelled-order and refund rules are decided and configured (see the limitation in `docs/ARCHITECTURE.md` about automatic refunds). | Not started | | | |
| 6.5 | **Recommended.** The pharmacy's contact details and business hours are published and monitored. | Not started | | | |

---

## 7. Personal data

| # | Item | Status | Confirmed by | Date | Evidence |
| --- | --- | --- | --- | --- | --- |
| 7.1 | **Required.** The applicable data protection obligations have been confirmed (for example the Digital Personal Data Protection Act 2023 and the state rules), including the lawful basis for processing prescription and health data. | Not started | | | |
| 7.2 | **Required.** A privacy notice is published. The template in **Store settings** is a placeholder. | Not started | | | |
| 7.3 | **Required.** The retention periods for customer records, order records and prescription documents have been decided and are documented in `docs/BACKUP_AND_RESTORE.md`. | Not started | | | |
| 7.4 | **Required.** A process exists for a request to access, correct or delete personal data, including the exception for records that must be kept for legal or record-keeping reasons. | Not started | | | |
| 7.5 | **Required.** A process exists to notify the affected people and the authority of a personal data breach, with the timeline that the applicable rules require. | Not started | | | |
| 7.6 | **Recommended.** The pharmacy has decided whether to appoint a data protection contact. | Not started | | | |
| 7.7 | **Operational.** Only the necessary customer information is collected. The application deliberately does not collect medical history, and payment card data never reaches it. | Not started | | | |

---

## 8. Payments

| # | Item | Status | Confirmed by | Date | Evidence |
| --- | --- | --- | --- | --- | --- |
| 8.1 | **Required.** The payment provider has confirmed in writing that the merchant category (pharmacy / healthcare) is eligible for the account. | Not started | | | |
| 8.2 | **Required.** The contractual requirements of the provider (settlement, chargeback, reserves) are understood. | Not started | | | |
| 8.3 | **Required.** The gateway credentials are in the environment only, and the provider's dashboard has the webhook URL configured with the shared secret. | Not started | | | |
| 8.4 | **Required.** The Razorpay adapter has been tested with test credentials, including a failed payment, a cancelled payment, a duplicate webhook and a webhook with a wrong signature. | Not started | | | |
| 8.5 | **Required.** The reconciliation process (matching provider settlements against the orders in the application) has been written down. | Not started | | | |
| 8.6 | **Recommended.** Cash on delivery is limited by a maximum order value so that the exposure is bounded. | Not started | | | |

---

## 9. Platform readiness

| # | Item | Status | Confirmed by | Date | Evidence |
| --- | --- | --- | --- | --- | --- |
| 9.1 | **Required.** HTTPS is configured and the certificate renews automatically. | Not started | | | |
| 9.2 | **Required.** The database is backed up daily and a restore has been **tested** on a separate machine. | Not started | | | |
| 9.3 | **Required.** The development accounts and the placeholder catalogue have been removed. | Not started | | | |
| 9.4 | **Required.** `PAYMENT_LIVE` is still `false` unless section 8 is complete. | Not started | | | |
| 9.5 | **Required.** The firewall allows only 22, 80 and 443, and the database port is not reachable from outside. | Not started | | | |
| 9.6 | **Required.** The administrator accounts use strong, unique passwords and the staff session lifetime is short enough. | Not started | | | |
| 9.7 | **Recommended.** An incident response plan exists, with names, contact numbers and the steps to take. | Not started | | | |
| 9.8 | **Recommended.** The audit log is reviewed regularly. | Not started | | | |

---

## 10. Final sign-off

The storefront must stay in development mode (no new orders, no live
payments) until this section is complete.

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Responsible pharmacist | | | |
| Pharmacy owner / proprietor | | | |
| Regulatory adviser (if used) | | | |

**Final confirmation**

- [ ] Every **Required** item in sections 1 to 8 is confirmed.
- [ ] Every **Required** item in section 9 is confirmed.
- [ ] The evidence for each item is filed.
- [ ] The compliance checklist has been communicated to every member of staff
      who uses the administration area.
- [ ] The owner understands that this checklist is a record of the pharmacy's
      own confirmations, and that the software does not provide legal advice
      or legal assurance.
