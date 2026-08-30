# Tanfeeth — Product & Domain Specification (EN)

> Status: living document, **v2.0 (August 2026)**. Derived from `Tanfeeth_FRD.docx` and
> the `Flow & Functions` workbook. The Arabic master is [`PRODUCT.ar.md`](./PRODUCT.ar.md);
> the binding rules are in [`RULES.md`](./RULES.md). Requirement IDs use the
> convention **`FR-<module>-<n>`** (e.g. `FR-WF-012`).
>
> **New in 2.0:** §11 “Annual plan — announcement & submission cycle”
> (`FR-PL-001…014`), the notifications module (in‑app + email), a fixed
> permission catalog (no runtime permission creation), immediate session
> enforcement for deactivated/deleted accounts, and Arabic‑only error messages —
> see also rules R‑17 and R‑18 in `RULES.md`.

---

## 1. Vision, target & scope

### 1.1 What problem it solves
Saudi government entities run procurement through **Etimad** (the national
procurement platform) and authenticate through **Nafath**, but the *internal*
journey — drafting the request, budget approval, building the bid document
(كراسة), running committees (qualification, bid‑opening, technical, examination),
evaluating offers, awarding, drafting/signing the contract, commencing, amending,
and closing out — is fragmented across email, spreadsheets, and paper.

**Tanfeeth is the internal operating system around Etimad.** It orchestrates that
entire internal lifecycle, enforces who can do what and when, keeps an immutable
audit trail, surfaces the right dashboard to each persona, and adds an AI layer
that drafts, evaluates, predicts risk, and assists — always under human control.

### 1.2 Target users
A government entity’s procurement ecosystem: the **requesting departments**, the
**finance/budget** function, the **contracts & procurement department** (the
operational core), the statutory **committees**, **higher management**, supporting
functions (**legal**, **incoming/outgoing correspondence**), and the **external
contractor/supplier**.

### 1.3 Scope (the system does)
- Manage the **full competition lifecycle**: Order‑to‑Contract‑to‑Closeout.
- A **configurable workflow + business‑rules engine** (states, transitions, gates).
- **RBAC** across ~13 roles.
- **Integration** with Etimad, Nafath, MoF, GOSI and related platforms.
- An **AI layer** with mandatory **human‑in‑the‑loop (HITL)** controls.
- **Persona dashboards**: end user, contracts/procurement department, higher
  management, external contractor.
- **Vision 2030** alignment + local content + localization (Arabic RTL / English,
  Hijri + Gregorian, SAR).

### 1.4 The north‑star reference
The Etimad **“Executive Dashboard for Competitions” (اللوحة التنفيذية للمنافسات)**
— KPIs such as total competitions, invitations, offers, awarded suppliers,
estimated vs awarded value, and average days‑to‑award — is the reference for what
Tanfeeth’s executive layer must summarize for its own entity.

---

## 2. Personas

The FRD defines **four primary personas**; each maps to one or more roles.

1. **Internal entity users** — staff in the requesting, finance, contracts, legal,
   and correspondence functions, acting through their roles.
2. **Committees** — qualification, bid‑opening, technical evaluation, and bid
   examination (the last chaired with the Ministry of Finance).
3. **Higher management** — strategic & executive approval, signature, delegation,
   escalation, oversight.
4. **External contractor (supplier)** — reviews/signs the contract, initiates
   requests (extension, value change), submits progress updates, holds meetings.

---

## 3. Roles & access control (RBAC)

Authorization is **permission‑based with runtime roles**. The roles below are the
canonical set extracted from the process flow.

| Role | Core permissions |
|---|---|
| Requester Dept (End User) | Create order, fill fields, upload the bid document (كراسة) & docs, initiate commencement & evaluation requests. |
| Head of Requester Dept | Confirm / reject / edit the order before it advances. |
| Financial Manager / Budget Head | Confirm budget, return, comment, and **decide technical/financial document split** (see BR‑01). |
| Higher Management | Final approval, signature, delegation, escalation. |
| **Contract Dept Manager (CDM)** | Create the bid document, assign, review, initial‑sign; **permanent default access** to all actions on orders assigned to the department. |
| Contract Dept Staff | Execute assigned tasks, prepare the bid document, correspondence, draft contracts/procurements/letters. |
| Qualification Committee (Chair / Members / Secretary) | Enter company qualification scores, review, issue reports, launch the pre‑qualification announcement in Etimad. |
| Bid Opening Committee | Open technical & financial bids, upload opening minutes, receive offers from Etimad. |
| Technical Committee | Evaluate technical offers, enter scores, generate & sign reports. |
| Bid Examination Committee (MoF) | Confirm / return technical & financial reports, sign the letter of intent. |
| Incoming & Outgoing Dept | Issue official reference numbers & dates for correspondence. |
| Legal Dept | Review contracts/procurements and provide legal remarks. |
| Contractor (External) | Review & sign the contract, initiate requests, upload updates, hold meetings. |

**Access rules (binding):**
- **CDM default access** — the Contract Dept Manager always holds access to every
  action on the department’s orders and may act on a staff member’s behalf.
- **Assignment transfer** — when a task is assigned to a specific staff member,
  the *action* permission moves to that member while CDM access remains.
- Every transition is written to the **audit log** (actor, timestamp, before/after).

**v2.0 RBAC updates (binding):**
- **Fixed permission catalog** — permissions are seeded with the system
  (operational `resource.action` keys + the Etimad permission matrix v6);
  **no runtime permission creation** — no page, no API. Administration composes
  roles from the catalog only (R‑17).
- **Seeded annual‑plan roles** — Plan Announcer, Department Plan Coordinator,
  Department Plan Approver, Plan Reviewer (budget/preparation team), and Plan
  Approver — each carries exactly its own key plus read (see §11).
- **Session enforcement** — deactivating or deleting an account terminates its
  session immediately: every request re‑checks the account, and refresh/login
  are refused with a clear Arabic message.
- **Permission‑gated UI** — every page and action button sits behind its
  permission key (deep links show a “no permission” state); the sidebar mirrors
  granted permissions and refreshes periodically without re‑login.
- **Arabic error messages everywhere** — domain, HTTP, and validation errors
  reach the user in Arabic with stable machine codes (`USER.NOT_FOUND`, …).

---

## 4. The competition lifecycle (main path)

Ten stages, each a **state** in the workflow engine with role‑/rule‑gated
transitions. **Standard actions** available across stages: *Confirm, Reject,
Return‑with‑comment, Edit, Assign, Comment, Sign.* Every action is audited.

| # | Stage | Owner(s) |
|---|---|---|
| 1 | Order Creation & Approval | Requester → Head → Finance → Higher Mgmt (+ PMO, Cybersecurity, Local‑Content gates) |
| 2 | Bid Document Preparation (كراسة) | Contracts & Procurement (Manager/Staff) |
| 3 | Pre‑Qualification | Qualification Committee + Etimad |
| 4 | Project Announcement | Contracts staff + Etimad |
| 5 | Technical Bid Opening | Bid Opening Committee |
| 6 | Technical Evaluation | Technical Committee → Bid Examination (MoF) |
| 7 | Financial Bid Opening | Bid Opening Committee |
| 8 | Financial Evaluation & Award | Contracts → Bid Examination Committee |
| 9 | Contract Drafting & Signature | Contracts → Legal → Higher Mgmt → Contractor |
| 10 | Project Commencement | Branches by project type (Supply / Maintenance) |

### Business rules embedded in the main path
- **BR‑01 (document split).** When the budget is set, if the project value **> 5M
  SAR**, the system splits the **technical** and **financial** documents into two;
  otherwise they are merged into one. **The threshold must be configurable** in the
  rules engine.
- **BR‑02 (commencement branch).** Commencement follows the **project type**.
  *Supply* projects take the direct commencement‑letter path. *Maintenance*
  projects add a **site‑handover minute** and **site‑handover committee** approval.

### Stage details, user stories & scenarios

#### Stage 1 — Order Creation & Approval (`FR-WF-001…009`)
**Steps:** Requester creates & submits the order (fields + brief + documents) →
Head of Requester confirms/rejects/edits → Finance Manager & Budget Head confirm
budget (and apply BR‑01) → optional **PMO**, **Cybersecurity**, **Local‑Content**
gates → Higher Management final approval → CDM begins order processing.

- *User story:* “As a **requester**, I create a project order with all fields and
  attachments and submit it, so the procurement journey can start.”
- *User story:* “As the **Budget Head**, when I set the budget I decide — by the 5M
  rule — whether technical and financial requirements are one document or two.”
- **Scenario (happy path):** Requester submits → Head confirms → Finance confirms
  budget (value 8.2M → BR‑01 splits docs) → PMO/Cyber/Local‑Content approve →
  Higher Mgmt approves → order moves to Stage 2.
- **Options / alternatives:** any approver may **Return‑with‑comment** (sends it
  back to the previous owner) or **Edit**; a **Reject** terminates the order with a
  reason; **Assign** delegates the next action.

#### Stage 2 — Bid Document Preparation / كراسة (`FR-WF-006…012` processing)
CDM creates the bid document (output: **PDF or Word**), may comment, return to the
end user, edit, or **assign to a staff member** (action permission then transfers).
- *User story:* “As the **CDM**, I assign the bid‑document preparation to a staff
  member while retaining oversight and the ability to act.”
- **Scenario:** CDM assigns to staff → staff drafts the كراسة, comments to CDM →
  CDM reviews → ready for pre‑qualification.

#### Stage 3 — Pre‑Qualification (`FR-WF-008…012`)
Qualification Committee chair reviews/assigns to the secretary and distributes to
members; once approved, the **secretary launches the pre‑qualification
announcement in Etimad** and the chair approves; members enter qualification
scores; the secretary consolidates (Excel/PDF report) and raises to the chair, who
raises to the Contracts Dept.
- *User story:* “As a **qualification committee member**, I score each company
  against the eligibility criteria and submit.”
- **Option:** pre‑qualification may be skipped for tender methods that don’t
  require it — a configurable rule.

#### Stage 4 — Project Announcement (`FR-WF-013…017`)
Contracts staff insert project details **from Etimad** and launch the public
announcement; the bid‑opening committee chair assigns the secretary and notifies
members.

#### Stage 5 — Technical Bid Opening (`FR-WF-013…017`)
Bid‑opening committee opens technical bids; members acknowledge the opening date;
the coordinator uploads the **signed opening minute** and the **technical offers
received from Etimad** and submits to the chair, who reviews and forwards to the
Technical Committee.
- *User story:* “As the **bid‑opening coordinator**, I upload the signed opening
  minute and the technical offers pulled from Etimad.”

#### Stage 6 — Technical Evaluation (`FR-WF-018…022`)
Technical Committee chair assigns secretary & members; members review offers, enter
scores, comment, and may **request information**; the secretary generates the
report; members sign; the chair approves & signs; the **Bid Examination Committee
(MoF)** confirms or returns the technical report.
- **Platform value‑add:** Tanfeeth evaluates whether items are on the **mandatory
  list**, the **local‑content** requirement, and whether the company is an **SME**
  (data to be supplied later).
- *User story (HITL):* “As a **technical evaluator**, I receive AI‑suggested
  proposal scores with explanations, but the committee’s score is the decision.”

#### Stage 7 — Financial Bid Opening (`FR-WF-023`)
The opening cycle repeats for **financial** bids (assign, acknowledge date, upload
signed minute + financial offers from Etimad).
- **Platform value‑add:** Tanfeeth **reviews bills of quantities (BOQ), checks
  prices, proposes lowest‑offer reports, and produces a ready comparison** of
  offers.

#### Stage 8 — Financial Evaluation & Award (`FR-WF-023…031`)
CDM assigns staff to review the financial offer → staff generate the **awarding
letter/report** → CDM reviews & initial‑signs → Bid Examination Committee members
sign → chair signs & approves → chair + authorized signatory sign the **letter of
intent** → **post‑qualification** by the Qualification Committee (if applicable) →
Budget Head confirms the **final budget commitment** for the award amount →
authorized owner approves the award → Incoming/Outgoing issues the **reference
number**.
- *User story:* “As the **Budget Head**, I confirm the final commitment of the
  award amount before the award is approved.”
- **Option:** the award may be **rejected** by the authorized owner with reasons,
  returning the file for re‑examination.

#### Stage 9 — Contract Drafting & Signature (`FR-WF-029…033`)
Two scenarios (BR‑driven):
- **Scenario A — signed in Etimad:** the contract is approved/signed in Etimad; the
  staff member **uploads the contract data (PDF) and reflects it in Tanfeeth.**
- **Scenario B — signed outside Etimad:** the staff member **creates the contract
  data from Tanfeeth‑approved drafts**; the manager reviews and confirms.

Then: Legal reviews and adds remarks → CDM confirms remarks → staff reflect legal
remarks → CDM initial‑signs → Budget Head confirms final commitment → contractor
reviews/approves the **milestones schedule** → Higher Management reviews/edits and
signs → Contractor (external) reviews/edits and signs.
- *User story:* “As the **contractor**, I review the milestones and the contract,
  request edits if needed, and sign electronically.”
- *Note:* an additional signing scenario is pending stakeholder discussion.

#### Stage 10 — Project Commencement (`FR-WF-034…039`) — BR‑02
- **Supply projects:** Requester initiates the commencement request → CDM confirms
  → staff initiate the **commencement letter** → CDM signs → Incoming/Outgoing
  issues the reference number → letter emailed → contractor receives.
- **Maintenance projects:** add a **site‑handover report** initiated by staff, then
  reviewed/signed by the **site‑handover committee** (member then chair), a **cover
  letter**, reference number, and email to the contractor.

---

## 5. Exceptional paths (`FR-EX-001…013`)

Secondary flows beyond the main path.

### 5.1 Change orders / variation & cancellation (`FR-EX-001…006`)
Requester initiates a request to change contract terms (**value, duration,
terms**) → Head reviews & confirms → Higher Management approves/rejects/edits →
Contracts staff draft the **change‑order letter** (+ bid‑examination report if any),
initial‑sign → Bid Examination Committee (MoF) confirms/edits → Higher Mgmt +
committee members & chair sign → Correspondence issues reference number & date.
- *User story:* “As a **requester**, I request a variation to the contract value and
  track its approval through to the signed change‑order letter.”

### 5.2 Contract closeout (`FR-EX-007…009`)
Requester initiates the **preliminary acceptance certificate / site‑handover
report** → Contracts Dept initiates the certificate → contract/site‑handover
committee reviews, signs, and raises for approval → Higher Management approves or
rejects with comment.

### 5.3 Contractor evaluation (`FR-EX-010…011`)
Requester evaluates the contractor → Head reviews & confirms/edits → Higher
Management approves or rejects with comment. Feeds the supplier reliability index.

### 5.4 Subcontracting (`FR-EX-012…013`)
The main contractor assigns part of the contract works to a **subcontractor**; the
entity approves and tracks it. Statutory basis: **Article 71** of the Law and the
tender document's subcontracting clause; procedure **24** in the RGA manual.

**When it is declared:** the bidder submits the list of subcontractors **with the
offer** for approval (clause a), so anything declared in the offer is implicitly
approved on award; anything added after signature goes to the **manager of the
contract's supervising department** (then the deputy, then escalated to the parent
department), and the requester may never decide their own request (separation of
duties).

**Statutory caps:** subcontracted works must not exceed **30%** of the contract value
(clause d); from 30% and **below 50%** is allowed only with **prior approval from the
Expenditure Efficiency Authority** and assignment to **more than one subcontractor**
(clause j). The main contractor remains liable to the entity (clause f), and a
subcontractor may not sub-subcontract (clause g).

**Scope:** the works are identified as BOQ line items with a percentage each
(clause b); the sum allocated from one item across all subcontracts never exceeds 100%.

- **`FR-EX-012`** — register a subcontract (subcontractor from the contractor registry,
  allocated BOQ items with percentages, value, dates, licence, classification, contract
  file) with automatic statutory-limit checks.
- **`FR-EX-013`** — end a subcontract through a reasoned request approved by the
  department manager; the subcontractor does not leave until the exit is approved.

---

## 6. Platform modules & features

### 6.1 General features (`FR-FT-001…028`)
- **Access & references:** Etimad hyperlink, laws & regulations, **Scope‑of‑Work
  library**, framework agreements, **language switch (AR/EN)**.
- **Projects & tracking:** projects dashboard, new/upcoming (draft) projects,
  pending requests on contracts, **document status center**, project files (by
  stage), timeline tab.
- **Finance & guarantees:** **payment plan** (against MoF budget availability),
  **bank guarantees** with AI‑assisted tracking & renewal (with Monafasat AI),
  financial‑controller documents.
- **Correspondence & collaboration:** internal **messaging** with official
  number/date issuance for external correspondence, referral/handover with
  approval, team members (calls/chat/files/notes/Q&A), **committees tab** (a
  dashboard per committee the user belongs to).
- **Productivity & tasks:** productivity tab (deadlines + efficiency rate per
  member), notification center, **task center** (reminders + AI acting on the
  user’s behalf), user performance (score out of 100), staff knowledge testing.
- **Presentations & reports:** per‑project presentations (infographic or
  professional), **executive summary**, **report generator**, contractors center.

### 6.2 Contractor screen (`FR-CT-001…005`)
Contractor dashboard (project details, timeline, performance), contract section
(sign/review/download/share), request initiation (extension, value change),
updates window (record/write + images/video), meetings tab (with minutes,
recording, summary).

### 6.3 Contract Dept Manager screen (`FR-CM-001…010`)
Department performance vs higher‑management objectives, contracts summary
(active / nearing expiry with **color‑coded alerts** / pending / completed),
contracts repository (advanced search & filter), **lifecycle tracker** (visual
timeline), new contract from **dynamic templates + clause library**, configurable
**multi‑step approval flow** (delegate/escalate), **amendments with version control
& diff**, renewal/termination automation, collaboration & audit trail,
**reports & compliance** dashboard (highlights contracts missing mandatory clauses;
export Excel/PDF/CSV).

### 6.4 Higher Management module (`FR-HM-001…010`)
Strategic dashboard (competitions, ongoing projects, financial commitments,
supplier performance, compliance), customizable KPIs, department scorecards,
compliance dashboard, **supplier reliability index**, decision‑support (predictive
analytics, scenario planning, award‑recommendation summaries), financial oversight
(allocated / committed / remaining budgets, spend analysis, ROI), approval &
escalation management, **risk heatmap**, strategic planning (policy compliance,
sustainability & local‑content indicators).

---

## 7. AI layer (`FR-AI-001…016`) — under mandatory HITL

A cross‑cutting layer (in collaboration with **Monafasat AI**). **Binding control —
HITL:** no AI recommendation or decision with **financial, contractual, or
regulatory** impact is acted upon without **explicit human review and approval**,
and the system must provide **explainability** for every automated recommendation.

- **Tender automation & evaluation:** draft tender documents from templates + prior
  context; NLP scoring of technical proposals + ML estimation of price
  competitiveness; auto‑qualification (eligibility checks); **award recommendation**
  with explainable justifications.
- **Contract & supplier management:** draft/renew contracts from approved templates;
  continuous **compliance enforcement** (clause scanning + deviation alerts);
  supplier performance monitoring; supplier matching to new competitions.
- **Risk & fraud:** risk prediction with mitigation; financial‑anomaly fraud
  detection; **bid‑collusion** detection (timing/pricing similarity); **conflict‑of‑
  interest** alerts (supplier ↔ internal‑stakeholder relationships).
- **Knowledge & assistant:** generative hub / chatbot for internal rules and the
  government tenders & procurement law; per‑contract analysis & summary; smart
  document summarization & contextual search; voice assistant.

---

## 8. Vision 2030 & localization (`FR-V30-001…010`)

Localization dashboard (priority to local industries, SMEs, Saudi products),
supplier localization compliance (Nitaqat/Saudization, local materials), **Zakat &
VAT** automation, supplier localization index, regulatory non‑compliance alerts,
**mega‑project risk analysis** (e.g. NEOM, Red Sea, Diriyah Gate), budget‑to‑2030
alignment, government‑platform sync, **Arabic NLP**, and blockchain transparency
(future phase).

---

## 9. External integrations (`INT-01…09`)

| ID | System | Purpose | Criticality |
|---|---|---|---|
| INT‑01 | **Etimad** | Publish competitions, financial approval, receive offers, payment tracking. | Critical |
| INT‑02 | **Nafath** | National digital identity & authentication. | Critical |
| INT‑03 | **Ministry of Finance** | Budget, bid examination, payment plans. | Critical |
| INT‑04 | **GOSI** | Supplier compliance verification. | High |
| INT‑05 | **MISA** (Investment) | International suppliers per investment policy. | Medium |
| INT‑06 | **E‑Signature** | Digital contract signing (DocuSign / Adobe Sign). | High |
| INT‑07 | **ERP / CRM** | Contract sync & supplier data. | Medium |
| INT‑08 | **WhatsApp BSP** | HSM template notifications with opt‑in/out. | Medium |
| INT‑09 | **Monafasat AI** | Bank guarantees, generative AI, analytics. | High |

---

## 10. Non‑functional requirements (`NFR-01…08`)

- **Security** — encryption at‑rest/in‑transit, strict RBAC, full audit logs,
  NCA/CST compliance.
- **Data residency** — hosted **inside Saudi Arabia**, government‑compliant data
  residency.
- **Performance** — acceptable response under expected load; horizontal scaling.
- **Availability** — high availability + business continuity & disaster recovery.
- **Tenancy** — **multi‑tenant** with per‑entity data isolation.
- **Localization** — full Arabic (RTL) + English, Hijri + Gregorian calendars, SAR.
- **Auditability** — comprehensive audit log per action (actor, time, before/after).
- **Accessibility** — accessible & responsive across devices.

---

## 11. Annual plan — announcement & submission cycle (`FR-PL-001…014`) — new in 2.0

The annual procurement plan is not built centrally; it runs on an
**announce → department submissions → department‑manager approval → review →
final approval** cycle, with a server‑enforced submission window.

### 11‑1 Roles (seeded by default)

| Role | Key | Sole capability |
|---|---|---|
| Plan Announcer (procurement dept) | `planning.announce` | Name the plan, set the submission window, announce it. |
| Department Plan Coordinator (dept employee) | `planning.submit` | Add & submit their own department’s items while the window is open. |
| Department Plan Approver (dept manager) | `planning.approve_department` | Approve/reject their department’s submitted items. |
| Plan Reviewer (budget / preparation team) | `planning.review` | Review the plan after the window closes. |
| Plan Approver | `planning.approve` | Final approval after review. |

### 11‑2 Cycle & requirements

- **`FR-PL-001` Announce** — the announcer creates + announces in one step: year,
  title, window open time, window close time (draft → announced). Window times
  are editable only before the window opens.
- **`FR-PL-002` Year constraint** — plans may target the **current year up to
  five years ahead only**; never a past year (R‑18).
- **`FR-PL-003` Server‑time window** — the window state (scheduled/open/closed)
  is **derived from server time on every request** — never stored, no scheduler;
  opening and closing take effect exactly at the boundary (R‑18).
- **`FR-PL-004` Announcement broadcast** — announcing delivers an **in‑app
  notification + email** to every active user with the plan name and window
  times (via the notifications module).
- **`FR-PL-005` Department submissions** — during the window a department
  employee adds items **for their own department exclusively** (the department
  is inferred from membership, never chosen); items start as drafts.
- **`FR-PL-006` Item lifecycle** — draft → submitted → dept‑approved / rejected
  (reason mandatory); rejected items can be edited and resubmitted; only
  draft/rejected items are editable or deletable, by their submitter only.
- **`FR-PL-007` Department‑manager decision** — the manager registered in the
  department register decides on **their own department’s items only**;
  deciding stays available while the plan is announced (including after the
  window closes, before review).
- **`FR-PL-008` Operational separation of duties** — a manager never decides an
  item **they submitted themselves**, even when holding both keys.
- **`FR-PL-009` Visibility** — all departments’ items are **visible** to any
  `planning.read` holder (product decision: mutual visibility is legitimate);
  only actions are restricted by ownership and stewardship.
- **`FR-PL-010` Review** — reviewing (announced → reviewed) is available **only
  after the window closes**, to the budget/preparation team.
- **`FR-PL-011` Final approval** — an announced plan is approvable **only after
  review** (reviewed → approved); activation and closing follow as in 1.0.
  Non‑announced plans keep the 1.0 path (draft → approved) for backward
  compatibility.
- **`FR-PL-012` Window guards every submission operation** — create/edit/delete/
  submit outside the window are refused with a clear Arabic message.
- **`FR-PL-013` Real‑time UI** — a live countdown to open/close flips the screen
  state at the boundaries, driven by the server‑derived state, not the browser
  clock.
- **`FR-PL-014` Notifications module** — in‑app notifications (bell with unread
  badge, mark‑read single/all) + email via SMTP when configured (log‑only in
  development); any producer publishes through the `NOTIFICATION_INBOX` port.

### 11‑3 State map

```
draft ──announce──▶ announced ──(window: scheduled → open → closed)──▶ reviewed ──▶ approved ──▶ active ──▶ closed
                        │
                        └─ department items: draft → submitted → dept_approved / rejected (↺ resubmit)
```

---

## 12. Glossary

| Term | Meaning |
|---|---|
| Etimad (اعتماد) | National unified government procurement platform (MoF). |
| Nafath (نفاذ) | National digital‑identity authentication platform. |
| Kraasa (كراسة) | The bid document / RFP booklet of conditions & specifications. |
| Competition (منافسة) | A government tender. |
| BRD / FRD | Business / Functional Requirements Document. |
| RBAC | Role‑Based Access Control. |
| CDM | Contract Dept Manager (default permanent access). |
| MoF | Ministry of Finance / Bid Examination Committee. |
| HITL | Human‑in‑the‑loop — mandatory human oversight of impactful AI output. |
| BOQ | Bill of Quantities. |
| Letter of Intent | The pre‑contract intent letter signed after award. |

---

## 13. Requirement modules & traceability

| Module prefix | Source | Description |
|---|---|---|
| `FR-WF-001…039` | Sheet 1 — Project Journey | Competition lifecycle (main path). |
| `FR-EX-001…013` | Sheet 2 — Other Project Cases | Change orders, closeout, contractor evaluation, subcontracting. |
| `FR-FT / CT / CM` | Sheet 3 — Other Required Features | General modules, contractor & CDM screens. |
| `FR-HM-001…010` | Sheet 3 — Higher Management | Strategic/executive module. |
| `FR-AI-001…016` | Sheet 4 — AI Upgrade | AI & automation layer. |
| `FR-V30-001…010` | Vision 2030 | Localization & Vision 2030. |
| `FR-PL-001…014` | v2.0 — product decisions (August 2026) | Annual plan: announcement, window, department submissions, review, approval + notifications. |

**Next steps (from the FRD):** per‑requirement traceability matrix, prototype
specs, architecture document, security assessment, and **MVP vs later‑phase
scoping**.
