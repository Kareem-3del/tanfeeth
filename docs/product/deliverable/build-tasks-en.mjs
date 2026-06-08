// English task register — mirrors build-tasks.mjs, injects into revised-en.html.
import fs from 'node:fs';

const HTML = '/Users/kareem.adel.zayed/tanfeth/docs/product/deliverable/revised-en.html';
const HOURS_PER_MONTH = 160;
const SCALE = 0.3;

const CAT = {
  be:  { ar: 'Infrastructure', cls: 'be'  },
  fe:  { ar: 'User Interface', cls: 'fe'  },
  int: { ar: 'Systems Integration', cls: 'int' },
  ai:  { ar: 'AI', cls: 'ai'  },
  ops: { ar: 'Deployment & Ops', cls: 'ops' },
  qa:  { ar: 'QA Testing', cls: 'qa'  },
  ux:  { ar: 'Design', cls: 'ux'  },
  pm:  { ar: 'PM', cls: 'pm'  },
  sec: { ar: 'Security', cls: 'sec' },
};
const ST = {
  todo: { ar: 'To do', cls: 'todo' },
  wip:  { ar: 'In progress', cls: 'wip'  },
  done: { ar: 'Completed', cls: 'done' },
};
const TRACKS = [
  { key: 'A', name: 'Track A — Platform Foundations' },
  { key: 'B', name: 'Track B — Pre-award & Signature' },
  { key: 'C', name: 'Track C — Contract & Project Execution' },
  { key: 'D', name: 'Track D — Intelligence & Reporting' },
  { key: 'E', name: 'Track E — Integrations & Localization' },
  { key: 'S', name: 'Track S — Cybersecurity & Protection (ECC)' },
  { key: 'X', name: 'Cross-cutting (QA, Ops, Design, PM)' },
];
const EPIC = {
  E01: 'E01 — Identity, Auth & RBAC',
  E02: 'E02 — Multi-tenancy & Data Residency',
  E03: 'E03 — Workflow & Business-Rules Engine',
  E04: 'E04 — Immutable Audit Log',
  E05: 'E05 — Correspondence, Letters & Reference Numbers',
  E06: 'E06 — Notifications & Task/Deadline Center',
  E07: 'E07 — Documents, Files & E-signature',
  E08: 'E08 — Order Creation & Approval',
  E09: 'E09 — Bid-Document (Kraasa) Preparation',
  E10: 'E10 — Committees: Pre-qual, Opening, Evaluation',
  E11: 'E11 — Announcement, Award & Letter of Intent',
  E12: 'E12 — Contract Drafting & Signature',
  E13: 'E13 — Contractor Onboarding & Invitation',
  E14: 'E14 — Contractor Portal',
  E15: 'E15 — Project Execution & Commencement',
  E16: 'E16 — Contract Lifecycle Actions (18)',
  E17: 'E17 — Contract Linking & Completion Contracts',
  E18: 'E18 — Closeout & Contractor Evaluation',
  E19: 'E19 — AI Layer & HITL',
  E20: 'E20 — Dashboards & Reporting',
  E21: 'E21 — National Integrations',
  E22: 'E22 — Vision 2030 & Localization',
  S1:  'Cybersecurity Governance (ECC-1)',
  S2:  'Cybersecurity Defense (ECC-2)',
  S3:  'Cybersecurity Resilience (ECC-3)',
  S4:  'Third-Party & Cloud Computing (ECC-4)',
  X:   'Cross-cutting tasks',
};

// id, track, epic, cat, status, hrs, deps, title, desc
const T = [
  // Track A
  ['E01.T1','A','E01','be','wip',24,'E03','CDM default-access as policy','Model the contract-manager default access as a permission policy (not bespoke code): permanent access to the department orders, with the ability to act on staff behalf.'],
  ['E01.T2','A','E01','be','todo',16,'E13','Oversight & contractor permissions','Add new permission keys (resource.action) for the oversight (read/audit) and contractor (own-contract only) personas to the seed catalog.'],
  ['E01.T3','A','E01','ops','todo',8,'—','Rotate admin password & policy','Rotate the seeded admin password on first boot and enforce password-strength and lockout policy.'],
  ['E01.T4','A','E01','qa','wip',24,'—','Auth & token-rotation tests','Integration tests for login, refresh-token rotation and reuse prevention, and access-token expiry.'],
  ['E02.T1','A','E02','be','todo',40,'E01','Tenant context & isolation filter','Request-scoped tenant context and a base repository filter scoping every query to the entity, rejecting out-of-tenant access.'],
  ['E02.T2','A','E02','be','todo',24,'E07','Per-tenant file isolation','Namespace and isolate file/storage paths per entity so tenants\' files never overlap.'],
  ['E02.T3','A','E02','qa','todo',16,'E02.T1','Cross-tenant access test','Automated test proving one entity cannot read another\'s data through any path.'],
  ['E02.T4','A','E02','ops','todo',32,'—','Data-residency & encryption proof','Document and verify in-Kingdom hosting, encryption at rest/in transit, TLS and backup residency per NCA/CST.'],
  ['E02.T5','A','E02','be','todo',16,'E04,E07','Tenant-scope audit & storage','Scope the audit log and storage keys to the entity within multi-tenant isolation.'],
  ['E03.T1','A','E03','be','wip',80,'E01','Generalize the workflow engine','Generalize the contract workflow slice into a reusable engine: state registry and transition definitions reused across all flows.'],
  ['E03.T2','A','E03','be','todo',60,'E03.T1','Transition guard pipeline','Per-transition guard pipeline: permission check, then business rule, then effect, then audit write.'],
  ['E03.T3','A','E03','be','todo',32,'E03.T1','Standard actions & error codes','Catalog of standard actions (Confirm/Reject/Return-with-comment/Edit/Assign/Comment/Sign) and unified domain error codes.'],
  ['E03.T4','A','E03','be','todo',40,'E03.T1','Configurable business-rules store','Configurable store for the document-split threshold (BR-01) and commencement branch (BR-02) — no hard-coding.'],
  ['E03.T5','A','E03','be','todo',40,'E03.T1','Configurable approval chains','Configurable multi-step approval chains (delegate/escalate) per request and action type.'],
  ['E03.T6','A','E03','be','todo',32,'E01','Assignment & delegation','Transfer action permission to the assignee while the manager retains access; assignment audited.'],
  ['E03.T7','A','E03','be','todo',24,'E03.T1','Workflow read API','Workflow read API and an "available actions for me" resolver by role and state (drives UI buttons).'],
  ['E03.T8','A','E03','fe','todo',48,'E03.T7','Generic workflow UI','State timeline, available-actions bar, return-with-comment modal and assignment picker.'],
  ['E03.T9','A','E03','qa','todo',24,'E03.T2','Gated-transition e2e','End-to-end test of a gated transition combining permission, rule and audit write.'],
  ['E04.T1','A','E04','be','todo',32,'E03.T1','Append-only audit store','Audit port and append-only store written from the engine\'s effect step (actor, time, before/after).'],
  ['E04.T2','A','E04','be','todo',24,'E04.T1','Tamper-evidence','Design and initial build of a hash chain proving the audit log is tamper-evident.'],
  ['E04.T3','A','E04','fe','todo',32,'E04.T1','Activity timeline','Per-contract/order activity timeline with filtering by actor, action and date.'],
  ['E04.T4','A','E04','be','todo',16,'E04.T1','Audit read/export','Audit-log read/export API for oversight and reporting.'],
  ['E05.T1','A','E05','be','todo',48,'E03','Letter templates & clauses','Dynamic letter templates with a versioned clause library to generate official letters.'],
  ['E05.T2','A','E05','be','todo',24,'E05.T1','Data merge & validation','Merge contract/project data into templates with validation of required fields.'],
  ['E05.T3','A','E05','be','todo',32,'E05.T1','PDF/Word bilingual output','Render output as PDF and Word in Arabic and English, reusing the report renderer.'],
  ['E05.T4','A','E05','int','todo',40,'E21','Reference-number integration','Integration to issue an official reference number and date via the incoming/outgoing system.'],
  ['E05.T5','A','E05','be','todo',16,'E03,E05.T4','Reference-number gate','Block any transition emitting an external letter from completing without a reference number.'],
  ['E05.T6','A','E05','fe','todo',40,'E05.T1','Letter composer','Edit, preview, route for signature, and show the reference badge.'],
  ['E05.T7','A','E05','ai','todo',24,'E19','AI letter pre-fill','AI pre-fills the letter with explanation; a human edits/approves before issuance.'],
  ['E06.T1','A','E06','be','todo',32,'E03','Notification model & fan-out','Notification model, subscription to engine events, and in-app fan-out.'],
  ['E06.T2','A','E06','be','todo',32,'E03','Task & deadline center','Derive tasks from open/assigned transitions with deadlines and an overdue flag.'],
  ['E06.T3','A','E06','int','todo',32,'E21','WhatsApp & email channels','WhatsApp Business (HSM templates, opt-in/out) and email channel for external notifications.'],
  ['E06.T4','A','E06','fe','todo',40,'E06.T1,E06.T2','Notification/task UI','Notification center and task center UI.'],
  ['E06.T5','A','E06','ai','todo',40,'E19','AI-on-behalf queue','An "AI acts on my behalf" queue for routine actions, with human approval for impactful ones (later phase).'],
  ['E07.T1','A','E07','be','wip',32,'—','Project files & status center','Project files model by stage with a document status center to surface what is missing.'],
  ['E07.T2','A','E07','int','todo',56,'—','E-signature integration','Provider abstraction, envelope creation, signed webhook, signed-artifact storage and audit.'],
  ['E07.T3','A','E07','fe','todo',32,'E07.T1','Document center UI','Document center UI (status, by stage, upload, versions).'],

  // Track B
  ['E08.T1','B','E08','be','todo',48,'E03','Order domain & Stage-1','Order domain (fields, brief, attachments) and creation/approval transitions on the engine.'],
  ['E08.T2','B','E08','be','todo',16,'E03.T4','BR-01 document-split hook','Apply BR-01 at budget set to split/merge the technical and financial documents.'],
  ['E08.T3','B','E08','be','todo',24,'E03','Optional approval gates','Optional PMO, cybersecurity and local-content gates, toggleable by config.'],
  ['E08.T4','B','E08','fe','todo',48,'E03.T8','Order create/approve UI','Order create/edit screens and approval/return screens.'],
  ['E08.T5','B','E08','qa','todo',16,'E08.T1','Order-path tests','Tests for the happy path, return-with-comment and reject-with-reason.'],
  ['E09.T1','B','E09','be','todo',24,'E03.T6','Kraasa transitions & assignment','Bid-document stage transitions and assignment to staff with action-permission transfer.'],
  ['E09.T2','B','E09','fe','todo',40,'E07','Kraasa builder','Bid-document builder, assignment and preview UI.'],
  ['E09.T3','B','E09','be','todo',16,'E05,E07','Kraasa output','Generate the bid-document output (PDF/Word) via the correspondence/document engine.'],
  ['E10.T1','B','E10','be','todo',56,'E03','Committee models','Committee models (qualification, opening, technical, examination), members, roles and workflow.'],
  ['E10.T2','B','E10','be','todo',48,'E10.T1','Scoring & committee reports','Scoring/evaluation forms and committee report generation and signing.'],
  ['E10.T3','B','E10','int','todo',40,'E21','Pull offers from Etimad','Pull offers and announcement data from Etimad and reflect them in the platform.'],
  ['E10.T4','B','E10','be','todo',40,'E10.T1','BOQ price check & comparison','BOQ price-check service plus offer comparison and lowest-offer suggestion.'],
  ['E10.T5','B','E10','fe','todo',56,'E10.T1','Committees tab','A dashboard per committee with score entry, reports and tracking.'],
  ['E11.T1','B','E11','be','todo',56,'E10','Award & letter of intent','Announcement and award transitions and generation of the award letter and letter of intent.'],
  ['E11.T2','B','E11','be','todo',24,'E03','Post-qual & final commitment','Post-qualification and final budget-commitment confirmation before award approval.'],
  ['E11.T3','B','E11','int','todo',32,'E21','Publish announcement/award','Publish the announcement and award data via Etimad.'],
  ['E11.T4','B','E11','fe','todo',32,'E11.T1','Announcement/award screens','Announcement, award and letter-of-intent screens.'],
  ['E12.T1','B','E12','be','todo',32,'E21','Signed-in-Etimad scenario','Import the signed-contract data from Etimad and reflect it in the platform.'],
  ['E12.T2','B','E12','be','todo',32,'E03','Signed-outside scenario','Create contract data from approved drafts with manager confirmation.'],
  ['E12.T3','B','E12','be','todo',40,'E03','Legal review & milestones','Legal review and remarks path, final commitment and the milestones schedule.'],
  ['E12.T4','B','E12','int','todo',24,'E07.T2','E-sign the contract','Electronically sign the contract by higher management and the contractor.'],
  ['E12.T5','B','E12','fe','todo',40,'E12.T3','Contract drafting screens','Contract drafting, review and signing screens.'],

  // Track C
  ['E13.T1','C','E13','be','todo',56,'E01,E02,E12','Contractor account model','Contractor account bound to the commercial registration and contract, scoped to entity and contract, with de-duplication.'],
  ['E13.T2','C','E13','be','todo',40,'E12,E03','Invitation domain','Issue (signed-contract gate), single-use expiring token, accept, resend, revoke, audit.'],
  ['E13.T3','C','E13','int','todo',48,'E21','Identity & GOSI verification','Verify contractor identity (Nafath/business identity) and GOSI compliance at onboarding.'],
  ['E13.T4','C','E13','be','todo',16,'E01','Contractor permissions','Contractor permission bundle scoped to their own contract actions only.'],
  ['E13.T5','C','E13','fe','todo',24,'E13.T2','Invite-contractor UI','Employee "invite contractor" flow with invitation status and resend.'],
  ['E13.T6','C','E13','fe','todo',32,'E13.T1','Contractor registration UI','Contractor registration/accept flow and commercial-registration binding.'],
  ['E13.T7','C','E13','qa','todo',24,'E13.T1','Contractor isolation test','E2E: invite → accept → sees only their contract; cross-contract/tenant access denied.'],
  ['E14.T1','C','E14','fe','todo',48,'E13','Contractor dashboard','Project details, timeline, performance and what is due.'],
  ['E14.T2','C','E14','fe','todo',32,'E07.T2','Contract section','Review, sign, download and share the contract.'],
  ['E14.T3','C','E14','fe','todo',40,'E16','Contractor requests','Contractor-initiated requests (extension/value change) entering the entity\'s gated workflow (BE+FE).'],
  ['E14.T4','C','E14','fe','todo',40,'E15','Updates window','Updates window (text + images/video) against milestones and the BOQ (BE+FE).'],
  ['E14.T5','C','E14','fe','todo',32,'E05,E16','In-platform letter replies','In-platform replies to warning/dues/notice letters, recorded before escalation (required by the scenario).'],
  ['E14.T6','C','E14','fe','todo',48,'E19','Contractor meetings','Meetings tab with minutes, recording and AI summary (later phase).'],
  ['E15.T1','C','E15','be','todo',48,'E03.T4,E05','Commencement transitions (BR-02)','Commencement transitions branching by project type (supply/maintenance) with letters.'],
  ['E15.T2','C','E15','be','todo',56,'—','BOQ model','BOQ model (item/quantity/unit price/measured/remaining) with import; feeds completion-contract carry-over.'],
  ['E15.T3','C','E15','be','todo',40,'E15.T2','Milestones, progress & delay','Milestones/progress model, planned-vs-actual and delay computation.'],
  ['E15.T4','C','E15','be','todo',48,'E15.T2,E21','Payments (mustakhlasat)','Payments against the BOQ and MoF budget availability, gated and audited.'],
  ['E15.T5','C','E15','fe','todo',64,'E15.T3','Project execution dashboard','Execution dashboard (timeline, milestones, BOQ progress, delay flags, payments).'],
  ['E15.T6','C','E15','fe','todo',32,'E15.T1','Commencement/site-handover UI','Commencement, site-handover-minute and cover-letter screens.'],
  ['E15.T7','C','E15','qa','todo',24,'E15.T1','Commencement tests','Tests for supply and maintenance commencement with the site-handover committee.'],
  ['E16.T1','C','E16','be','todo',80,'E03.T1,E05','Action framework on the engine','Trigger + precondition rule + owner role + approval chain + letter template + state/financial/guarantee effect + AI-suggestion hook.'],
  ['E16.T2','C','E16','be','todo',64,'E16.T1','MVP action set','Eight MVP actions (commence, warning, final warning, withdrawal, variation, extension, suspension, resumption) as config rows.'],
  ['E16.T3','C','E16','be','todo',72,'E16.T1,E18,E13','Phase-2 action set','Dues, assignment, labor endorsement, preliminary/final acceptance, termination, guarantees, representative delegation.'],
  ['E16.T4','C','E16','ai','todo',40,'E19','AI suggestion per action','AI suggestion and explanation per action under human oversight.'],
  ['E16.T5','C','E16','fe','todo',48,'E03.T8,E05.T6','Action launcher UI','Action launcher on the contract/project view with letter preview, approval and signing.'],
  ['E16.T6','C','E16','qa','todo',32,'E16.T2','Action e2e tests','E2E per action group (permission + rule + letter + reference + audit + state).'],
  ['E17.T1','C','E17','be','todo',32,'E16','Contract relationship model','Typed contract-relationship links shown on both contracts.'],
  ['E17.T2','C','E17','be','todo',40,'E16,E15.T2','Completion-contract spawn','Spawn the completion contract from withdrawal, carrying the remaining BOQ and linking to the original.'],
  ['E17.T3','C','E17','fe','todo',24,'E17.T1','Linked-contracts UI','Linked-contracts UI and original↔completion chain view.'],
  ['E17.T4','C','E17','qa','todo',16,'E17.T2','Completion e2e test','E2E: withdrawal → linked completion contract with the remaining scope.'],
  ['E18.T1','C','E18','be','todo',40,'E16','Acceptance transitions','Preliminary/final acceptance transitions with committee and higher-management approval.'],
  ['E18.T2','C','E18','be','todo',24,'E18.T1','Guarantee release & closeout','Release the final guarantee and close the contract.'],
  ['E18.T3','C','E18','be','todo',32,'E20','Contractor evaluation','Contractor evaluation form feeding the supplier reliability index (BE+FE).'],

  // Track D
  ['E19.T1','D','E19','be','todo',40,'E04','Recommendation & approval domain','A recommendation object (recommendation + rationale + confidence + sources) with a human decision recorded in the audit log.'],
  ['E19.T2','D','E19','ai','wip',56,'E03,E15','Next-Best-Action engine','Engine recommending the next action over contract/project state with justification.'],
  ['E19.T3','D','E19','ai','todo',56,'E15','Risk-scoring service','Risk scoring (delay/financial/compliance) with drivers, feeding the risk heatmap.'],
  ['E19.T4','D','E19','ai','todo',48,'E05,E12','Clause/compliance scanner','Scan contracts/letters for missing mandatory clauses and deviations.'],
  ['E19.T5','D','E19','ai','todo',56,'—','Knowledge assistant','Assistant and contextual search over rules, the procurement law and each contract.'],
  ['E19.T6','D','E19','ai','todo',80,'—','Fraud/collusion/COI detection','Bid-collusion, financial-anomaly and conflict-of-interest detection — advisory under oversight (later phase).'],
  ['E19.T7','D','E19','be','wip',16,'—','Rate limit & AI opt-in','AI call rate limit and a per-tenant AI enablement flag.'],
  ['E19.T8','D','E19','fe','todo',32,'E19.T1','HITL approval surface','UI showing the recommendation and its explanation with approve/edit/reject.'],
  ['E20.T1','D','E20','fe','todo',56,'E15,E16,E04','CDM dashboard','Contract-manager dashboard: performance, contracts summary with color-coded alerts, repository and lifecycle tracker.'],
  ['E20.T2','D','E20','fe','todo',56,'E19','Executive dashboard','Higher-management strategic dashboard with the risk heatmap.'],
  ['E20.T3','D','E20','fe','todo',32,'—','End-user dashboard','End-user dashboard: projects, pending requests, document status and timeline.'],
  ['E20.T4','D','E20','fe','todo',32,'E04','Oversight/compliance view','Compliance and audit-log view for oversight bodies.'],
  ['E20.T5','D','E20','be','wip',32,'—','Report generator extension','Extend the report generator and executive summary (built on the existing engine).'],
  ['E20.T6','D','E20','be','todo',24,'E18','Supplier reliability index','Aggregate the supplier reliability index from contractor evaluations and performance.'],

  // Track E
  ['E21.T1','E','E21','int','todo',80,'E02','Etimad adapter','Etimad adapter (publish/offers/payments) behind a domain port with sync/reconciliation jobs.'],
  ['E21.T2','E','E21','int','todo',40,'E02','Nafath adapter','Nafath adapter for identity and authentication.'],
  ['E21.T3','E','E21','int','todo',56,'E02','MoF adapter','Ministry of Finance adapter (budget, bid examination, payment plans).'],
  ['E21.T4','E','E21','int','todo',32,'E02','GOSI adapter','GOSI adapter for supplier-compliance verification.'],
  ['E21.T5','E','E21','int','todo',48,'E02','Supporting adapters','E-signature, ERP/CRM and WhatsApp (sync/notifications).'],
  ['E21.T6','E','E21','ops','todo',32,'—','Integration sandboxes','Sandboxes and contract tests for integrations during development before live links.'],
  ['E22.T1','E','E22','fe','todo',56,'E20,E21','Localization dashboard','Localization dashboard, local-content index and Nitaqat/Saudization.'],
  ['E22.T2','E','E22','be','todo',40,'—','Zakat & VAT automation','Zakat and VAT automation in the related accounts.'],
  ['E22.T3','E','E22','ai','todo',48,'—','Mega-project risk & Arabic NLP','Mega-project risk analysis and Arabic NLP.'],

  // Track S
  ['S1.T1','S','S1','sec','todo',56,'—','Cybersecurity strategy & policy','Define, document and approve the platform cybersecurity strategy, policies and procedures and publish to stakeholders (ECC 1-1/1-3).'],
  ['S1.T2','S','S1','sec','todo',24,'—','Roles & governance','Define cybersecurity roles and responsibilities (RACI) and the governance/oversight framework (ECC 1-4).'],
  ['S1.T3','S','S1','sec','todo',48,'—','Cyber risk management','Risk methodology and register, with assessment in IT-project phases, before major changes and for third-party services (ECC 1-5/1-6).'],
  ['S1.T4','S','S1','sec','todo',40,'—','Compliance & periodic audit','Compliance with legal/regulatory requirements and periodic self-assessment/audit against the controls (ECC 1-7/1-8).'],
  ['S1.T5','S','S1','sec','todo',32,'—','Cybersecurity in HR','Confidentiality clauses, security screening for sensitive roles, and pre/during/post-employment requirements (ECC 1-9).'],
  ['S1.T6','S','S1','sec','todo',24,'—','Awareness & training','Periodic awareness program (phishing, devices, social media) and specialized training for technical teams (ECC 1-10).'],
  ['S2.T1','S','S2','sec','todo',48,'E01','Identity hardening (MFA/PAM)','MFA for sensitive accounts and remote access, privileged-access management, least privilege and segregation of duties (ECC 2-2); extends E01.'],
  ['S2.T2','S','S2','sec','todo',48,'E02','Cryptography & key management','Encryption by classification at rest/in transit and key-lifecycle management per NCA standards (ECC 2-8); extends E02.'],
  ['S2.T3','S','S2','sec','todo',40,'—','Systems & endpoint protection','Anti-malware, patch management, configuration hardening and clock synchronization (ECC 2-3).'],
  ['S2.T4','S','S2','sec','todo',32,'E06','Email protection','Phishing/spam filtering, SPF/DKIM/DMARC and APT protection (ECC 2-4).'],
  ['S2.T5','S','S2','sec','todo',56,'—','Network security (Firewall/IPS/DDoS)','Segmentation and defense-in-depth, firewalls, IPS, DDoS protection, DNS security and production isolation (ECC 2-5).'],
  ['S2.T6','S','S2','sec','todo',24,'—','Mobile & BYOD security','Separate entity data on personal devices and remote-wipe on loss or end of relationship (ECC 2-6).'],
  ['S2.T7','S','S2','sec','todo',32,'E02','Data protection by classification','Data classification and DLP/masking controls by sensitivity level (ECC 2-7); extends E02.'],
  ['S2.T8','S','S2','sec','todo',24,'—','Backup & restore testing','Backup coverage of sensitive assets, fast recovery and periodic restore testing (ECC 2-9).'],
  ['S2.T9','S','S2','sec','todo',40,'—','Vulnerability management','Periodic scanning, classification, remediation, pre-production verification and advisory subscriptions (ECC 2-10).'],
  ['S2.T10','S','S2','sec','todo',40,'—','Penetration testing','Periodic penetration testing of external services, websites, web/mobile apps and remote access (ECC 2-11).'],
  ['S2.T11','S','S2','sec','todo',56,'E04','Event logs & monitoring (SIEM)','Event-log collection and continuous monitoring via SIEM, retained ≥12 months (ECC 2-12); builds on E04.'],
  ['S2.T12','S','S2','sec','todo',48,'—','Incident management (IR)','Response plans, incident classification, reporting to the authority and threat intelligence (ECC 2-13).'],
  ['S2.T13','S','S2','sec','todo',16,'E21','Physical security','Access control and CCTV for sensitive areas — largely via the hosting provider (ECC 2-14).'],
  ['S2.T14','S','S2','sec','todo',40,'—','Web application protection (WAF)','Web application firewall, multi-tier architecture, HTTPS and a secure session policy (ECC 2-15).'],
  ['S2.T15','S','S2','sec','todo',48,'—','Secure SDLC','Secure coding standards, trusted libraries, security testing and configuration hardening before release (ECC 1-6).'],
  ['S3.T1','S','S3','sec','todo',40,'—','Resilience in BCM','Embed cybersecurity in business continuity: RTO/RPO objectives, recovery plan and testing (ECC 3-1).'],
  ['S4.T1','S','S4','sec','todo',32,'—','Third-party security','Contractual requirements and cyber assessment of suppliers/third parties before and during engagement (ECC 4-1).'],
  ['S4.T2','S','S4','sec','todo',40,'E02','Cloud & hosting security','In-Kingdom data residency, shared-responsibility model and cloud-configuration hardening (ECC 4-2); extends E02.'],

  // Track X
  ['X.QA1','X','X','qa','todo',80,'—','Automated test framework','Automated test framework (unit + e2e) across modules covering transitions, permissions and audit.'],
  ['X.OPS1','X','X','ops','todo',64,'—','CI/CD & environments','CI/CD pipelines, runtime environments (staging/production) and monitoring.'],
  ['X.OPS2','X','X','ops','todo',48,'—','Backup & disaster recovery','Backup, disaster recovery, monitoring and alerting.'],
  ['X.UX1','X','X','ux','todo',80,'—','Design system & i18n','Design system, RTL components and translation files (Arabic/English) for all modules.'],
  ['X.PM1','X','X','pm','todo',120,'—','Project management & workshops','Project management, decision workshops, requirements documentation and traceability throughout delivery.'],
  ['X.DOC1','X','X','pm','todo',48,'—','Architecture docs & training','Architecture documentation, user guides and training.'],
];

const tasks = T.map(([id, track, epic, cat, status, hrs, deps, title, desc]) =>
  ({ id, track, epic, cat, status, hrs: Math.round(hrs * SCALE), deps, title, desc }));

const sum = (arr) => arr.reduce((a, t) => a + t.hrs, 0);
const totalHrs = sum(tasks);
const byCat = Object.keys(CAT).map((k) => ({ k, hrs: sum(tasks.filter((t) => t.cat === k)), n: tasks.filter((t) => t.cat === k).length })).filter((r) => r.n);
const byTrack = TRACKS.map((tr) => ({ tr, hrs: sum(tasks.filter((t) => t.track === tr.key)), n: tasks.filter((t) => t.track === tr.key).length }));
const byStatus = Object.keys(ST).map((k) => ({ k, hrs: sum(tasks.filter((t) => t.status === k)), n: tasks.filter((t) => t.status === k).length }));
const epicHrs = (e) => sum(tasks.filter((t) => t.epic === e));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (h) => Math.round((h / totalHrs) * 100);

const CATCOLOR = { be:'#337349', fe:'#2f6f93', int:'#7a5aa6', ai:'#b1497e', ops:'#5b6b78', qa:'#9a7a18', ux:'#b06a3e', pm:'#3c8c79', sec:'#1f3f63' };
const TRKCOLOR = { A:'#337349', B:'#2f6f93', C:'#b1497e', D:'#9a7a18', E:'#3c8c79', S:'#1f3f63', X:'#5b6b78' };
function donut(data, total) {
  const r = 40, cc = 50, C = 2 * Math.PI * r, sw = 18;
  let acc = 0;
  const segs = data.map((d) => {
    const seg = (d.value / total) * C;
    const el = `<circle cx="${cc}" cy="${cc}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${sw}" stroke-dasharray="${seg.toFixed(2)} ${(C - seg).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 ${cc} ${cc})"/>`;
    acc += seg; return el;
  }).join('');
  return `<svg viewBox="0 0 100 100" width="42mm" height="42mm" style="flex:0 0 auto">${segs}<text x="50" y="49" text-anchor="middle" font-size="15" font-weight="700" fill="#234f33" font-family="Tajawal,Arial">${total}</text><text x="50" y="62" text-anchor="middle" font-size="6" fill="#647079" font-family="Tajawal,Arial">hrs</text></svg>`;
}
function bars(data) {
  const max = Math.max(...data.map((d) => d.value)) || 1;
  return `<div class="bars">${data.map((d) => `<div class="bar"><span class="bl">${esc(d.label)}</span><span class="bt"><span class="bf" style="width:${(d.value / max * 100).toFixed(1)}%;background:${d.color}"></span></span><span class="bv">${d.value}</span></div>`).join('')}</div>`;
}
const catData = byCat.map((r) => ({ label: CAT[r.k].ar, value: r.hrs, color: CATCOLOR[r.k], pc: pct(r.hrs) }));
const trkData = byTrack.map((r) => ({ label: r.tr.name.replace('Track ', '').replace('Cross-cutting (QA, Ops, Design, PM)', 'Cross-cutting'), value: r.hrs, color: TRKCOLOR[r.tr.key] }));
const chips = `${Object.values(CAT).map((c) => `<span class="cat ${c.cls}">${c.ar}</span>`).join(' ')} ${Object.values(ST).map((s) => `<span class="st ${s.cls}">${s.ar}</span>`).join(' ')}`;

const summaryPage = `
<section class="page">
  <div class="head"><h2>Appendix A — Detailed Task Register</h2><p>Every task with its category, description, dependencies, status and estimated hours</p></div>
  <p class="lead">This appendix breaks down the work required to deliver the platform at task level. Hours are indicative engineering estimates, refined in the kickoff workshop.</p>
  <div class="kpi">
    <div class="k"><b>${tasks.length}</b><span>Total tasks</span></div>
    <div class="k"><b>${totalHrs.toLocaleString('en')}</b><span>Total estimated hours</span></div>
    <div class="k"><b>~${Math.round(totalHrs / HOURS_PER_MONTH)}</b><span>person-months</span></div>
  </div>
  <div class="chartcard"><div class="ct">Effort by category (hours)</div>
    <div class="chrow">${donut(catData, totalHrs)}
      <div class="legend">${catData.map((d) => `<div class="li"><span class="sw" style="background:${d.color}"></span><span>${d.label}</span><span class="vv">${d.value} · ${d.pc}%</span></div>`).join('')}</div>
    </div>
  </div>
  <div class="chartcard"><div class="ct">Effort by track (hours)</div>${bars(trkData)}</div>
  <div class="chrow" style="gap:6mm;align-items:stretch">
    <table style="flex:1;min-width:60mm"><thead><tr><th>Status</th><th class="c">Tasks</th><th class="c">Hours</th></tr></thead>
      <tbody>${byStatus.map((r) => `<tr><td><span class="st ${ST[r.k].cls}">${ST[r.k].ar}</span></td><td class="c">${r.n}</td><td class="hrs">${r.hrs}</td></tr>`).join('')}</tbody></table>
    <div class="box" style="flex:1;margin:0"><b>Legend:</b><br>${chips}</div>
  </div>
</section>`;

function trackPage(tr) {
  const list = tasks.filter((t) => t.track === tr.key);
  if (!list.length) return '';
  let rows = '';
  let curEpic = null;
  for (const t of list) {
    if (t.epic !== curEpic) {
      curEpic = t.epic;
      rows += `<tr class="epicrow"><td colspan="7">${esc(EPIC[curEpic])} — ${epicHrs(curEpic)} hrs total</td></tr>`;
    }
    rows += `<tr>
      <td class="idc">${t.id}</td>
      <td><b>${esc(t.title)}</b></td>
      <td><span class="cat ${CAT[t.cat].cls}">${CAT[t.cat].ar}</span></td>
      <td>${esc(t.desc)}</td>
      <td class="idc">${t.deps === '—' ? '—' : esc(t.deps)}</td>
      <td><span class="st ${ST[t.status].cls}">${ST[t.status].ar}</span></td>
      <td class="hrs">${t.hrs}</td>
    </tr>`;
  }
  return `
<section class="page">
  <div class="head"><h2>Task Register — ${esc(tr.name)}</h2><p>Track total: ${sum(list)} hrs · ${list.length} tasks</p></div>
  <table class="tasktbl">
    <colgroup><col style="width:8%"><col style="width:16%"><col style="width:13%"><col style="width:35%"><col style="width:9%"><col style="width:9%"><col style="width:10%"></colgroup>
    <thead><tr><th>ID</th><th>Task</th><th>Category</th><th>Detailed description</th><th>Depends on</th><th>Status</th><th>Hours</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

const APPENDIX_STYLE = `<style>
.cat{font-size:7.4pt;font-weight:700;padding:1px 5px;border:1px solid;border-radius:2px;white-space:nowrap;display:inline-block;line-height:1.3}
.tasktbl td .cat{white-space:normal}
.cat.be{color:#0a5b4e;background:#e3f1ee;border-color:#bfe0d8}
.cat.fe{color:#274690;background:#e8edf9;border-color:#c5d2f0}
.cat.int{color:#6b3fa0;background:#efe8f8;border-color:#d9c9ef}
.cat.ai{color:#9a2f6f;background:#fbe9f3;border-color:#f0c8df}
.cat.ops{color:#46505a;background:#eef1f3;border-color:#d3dadf}
.cat.qa{color:#8a6200;background:#fff6df;border-color:#ecd9a5}
.cat.ux{color:#9a3b2f;background:#fbeae6;border-color:#f0cabf}
.cat.pm{color:#3a4750;background:#eef1f3;border-color:#d3dadf}
.cat.sec{color:#143a5e;background:#e7eef6;border-color:#c2d3e8}
.st{font-size:7.4pt;font-weight:700;padding:1px 6px;border-radius:2px;white-space:nowrap}
.st.todo{color:#46505a;background:#eef1f3;border:1px solid #d3dadf}
.st.wip{color:#8a6200;background:#fff6df;border:1px solid #ecd9a5}
.st.done{color:#0a5b32;background:#e7f4ec;border:1px solid #bfe2cd}
.tasktbl{font-size:8.5pt;table-layout:fixed}
.tasktbl th,.tasktbl td{padding:5px 6px;line-height:1.4;word-wrap:break-word;overflow-wrap:anywhere}
.idc{font-size:8.1pt;white-space:nowrap;font-weight:700;color:#084b40}
.hrs{font-weight:700;color:#084b40;text-align:center;white-space:nowrap}
.epicrow td{background:#eef4f2;font-weight:700;color:#084b40}
.kpi{display:flex;gap:6mm;flex-wrap:wrap;margin:.4em 0 .8em}
.kpi .k{flex:1;min-width:42mm;border:1px solid var(--line);border-radius:2px;padding:7px 11px;background:var(--soft)}
.kpi .k b{display:block;color:var(--green);font-size:18pt;line-height:1.1}
.kpi .k span{color:var(--muted);font-size:8.4pt}
</style>`;

const appendix = `<!--TASKS:START-->\n${APPENDIX_STYLE}\n${summaryPage}\n${TRACKS.map(trackPage).join('\n')}\n<!--TASKS:END-->`;

let html = fs.readFileSync(HTML, 'utf8');
html = html.replace(/<!--TASKS:START-->[\s\S]*?<!--TASKS:END-->\s*/g, '');
html = html.replace('</body>', `${appendix}\n</body>`);
fs.writeFileSync(HTML, html);
console.log(`EN: injected ${tasks.length} tasks · ${totalHrs} hrs (~${Math.round(totalHrs / HOURS_PER_MONTH)} person-months)`);
