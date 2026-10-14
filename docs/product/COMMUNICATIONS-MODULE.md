# وحدة المراسلات والاستفسارات وطلبات الجهة — Communications & Inquiries Module

> Status: **built (2026-10-14)** — backend on `staging` (tanfeeth-api), frontend-v3
> «مركز المراسلات», extension v0.3.0. Requirement IDs `FR-SP-014…018` (PRODUCT §5.5).
> Binding rules that apply: R-01/02, R-03 (HITL), R-04, R-08, R-09, R-10, R-12, R-14/15, R-19.

## As built — what differs from the draft below

- **Etimad has native inquiry ids.** The real tender page (`/Tender/DetailsForAll`) renders
  every inquiry as a collapse panel `id="<number>"`; the inquiries tab is fetched from
  `/Tender/GetEnquiryViewComponenet?tenderIdStr=<STenderId>` (all inquiries, no paging; 303 on
  the sample tender). So the key is `e:<etimad id>`; the `v1:` fingerprint is the fallback, and a
  row first seen without an id is re-keyed when the id appears. Replies carry a status badge —
  only «معتمد» counts as published on Etimad.
- **Endpoints (Workflow A)**: `POST /competitions/etimad-inquiries/sync`,
  `GET /competitions/etimad-inquiries/match?references=`, `POST /competitions/etimad-inquiries/injected`
  (by Etimad reference, not competition id), `GET /inquiries` (inbox, scoped server-side to the
  caller's department unless they hold `competitions.committee`/`competitions.inquiries.approve`),
  and the existing `POST /competitions/:id/announcement` now takes `publishedAt`, `biddingDays`,
  `openingAt`. Actual dates are written into the tender document (`offerDeliveryDate/Time`,
  `offerReceivingDays`) with the proposal kept under `etimadPublication.proposed`.
- **Sync states**: `awaiting_answer | pending_reply | draft_injected | pending_on_etimad | in_sync | drift`
  (no `missing` state — it is a count in the sync summary).
- **Workflow B** error codes are `COMPETITION_CLARIFICATION.*` / `CORRESPONDENCE.*`; reference
  numbers reuse the official-letter generator (`CLR-<year>-<8 hex>`); tables have no FKs (the
  codebase's sync-mode convention). A subject-reference match from a sender who is not the
  addressed contractor is **held for triage** and changes nothing; bounces mark the recipient
  `bounced`; unmatched mail keeps attachment names only; the outbound Message-ID (which carries the
  thread token) is never returned by the API; reply attachments download via
  `GET /clarifications/:id/attachments/:attachmentId` (as attachment, `nosniff`).
- **Not built yet**: virus scanning of inbound attachments (stored `scan_state = pending`); the
  Etimad reply page (`/Enquiry/SupplierEnquiriesOnTender/<id>`) DOM is unverified, so write-back
  there is heuristic with a per-inquiry «نسخ ردّ تنفيذ» fallback; IMAP needs the entity mailbox
  (`CORRESPONDENCE_IMAP_*`), otherwise replies are linked manually.

The original design follows unchanged for reference.

---

## 0. What already exists (verified in code, 2026-10-14)

| Piece | Where | State |
|---|---|---|
| Inquiry entity + lifecycle `received → assigned → answered → (returned) → approved → published`, SoD approver ≠ answerer, review checklist, late-override reason, addendum link (FR-SP-001/002) | `competitions/domain/competition-inquiry.entity.ts` | built |
| Bulk import `POST /competitions/:id/inquiries/import` | `competition-inquiry.service.ts → importFromPortal` | built, but **dedup only by `portalReference`** — a row without one is always inserted again |
| Opening gate blocks on unanswered / unpublished inquiries | `offer-opening-session.service.ts` | built |
| Addenda, inquiry deadlines (read from the tender document's Etimad mirror) | `competition-addendum.*`, `inquiry-deadlines.ts` | built |
| v3 inquiries panel (per competition), counters, import/record/review dialogs | `frontend-v3/src/features/competitions/components/inquiries/` | built |
| `recordAnnouncement(reference)` — «اعتماد الطرح» | `competition.entity.ts:1336` | records **reference only** |
| Requesting / supervising department on the competition | `requestingDepartmentId`, `supervisingDepartmentId` | built |
| Contractor email on the offer | `offer.contractorEmail` | built |
| Outbound email (SMTP) + in-app notifications | `notifications/` | built (outbound only) |
| Extension on Etimad (fill engine, side panel, auth) | `extension/src/content/*` | **no inquiry read/write** |
| Entity → contractor clarification requests | — | **missing** |
| Inbound email capture | — | **missing** |

So Workflow A is mostly an **extension + dedup + routing** job on top of a working
lifecycle; Workflow B is a **new aggregate** plus an inbound mail adapter.

---

## 1. Architecture

```
                         ┌──────────────────────── Etimad (legacy SSR HTML) ───────────────────────┐
                         │  inquiries list (paged / load-more)        reply textarea per inquiry   │
                         └───────────────▲───────────────────────────────────────▲─────────────────┘
                                         │ scrape (read)                         │ inject draft (write)
                                         │                                       │ officer clicks «إرسال» (HITL)
                         ┌───────────────┴───── extension/content/etimad-inquiries.js ──────────────┐
                         │  collect all pages → raw rows (no hashing here, no tokens in content)    │
                         └───────────────┬──────────────────────────────────────────────────────────┘
                                         │ TNF_INQUIRY_SYNC → background.js (holds the token)
                                         ▼
 ┌────────────────────────────── tanfeeth-api (competitions module) ────────────────────────────────┐
 │ POST /competitions/:id/inquiries/etimad-sync                                                     │
 │   EtimadInquirySyncUseCase                                                                       │
 │     1. fingerprint rows (domain/inquiry-fingerprint.ts, versioned)                               │
 │     2. upsert: new → record + auto-route to department; known → refreshFromPortal               │
 │     3. reply plan: rows whose approved answer is not yet on Etimad → {domIndex, answer}         │
 │     4. rows whose Etimad answer == approved answer → publish(channel: etimad)                   │
 │                                                                                                  │
 │ ClarificationRequest aggregate (new) ── ClarificationMailer port ── SMTP adapter (notifications) │
 │                                    └─ InboundMailbox port ── IMAP poller (KSA-hosted mailbox)    │
 └──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                       frontend-v3: /portal/communications  (مركز المراسلات)
```

Design decisions:

1. **The server computes fingerprints, not the extension.** The extension sends raw
   rows; the API returns, per DOM index, the fingerprint, the inquiry id, and what to
   write. One versioned algorithm, testable with Jest, and no second copy in JS to drift.
   A broken extension can't corrupt the dedup key.
2. **Pull and write-back are the same call.** Every sync answers "what's new" and "what
   should I type, and where". The officer opens the Etimad page, presses one button on
   the Tanfeeth bar, and the drafts appear in the reply boxes.
3. **The extension never clicks Etimad's submit button.** It fills the textarea and
   highlights the row. A person submits on the government portal (R-03 spirit, plus no
   automated actions under the officer's Etimad identity). The *next* sync sees the
   answer on Etimad and moves the inquiry to `published`. That makes Etimad the
   source of truth for "published" (R-08).
4. **Inbound email by IMAP polling, not a SaaS webhook.** SendGrid/Mailgun inbound parse
   would route contractor offers' correspondence through non-KSA infrastructure (R-10).
   The entity's own Exchange/IMAP mailbox (or a KSA-hosted one) is polled by a worker.
   A webhook adapter can be added behind the same port if the entity's mail gateway
   supports it.

---

## 2. Data model (PostgreSQL / TypeORM migrations)

### 2.1 Publishing actuals — on `competitions` (FR-SP-014)

```sql
ALTER TABLE competitions
  ADD COLUMN etimad_published_at        timestamptz NULL,  -- when it went live on Etimad
  ADD COLUMN actual_bidding_days        integer     NULL CHECK (actual_bidding_days BETWEEN 1 AND 365),
  ADD COLUMN actual_offers_deadline_at  timestamptz NULL,  -- آخر موعد لتقديم العروض الفعلي
  ADD COLUMN actual_opening_at          timestamptz NULL;  -- تاريخ فتح العروض الفعلي
-- announcement_reference already exists (= الرقم المرجعي في اعتماد)
```

`recordAnnouncement(reference, actor, facts)` becomes
`recordAnnouncement({ reference, biddingDays, openingAt, publishedAt }, actor, facts)`:
- `reference` required, Etimad format (12 digits — existing validator in `competition.entity.ts:629`).
- `openingAt > publishedAt + biddingDays` is checked (opening can't come before the window closes).
- The **proposed** dates in the tender document stay as they were (history); the
  timeline, inquiry deadlines and the «استلام العروض» countdown read
  `actual_* ?? tender document`. One resolver: `resolveOffersDeadline(competition)`.
- Emits `competition.published_on_etimad` → notification to the requesting and
  supervising departments' managers (+ deputies) via the existing notification catalog.

### 2.2 Inquiries — extend `competition_inquiries` (FR-SP-015/016)

```sql
ALTER TABLE competition_inquiries
  ADD COLUMN portal_fingerprint      varchar(40)  NULL,  -- 'v1:' + 32 hex, or 'e:' + native id
  ADD COLUMN fingerprint_version     smallint     NULL,
  ADD COLUMN duplicate_of_id         uuid         NULL REFERENCES competition_inquiries(id),
  ADD COLUMN assignee_department_id  uuid         NULL,  -- auto-routed department
  ADD COLUMN etimad_answer_text      text         NULL,  -- what Etimad currently shows
  ADD COLUMN etimad_last_seen_at     timestamptz  NULL,
  ADD COLUMN etimad_sync_state       varchar(24)  NULL;  -- see below

CREATE UNIQUE INDEX uq_inquiry_fingerprint
  ON competition_inquiries (competition_id, portal_fingerprint)
  WHERE portal_fingerprint IS NOT NULL;
CREATE INDEX ix_inquiry_department_status
  ON competition_inquiries (assignee_department_id, status);
```

`etimad_sync_state`:

| value | meaning |
|---|---|
| `pending_reply` | approved in Tanfeeth, not yet seen on Etimad |
| `draft_injected` | the extension filled the reply box (officer hasn't submitted yet) |
| `in_sync` | Etimad shows the approved answer → `published` |
| `drift` | Etimad shows an answer that differs from the approved one (someone answered directly on Etimad, or edited) → shown in red, needs a decision |
| `missing` | was seen before, absent from the last **complete** scrape |

`portalReference` stays: when Etimad exposes a real number it wins (`e:` fingerprint).
`duplicate_of_id` links an inquiry whose normalized text equals an earlier one in the same
competition. Each one keeps its own row (each has its own reply box on Etimad), but the
department answers **once**, and approving the original copies the answer to its twins.

### 2.3 Entity clarification requests — new tables (FR-SP-017/018)

```sql
CREATE TABLE clarification_requests (
  id                 uuid PRIMARY KEY,
  competition_id     uuid NOT NULL,
  reference_number   varchar(32) UNIQUE NULL,  -- R-09, assigned at approval: CLR-1448-000123
  type               varchar(32) NOT NULL,     -- technical_clarification | abnormally_low_justification
                                               -- | repricing | workshop | site_visit | other
  other_description  text NULL,                -- required when type = other
  subject            varchar(200) NOT NULL,
  reply_deadline_at  timestamptz NOT NULL,
  status             varchar(24) NOT NULL,     -- draft | submitted | returned | approved | sent
                                               -- | partially_replied | replied | overdue | closed | cancelled
  raised_by_user_id  uuid NOT NULL,            -- technical committee member
  approved_by_user_id uuid NULL,               -- examination committee (≠ raiser, SoD)
  approved_at        timestamptz NULL,
  return_reason      text NULL,                -- ≥ 10 chars, platform rule
  history            jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);

CREATE TABLE clarification_points (           -- the numbered points in the letter
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES clarification_requests(id) ON DELETE CASCADE,
  ordinal smallint NOT NULL,
  text text NOT NULL,
  document_reference varchar(200) NULL,        -- page/section of the offer that raised it
  raised_by_user_id uuid NOT NULL
);

CREATE TABLE clarification_recipients (       -- one per targeted offer
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES clarification_requests(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL,
  contractor_name varchar(300) NOT NULL,       -- copied at send time
  email varchar(320) NOT NULL,                 -- copied from offer.contractor_email at send time
  thread_token char(26) NOT NULL UNIQUE,       -- ULID; in Reply-To and Message-ID
  outbound_message_id varchar(250) NULL,
  sent_at timestamptz NULL,
  delivery_state varchar(16) NOT NULL,         -- queued | sent | bounced | failed
  replied_at timestamptz NULL,
  UNIQUE (request_id, offer_id)
);

CREATE TABLE correspondence_messages (        -- inbound + outbound mail, append-only
  id uuid PRIMARY KEY,
  recipient_id uuid NULL REFERENCES clarification_recipients(id),  -- NULL = unmatched (triage)
  direction varchar(8) NOT NULL,               -- outbound | inbound
  message_id varchar(250) NOT NULL UNIQUE,     -- RFC 5322 Message-ID → idempotent ingest
  in_reply_to varchar(250) NULL,
  from_address varchar(320) NOT NULL,
  sender_matches boolean NULL,                 -- from_address == recipient.email
  subject varchar(500) NOT NULL,
  body_text text NOT NULL,                     -- quoted history stripped
  body_html_file_id uuid NULL,                 -- raw kept in storage, never rendered unsanitized
  received_at timestamptz NOT NULL,
  match_method varchar(16) NULL                -- token | in_reply_to | reference | manual
);

CREATE TABLE correspondence_attachments (
  id uuid PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES correspondence_messages(id),
  file_id uuid NOT NULL,                       -- storage module
  filename varchar(255) NOT NULL, mime varchar(120) NOT NULL, size_bytes integer NOT NULL,
  scan_state varchar(12) NOT NULL DEFAULT 'pending'  -- pending | clean | rejected
);
```

**Etimad-only actions are not clarification types.** Price reduction (طلب تخفيض العرض
المالي) and bid validity extension (طلب تمديد العروض) happen on Etimad. Tanfeeth already
records them (negotiation FR-SP-005, bid validity FR-SP-003). The type dropdown leaves them
out and links there, so nobody emails what the regulation says must go through the portal.

**Abnormally-low justification** respects the sealed estimate
([estimated-value-sealed]): the "> 25% below" flag is computed **server-side** and
appears only after `financial_opening`, and only to `competitions.committee`. The letter
never states the estimated value. It says the offer is "منخفض انخفاضًا ملحوظًا عن
التكلفة التقديرية".

---

## 3. Fingerprint (Virtual ID) algorithm — `domain/inquiry-fingerprint.ts`

Etimad rows have no reliable DOM id. Each row has: question text, asked-at
(date and sometimes time), sometimes the bidder's name, and sometimes an answer. The
extension sends **every** row of the list in display order, after exhausting
pagination/«عرض المزيد».

```ts
// backend/src/modules/competitions/domain/inquiry-fingerprint.ts
import { createHash } from 'node:crypto';

export const FINGERPRINT_VERSION = 1;

export interface RawEtimadInquiryRow {
  domIndex: number;              // position in the fully-loaded list, as displayed
  nativeId: string | null;       // any id the extension could find (href ?id=, data-*, hidden input)
  question: string;
  askedAtText: string | null;    // as shown, e.g. "1448/04/12 10:35 ص" or "2026-10-01"
  askedBy: string | null;
  answer: string | null;
}

const SEP = '␟'; // ␟ — never typed in Arabic text

/** One form for the same text: what Etimad re-renders must hash the same. */
export function normalizeInquiryText(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[ً-ٰٟۖ-ۭ]/g, '') // harakat, Quranic marks
    .replace(/ـ/g, '')                            // tatweel
    .replace(/[آأإٱ]/g, 'ا')  // آ أ إ ٱ → ا
    .replace(/ى/g, 'ي')                      // ى → ي
    .replace(/ة/g, 'ه')                      // ة → ه
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[​-‏‪-‮⁦-⁩ ]/g, ' ') // bidi/zero-width/nbsp
    .replace(/[\s،,.;:!?؟«»"'()\[\]-]+/g, ' ')    // punctuation is not identity
    .trim()
    .toLowerCase();
}

/**
 * Asked-at at the precision Etimad actually shows (minute, or day).
 * Reuses etimad-date.ts (Hijri/Gregorian, ص/م) → ISO in Asia/Riyadh.
 */
declare function canonicalAskedAt(text: string | null): string; // '' when unreadable

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 32);

export interface FingerprintedRow extends RawEtimadInquiryRow {
  fingerprint: string;
  textKey: string;   // sha of normalized question alone → duplicate detection
}

export function fingerprintRows(
  competitionKey: string,               // announcement_reference ?? competition id
  rows: readonly RawEtimadInquiryRow[],
): FingerprintedRow[] {
  // Stable order: oldest first, display order breaks ties. Etimad may list newest-first;
  // sorting makes the ordinal independent of that.
  const ordered = [...rows].sort((a, b) => {
    const ta = canonicalAskedAt(a.askedAtText), tb = canonicalAskedAt(b.askedAtText);
    return ta === tb ? a.domIndex - b.domIndex : ta < tb ? -1 : 1;
  });

  const seen = new Map<string, number>();
  return ordered.map((row) => {
    if (row.nativeId) {
      return { ...row, fingerprint: `e:${row.nativeId}`.slice(0, 40),
               textKey: sha(normalizeInquiryText(row.question)) };
    }
    const q = normalizeInquiryText(row.question);
    const base = [competitionKey, q, canonicalAskedAt(row.askedAtText),
                  normalizeInquiryText(row.askedBy ?? '')].join(SEP);
    const occurrence = seen.get(base) ?? 0;   // 2nd identical row in the same minute → 1
    seen.set(base, occurrence + 1);
    return { ...row, fingerprint: `v${FINGERPRINT_VERSION}:${sha(base + SEP + occurrence)}`,
             textKey: sha(q) };
  });
}
```

Why each part:

| Case | Result |
|---|---|
| Same inquiry pulled again on day 2 | same text + same asked-at + same bidder → same base → same ordinal → **same fingerprint** → update, not insert |
| The answer appears on Etimad later | answer isn't part of the key → same fingerprint; `etimad_answer_text` updates |
| Two bidders send identical text | different `askedBy` (or different asked-at) → different fingerprints. `textKey` matches → the second gets `duplicate_of_id` |
| Same bidder sends identical text twice in the same minute | ordinal 0 and 1 → two records (Etimad has two reply boxes) → linked as duplicates, answered once |
| Etimad hides bidder names | `askedBy` = '' for everyone; asked-at + ordinal still separates them |
| Etimad re-renders with different spacing, diacritics, ة/ه or Arabic digits | normalization absorbs it |
| Etimad starts exposing a real id | `e:` fingerprint. Existing `v1:` rows are migrated on the first sync where both are known (matched by `v1` recomputation) |

Known limit, stated not hidden: if Etimad **deletes** an inquiry that shares a full base
key with a later one in the same minute, the later one's ordinal shifts. The sync then sees
one "missing" and one "new" with identical text and timestamp. The use case detects that
exact pattern (same base, ordinal moved) and re-keys instead of inserting.

Partial scrapes: the extension reports `complete: boolean` (all pages loaded). Ordinals
and `missing` are only decided on complete scrapes; a partial scrape may insert new rows
only for bases it saw in full.

**Must verify on real Etimad DOM before building the selectors.** The extension has
never been run against the live inquiries page (needs an Etimad login). A saved HTML of
one inquiries page (with and without answers, and with «عرض المزيد») is the first input
needed.

### 3.1 Write-back mapping

The sync response carries the plan, keyed by the **same scrape's** `domIndex`. The
extension never has to match text itself:

```ts
// POST /competitions/:id/inquiries/etimad-sync  → response
{
  "fingerprintVersion": 1,
  "complete": true,
  "summary": { "seen": 312, "created": 18, "updated": 294, "duplicates": 7, "drift": 1 },
  "rows": [
    { "domIndex": 0, "fingerprint": "v1:…", "inquiryId": "…", "state": "in_sync" },
    { "domIndex": 4, "fingerprint": "v1:…", "inquiryId": "…", "state": "pending_reply",
      "write": { "answer": "نفيدكم بأن …", "approvedAt": "2026-10-13T09:12:00Z" } }
  ]
}
```

Extension (`content/etimad-inquiries.js`):
1. Before writing, re-read the row at `domIndex` and check its question text still
   normalizes to the same thing (a cheap client-side `normalizeInquiryText` copy used **only**
   as a guard). If the page changed, re-sync instead of writing into the wrong box.
2. Fill the reply textarea, dispatch `input`/`change` (the same setter path as
   `etimad-fill.js`), and outline the row in the Tanfeeth color with «مسودة من تنفيذ —
   راجِع ثم أرسل».
3. `POST …/etimad-sync/injected { fingerprints[] }` → `draft_injected`.
4. Never click submit. Never overwrite a non-empty textarea the officer typed in.

---

## 4. API (all under `/api`, `@Auth` keys in brackets)

Workflow A — inquiries
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/competitions/:id/announcement` | «اعتماد الطرح» with `{ reference, biddingDays, openingAt, publishedAt }` (extends the existing `award-signing.controller.ts` route + `PublishAnnouncementDto`) `[competitions.committee]` |
| `POST` | `/competitions/:id/inquiries/etimad-sync` | raw rows in → upsert + reply plan out `[competitions.inquiries.sync]` |
| `POST` | `/competitions/:id/inquiries/etimad-sync/injected` | mark drafts injected |
| `GET`  | `/inquiries` | cross-competition inbox: `?competitionId&departmentId&status&syncState&q&page` — department members see only their department's `[competitions.inquiries.answer]` or all `[competitions.committee]` |
| `GET`  | `/inquiries/stats` | KPI cards: total, unanswered, awaiting approval, pending on Etimad, overdue, drift |
| `POST` | `/competitions/:id/inquiries/:inquiryId/answer` | existing; now also allowed for members of `assignee_department_id` |
| `GET`  | `/competitions/:id/inquiries/analytics` | per-category counts, hot document references, duplicates ratio → examination committee board + minute |

Auto-routing rule on import: `assignee_department_id = supervisingDepartmentId ??
requestingDepartmentId`. The department manager gets a notification (one per sync, not
one per inquiry: "١٨ استفسارًا جديدًا على منافسة …"). Re-assignment to a specific person
inside the department uses the existing `assign`.

Workflow B — clarification requests
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/competitions/:id/clarifications` | create draft (type, points, target offers, deadline) `[competitions.clarifications.raise]` |
| `PATCH` | `/clarifications/:id` | edit draft / consolidate points |
| `POST` | `/clarifications/:id/submit` | to examination committee |
| `POST` | `/clarifications/:id/return` | with reason ≥ 10 `[competitions.clarifications.approve]` |
| `POST` | `/clarifications/:id/approve` | assigns reference no., renders letter, queues email per recipient (SoD: approver ≠ raiser) |
| `GET`  | `/clarifications/:id/letter.pdf` | official letter (reports module, Puppeteer) |
| `GET`  | `/clarifications?competitionId&offerId&status` | list |
| `POST` | `/clarifications/:id/close` | after replies reviewed |
| `GET`  | `/correspondence/unmatched` | triage of inbound mail no rule could match `[communications.mailbox.manage]` |
| `POST` | `/correspondence/:messageId/link` | manual link to a recipient |

Inbound mail worker (`infrastructure/adapters/imap-inbound-mailbox.ts`, cron every 2 min):
1. Fetch UNSEEN from the configured folder; `message_id` UNIQUE makes it idempotent.
2. Match, in order: thread token in `To`/`Reply-To` plus-address
   (`tanfeeth+clr-<token>@entity.gov.sa`) → `In-Reply-To`/`References` vs
   `outbound_message_id` → reference number `CLR-…` in subject → else unmatched.
3. `sender_matches = from == recipient.email`. If false, the reply is attached but flagged
   «مرسل غير مطابق». Never trusted silently, because email is spoofable.
4. Strip quoted history; store raw `.eml` in storage; attachments are type/size limited
   (pdf, images, office, zip ≤ 25 MB) and `scan_state` gates download.
5. The recipient becomes `replied`; the request becomes `partially_replied`/`replied`;
   notification to the raiser and the committee secretary; the reply appears on the offer's
   evaluation page.
6. Mail content is **data, not instructions**: if AI summarizes a reply, the summary is a
   suggestion (R-03) and can never trigger a transition.

Env (validated in `config/env.validation.ts`): `CORRESPONDENCE_IMAP_HOST/PORT/USER/PASS/
FOLDER`, `CORRESPONDENCE_REPLY_ADDRESS`. Disabled cleanly when unset (sending still works,
replies are then recorded manually).

New permission keys (seed catalog + matrix): `competitions.inquiries.sync`,
`competitions.inquiries.answer`, `competitions.clarifications.raise`,
`competitions.clarifications.approve`, `communications.read`,
`communications.mailbox.manage`. New error codes are namespaced
`COMPETITIONS.CLARIFICATION_*`, `COMPETITIONS.INQUIRY_SYNC_*`.

---

## 5. Screens (frontend-v3, MUI, RTL, i18n `messages/ar/communications.json`)

**Screen 1 — «اعتماد الطرح»** (dialog on the announcement step)
- Fields: «الرقم المرجعي للمنافسة في اعتماد» (12 digits, validated as typed) ·
  «مدة الطرح الفعلية (بالأيام)» · «تاريخ فتح العروض الفعلي» (date + time, Riyadh).
- Read-only line under them: «التاريخ المقترح عند الإنشاء: …» so the change is visible.
- Live preview: «آخر موعد لتقديم العروض: الخميس ٢٢ ربيع الآخر — بعد ١٨ يومًا».
- On save: toast «نُشرت المنافسة وأُبلغت الإدارة الطالبة», and the receiving-offers
  countdown switches to the actual dates.

**Screen 2 — «مركز المراسلات»** `/portal/communications`
- Two tabs: «استفسارات المتنافسين» · «طلبات الجهة».
- KPI band (one instrument that is also the filter, per [simple-ui-for-nonexperts]):
  «بلا ردّ» · «بانتظار الاعتماد» · «بانتظار النشر في اعتماد» · «متأخرة» (· «اختلاف عن اعتماد»
  only when > 0). Clicking a figure filters the list.
- Filters: project (searchable), department (for committee), status.
- List row: question (two lines), project, asked-at, department chip, status pill, «مكرر»
  badge with a count when it has duplicates. Opens a side panel: question, answer editor,
  legal basis, history, and «نسخة مطابقة» links for duplicates.
- Department users land on their own queue by default; there's no tab they can't use.
- Tab 2 rows: reference no., type, contractor(s), deadline countdown, status
  (أُرسل / ردّ جزئيًا / ردّ / متأخر), with a reply thread view and attachments.

**Screen 3 — «طلب استيضاح» inside the offer evaluation workspace**
- Button on the offer page header and on each document citation in the reader
  («اطلب استيضاحًا عن هذا»), pre-filling the point with the document and page.
- Dialog: type (dropdown, 6 values; «أخرى» reveals a description field), points (add/
  reorder; each point can carry a document reference), reply deadline (defaults to 5
  working days via `work-calendar`), and «أضِف إلى طلب قائم» when a draft for the same
  contractor exists (consolidation).
- The examination committee sees submitted requests in the evaluation board with
  «اعتماد وإرسال» / «إعادة». Approve shows the rendered letter before sending (HITL).

**Extension** — the Tanfeeth bar on an Etimad inquiries page shows
«مزامنة الاستفسارات (٣١٢)» → result chip «١٨ جديد · ٧ ردود جاهزة للكتابة» →
«اكتب الردود الجاهزة».

---

## 6. Official templates (variables in `{{ }}`)

### 6.1 Email/letter — clarification request (all types)

**Subject:** `{{reference_number}} — {{request_type}} بشأن عرضكم في المنافسة رقم {{etimad_reference}}`

> بسم الله الرحمن الرحيم
>
> الرقم: {{reference_number}}  التاريخ: {{date_hijri}} الموافق {{date_gregorian}}
>
> السادة / {{vendor_name}}  المحترمين
>
> السلام عليكم ورحمة الله وبركاته، وبعد:
>
> إشارةً إلى عرضكم المقدَّم في المنافسة «{{project_name}}» ذات الرقم المرجعي
> ({{etimad_reference}}) على بوابة اعتماد، وإلحاقًا بأعمال لجنة فحص العروض، نأمل منكم
> التكرّم بموافاتنا بـ**{{request_type}}** حيال النقاط الآتية:
>
> {{clarification_points}}
> *(كل نقطة مرقّمة، ومعها موضعها في العرض إن وُجد: «المرجع: {{document_reference}}»)*
>
> وذلك في موعد أقصاه **{{deadline_hijri}} الموافق {{deadline_gregorian}} الساعة
> {{deadline_time}}**، بالردّ على هذه الرسالة مباشرةً مع الإبقاء على رقم الإشارة في
> عنوانها.
>
> ونحيطكم علمًا بأن هذا الطلب للاستيضاح فقط، ولا يجوز أن يتضمّن الردّ أيَّ تعديلٍ على
> العرض الفني أو المالي أو على أسعار البنود، ويُعدّ أيُّ تعديلٍ من هذا القبيل كأن لم يكن.
> وعدم الردّ في الموعد المحدد قد يترتب عليه دراسة العرض بحالته.
>
> وتقبّلوا خالص التحية والتقدير،،،
>
> رئيس لجنة فحص العروض
> {{committee_chair_name}}
> {{entity_name}}

### 6.2 Type-specific opening paragraphs (replace the request paragraph)

- **استيضاح فني / كشف غموض:** «… نأمل التكرّم بإيضاح ما ورد في عرضكم الفني حيال النقاط
  الآتية، بما يزيل الغموض عنها دون إضافة أو تعديل على ما قُدِّم: …»
- **مبررات انخفاض العرض:** «… تبيّن للجنة أن قيمة عرضكم المالي منخفضة انخفاضًا ملحوظًا
  عن التكلفة التقديرية للأعمال، وعليه نأمل تزويدنا بالمبررات التفصيلية لهذه الأسعار
  (تحليل التكلفة، ومصادر التوريد، وأسعار البنود الرئيسة) بما يُثبت قدرتكم على تنفيذ
  الأعمال وفق الشروط والمواصفات: …» *(no estimated value in the letter)*
- **طلب إعادة تسعير:** «… نأمل التكرّم بإعادة تسعير البنود الآتية التي تبيّن للجنة
  وجود خطأ أو إغفال في تسعيرها، وفق ما تقضي به أحكام النظام ولائحته: …» *(the article
  cited only when it's in the verified index, R-19)*
- **دعوة لورشة عمل:** «… يسرّنا دعوتكم لحضور ورشة عمل لمناقشة عرضكم الفني، وذلك يوم
  {{event_date}} الساعة {{event_time}} في {{event_location}}، ونأمل تأكيد الحضور وأسماء
  ممثليكم (بحدٍّ أقصى {{max_attendees}}) قبل {{deadline}}.»
- **طلب زيارة موقع:** «… نأمل التكرّم بترتيب زيارة لـ{{site_description}} للاطلاع على
  {{visit_purpose}}، واقتراح موعدين قبل {{deadline}}.»
- **أخرى:** «… نأمل التكرّم بـ{{other_description}} وفق الآتي: …»

### 6.3 Internal notification — published on Etimad

> **نُشرت منافستكم في اعتماد**
> نُشرت المنافسة «{{project_name}}» برقم ({{etimad_reference}}). آخر موعد لتقديم العروض
> {{offers_deadline}}، وفتح العروض {{opening_at}}. ستصلكم استفسارات المتنافسين في «مركز
> المراسلات» للردّ عليها.

### 6.4 Internal notification — new inquiries routed

> **{{count}} استفسارًا جديدًا على «{{project_name}}»**
> أُسندت إلى {{department_name}}. آخر موعد للردّ {{answer_due}}.

---

## 7. Build order (each slice shippable)

1. **Dedup + sync endpoint** (backend): `inquiry-fingerprint.ts` + specs (every row of
   the table in §3), migration, `EtimadInquirySyncUseCase`, auto-routing, duplicates.
   Existing `/import` keeps working (manual paste) and goes through the same fingerprinting.
2. **Extension read/write** against a **saved real Etimad page** first, then live.
3. **«اعتماد الطرح» actuals** + resolver + department notification.
4. **مركز المراسلات** tab 1 (inbox, KPIs, department queue) + analytics on the
   examination committee board and the opening/examination minute.
5. **Clarification requests** aggregate + letter PDF + SMTP send (outbound only).
6. **Inbound IMAP** + unmatched triage + reply on the offer page.

Open questions for the client: (a) a saved HTML of Etimad's inquiries page;
(b) the mailbox to use for clarifications (Exchange/IMAP host, KSA-hosted?);
(c) who signs clarification letters (committee chair vs. procurement director);
(d) the default reply deadline (working days).
