# Tanfeeth — Product & Domain Documentation / توثيق المنتج والمجال

This folder is the **single source of truth for what Tanfeeth is and what it must
do** — the product vision, personas, the government competition/procurement
lifecycle, scenarios, user stories, business rules, modules, the AI layer,
integrations, and the binding rules every contributor must follow.

It is derived directly from:
- **`Tanfeeth_FRD.docx`** — the Functional Requirements Document (bilingual).
- **`Tanfeeth Flow & Functions.xlsx`** — the source workbook (Project Journey,
  Other Project Cases, Other Required Features, AI Upgrade).
- The **Etimad “Executive Dashboard for Competitions”** reference screens.

## Contents

| File | Language | Purpose |
|---|---|---|
| [`PRODUCT.en.md`](./PRODUCT.en.md) | English | Full product & domain spec: vision, personas, roles, the 10‑stage lifecycle with **scenarios + user stories + options**, exceptional paths, modules, AI, integrations, NFRs, glossary. |
| [`PRODUCT.ar.md`](./PRODUCT.ar.md) | العربية | النسخة العربية الكاملة (المرجع الأساسي للفريق): الرؤية، الشخصيات، الأدوار، دورة الحياة بسيناريوهاتها وقصص المستخدمين والخيارات، المسارات الاستثنائية، الوحدات، الذكاء الاصطناعي، التكاملات. |
| [`RULES.md`](./RULES.md) | Bilingual | **Binding product, domain, and engineering rules** (R‑01 … R‑16). Referenced from the root `CLAUDE.md`. Read before building any feature. |
| [`BACKLOG.md`](./BACKLOG.md) | English | **Delivery view** of the product: epics → stories → tasks → subtasks, dependencies, the contract‑execution action set, the delay→withdrawal→completion scenario, phasing, and a dependency graph. Traces every item to `FR-*` and `R-*`. Not a domain source of truth — defers to `PRODUCT`/`RULES`. |
| [`DEPARTMENTS-COMMITTEES-PLAN.md`](./DEPARTMENTS-COMMITTEES-PLAN.md) | العربية | **خطة تنفيذ الإدارات واللجان** — الوضع الحالي بالأدلة، النموذج المقترح (إدارات/عتبات/لجان/محاضر/سرية)، ٣٧ قرارًا مطلوبًا من المختصين، وست مراحل تنفيذ بمعايير قبول. مسودة بانتظار القرارات. |

## What is Tanfeeth, in one paragraph

**Tanfeeth (تنفيذ)** is an Arabic‑first SaaS platform that runs a Saudi government
entity’s **full competition & procurement lifecycle — from order creation to
contract closeout (Order‑to‑Contract‑to‑Closeout)** — on top of a configurable
**workflow + business‑rules engine**, with **role‑based access control** across
~13 stakeholder roles, an **AI layer governed by mandatory human‑in‑the‑loop
(HITL)**, persona dashboards (end user, contracts/procurement department, higher
management, external contractor), and deep integration with the national
platforms **Etimad, Nafath, the Ministry of Finance, and GOSI**. It is aligned
with **Vision 2030**, local‑content/localization targets, and Saudi data‑residency
and security requirements.

> Naming note: in the codebase the user/contract modules already exist; this
> documentation is the **domain map** those modules and all future modules
> (competitions, committees, workflow engine, AI, dashboards) must conform to.
