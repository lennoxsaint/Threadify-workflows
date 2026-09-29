# Customer setup: one resumable module

Purpose: take a new customer from the public entry to a connected, personalized account and a verified first week. Authentication and purchases remain customer actions.

Flow: public installation file -> canonical stable installer -> setup skill -> private setup state -> existing creator/Vault engines -> account-scoped provider tools -> native agent scheduler.

Decision: use one setup module with start/resume/status/verify, sharing the existing private atomic store. Six adapters supply execution capability evidence. A separate installer per agent was rejected because recovery, identity and readiness rules would drift. Customer facts and receipts never enter release artifacts.

The old customer package's preservation/recovery approach is retained: managed content is never silently replaced; the confirmed summary is versioned and invalidates dependent readiness when changed. No uploaded document, installed folder, saved job or fixture establishes live readiness alone.

Acceptance: isolated customer identity; approved discovery scope; confirmed facts with provenance; processing plus retrieval evidence; reviewed voice; exact seven-day calendar evidence; persisted recurring job plus observed run; pause and unknown-outcome reconciliation; no implied release authority.

Implementation checklist
- [x] Public bootstrap and registry skill
- [x] Private resumable setup, discovery and readiness
- [ ] Scoped ongoing permissions and adapters
- [x] Product entry and Brain processing tools (companion local branch)
- [ ] Functional verification and six-client evidence
- [ ] TCS rehearsal, fresh signup, lesson and visual
