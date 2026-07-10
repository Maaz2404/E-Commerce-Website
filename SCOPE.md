Plan: Author SCOPE.md for the LangGraph Customer-Support Chatbot
Context
The company wants a production-ready customer-support chatbot added to the existing e-commerce site (Flask + raw psycopg2 + Neon Postgres backend, Next.js 16 frontend, JWT auth). The bot must cover 30 user stories across ~14 functional agents, be built on LangGraph, wrap a user-provided knowledge base as a RAG tool, expose all backend tools through an MCP server/client, include HITL where actions are sensitive, and implement three-layer memory (rolling summary, Mem0 every N turns, a chats table).

Exploration findings that anchor the scope:

~15 of the 30 stories are already servable by existing APIs (orders history/detail/refund, products/search, cart, wallet payments/checkout, coupons list, reviews, flat support_messages log).
~15 stories have no backend support: returns, exchanges, shipment tracking, shipping estimates, loyalty points, structured tickets, invoices, recommendations, profile/address/password-reset, user-facing order cancel, standalone coupon validation.
Frontend already has a human-support chat widget in frontend/app/page.tsx — natural host surface for the bot.
No AI/websocket/MCP code exists anywhere in the repo.
User decisions (confirmed):

Build the missing backend APIs in scope — all 30 stories end-to-end functional.
Gemini is the LLM provider (via langchain-google-genai; gemini-2.5-flash default worker model, gemini-2.5-pro reserved for complex reasoning; gemini-embedding-001 for RAG embeddings).
Chatbot lives inside the existing Flask app as a new blueprint (no separate service).
Deliverable
One file: /Users/aaple/Documents/e-commerce-website/SCOPE.md (root of the repo, per user request). No code changes.

SCOPE.md structure and content
1. Overview & Goals
Problem statement, target outcome (30 user stories automated with human escalation), success criteria (containment rate, CSAT, latency targets), explicit non-goals (voice, multilingual v1, admin-side bot).

2. In-Scope User Stories
The 30-story table from the user's brief, each mapped to: owning agent, tools required, backend status (exists / new API needed), and HITL flag. Consolidate the 14 named agents into ~9 LangGraph worker agents to keep the graph maintainable, while preserving the user's naming in the mapping:

Order Agent (track, package location, cancel, modify) — stories 1–4
Returns & Refunds Agent (returns, exchanges, refund status) — 5, 6, 7
Payment & Billing Agent (payment failed, double charge, invoices) — 10, 11, 25
Product Agent (availability, specs, compare, recommendations) — 14–17
Shipping Agent (charges, delivery estimates) — 18, 19
Account & Loyalty Agent (address, password reset, profile, order history, loyalty points) — 20–24
Promotion Agent (apply coupon, coupon validity) — 12, 13
Support & Escalation Agent (damaged/missing items w/ image upload, complaints, human handoff) — 8, 9, 26, 27
FAQ / General Agent (RAG-backed FAQ, greetings/small talk, personalization) — 28, 29, 30
3. Architecture
Placement: new Flask blueprint routes/chat.py (prefix /chat) in the existing backend; SSE streaming via Flask generator responses. A dedicated asyncio event loop (or asyncio.run per request) bridges Flask's sync WSGI to LangGraph/MCP async APIs — call out this constraint and the mitigation (run under gunicorn with threads/gevent; note honestly that a separate ASGI service is the standard evolution path if streaming concurrency becomes a bottleneck).
Graph topology: supervisor/router pattern — a Gemini-flash router node classifies intent → routes to worker agent subgraphs (each a ReAct agent with its scoped toolset) → shared response/summarization nodes. State schema: messages, rolling_summary, user_id, jwt, active_agent, hitl_pending, turn_count.
Diagram: mermaid diagram of the graph (router, 9 agents, HITL interrupt points, memory nodes, escalation path).
4. Tooling via MCP
New FastMCP server (backend/mcp_server/) exposing every backend capability as a typed tool (one tool module per domain: orders, returns, payments, products, shipping, account, loyalty, coupons, tickets, rag). Tools call the Flask REST endpoints (or shared service functions) carrying the end-user's JWT — the bot can only act in user scope, never with admin privileges.
Chat blueprint is the MCP client via langchain-mcp-adapters (streamable-HTTP transport; server runs as a sidecar process).
Full tool inventory table: tool name → MCP module → underlying endpoint → new/existing.
5. RAG Knowledge-Base Tool
Ingestion pipeline: user-provided KB (FAQ, shipping/returns/warranty policies) → chunk → embed with gemini-embedding-001 → pgvector on the existing Neon Postgres (new kb_documents table + ivfflat index). No new infra; FAISS fallback noted.
Exposed as search_knowledge_base MCP tool used primarily by the FAQ agent but callable by all agents.
Refresh script (ingest_kb.py) analogous to the offline pipelines the team already runs.
6. Memory (three layers)
Layer 1 — In-conversation: LangGraph PostgresSaver checkpointer on the existing Neon DB; raw message window kept short.
Layer 2 — Rolling summary: after every N turns (default N=6, configurable), a summarizer node folds older messages into rolling_summary in graph state and trims the window (summarize-then-trim).
Layer 3 — Long-term:
Mem0 extraction job every N turns — durable user facts/preferences (sizes, favorite categories, recurring complaints), namespaced by user_id, retrieved at session start and injected into the system prompt (also powers the Personalization stories 17/29).
chats + chat_messages tables (new migration): full transcript persistence — chat sessions (id, user_id, started_at, status, escalated), messages (role, content, agent, tool_calls JSONB, created_at). Source of truth for audit, analytics, and the human-agent handoff view.
7. HITL (Human-in-the-Loop)
Two distinct HITL kinds, both via LangGraph interrupt() + checkpointer resume:

User confirmation before irreversible/financial actions: cancel order, modify order, initiate return/exchange, refund request, address change, coupon application at checkout. Widget renders a confirm/deny card; graph resumes with the decision.
Human-agent escalation: Escalation Agent creates a ticket, flags the chat session escalated, and bridges into the existing support_messages admin flow; bot goes silent on that thread. Triggers: explicit user request (story 26), 2 failed resolution attempts, low router confidence, abusive/sensitive content.
8. New Backend Workstream (to close the gaps)
New tables (via migrations/*.sql) and Flask endpoints, each listed with method/path:

Returns/exchanges: returns table + POST/GET /returns (+ exchange type), status lifecycle.
Shipments/tracking: shipments table (carrier, tracking_number, status, ETA) + GET /orders/<id>/shipment; simulated carrier events for demo.
Shipping rates: /shipping/estimate (zone/weight rules table).
Loyalty: loyalty_points ledger + earn-on-payment hook + GET /loyalty/balance.
Ticketing: tickets table (subject, category, priority, status, image attachments) layered over support_messages + /tickets CRUD; image upload endpoint (story 8).
Invoices: GET /orders/<id>/invoice (JSON + generated PDF).
Account: GET/PUT /users/me, addresses table + CRUD, password change + token-based reset.
Order ops: user-facing POST /orders/<id>/cancel (only pre-shipment), PATCH /orders/<id> modify (only status=pending/paid, pre-shipment).
Coupons: POST /coupons/validate (extracted from utils/place_order.py:validate_coupon).
Recommendations: GET /products/recommendations (heuristic v1: same-category + co-purchase; Mem0-personalized v2).
9. Frontend Integration
Upgrade the existing widget in app/page.tsx (extract into components/ChatWidget.tsx): SSE streaming rendering, HITL confirmation cards, image upload for damaged-item reports, "talk to a human" affordance, session persistence via chat session id.

10. Non-Functional Requirements
Security: bot always operates under the end-user's JWT; prompt-injection hardening (tool allow-list per agent, no admin tools); PII kept out of Mem0 beyond preferences; fix the SECRET_KEY stdout leak in app.py:23 while in there.
Reliability: tool-call timeouts/retries, graceful degradation to escalation on tool failure.
Observability: LangSmith tracing, per-agent token/cost tracking, structured logs.
Performance: first-token < 2s target via gemini-flash routing; rate limiting per user.
Evaluation: golden conversation set per user story (30+), automated eval on router accuracy and tool-call correctness before each release.
Config: new env keys — GOOGLE_API_KEY, MEM0_API_KEY (or self-hosted config), MCP_SERVER_URL; CORS already handled (same origin as backend).
11. Phased Delivery
Phase 0 — foundations: chat blueprint + SSE, MCP server skeleton, chats tables, widget rewiring, General/FAQ agent + RAG tool (KB provided by user).
Phase 1 — read-only agents on existing APIs: Order (track/history), Product, Promotion (validate), Account (history), Payment status.
Phase 2 — gap backend APIs + write actions with HITL: cancel/modify, returns/exchanges, refunds, tickets + images, address/profile.
Phase 3 — memory layers 2/3 (rolling summary, Mem0), personalization + recommendations, loyalty, invoices, shipping estimates.
Phase 4 — hardening: evals, observability, rate limiting, load testing, production deploy. Each phase with acceptance criteria tied to specific user-story numbers.
12. Out of Scope / Risks / Open Questions
Out: voice, multi-language v1, admin-facing bot, real carrier/payment-gateway integrations (wallet + simulated tracking only), mobile SDK.
Risks: Flask sync WSGI vs streaming concurrency (mitigation stated, ASGI escape hatch), Gemini rate limits, Mem0 latency on hot path (mitigate: async/background extraction), prompt-injection via product/review content.
Open questions: N for summary/Mem0 cadence, Mem0 hosted vs self-hosted (pgvector), KB format/delivery date.
Execution steps
Write SCOPE.md at the repo root (/Users/aaple/Documents/e-commerce-website/SCOPE.md) with the sections above, including the 30-story mapping table, tool inventory table, mermaid architecture diagram, new-endpoint list, and phase plan.
No other files touched.
Verification
Re-read SCOPE.md checking every one of the 30 user stories appears exactly once in the mapping table with agent, tools, backend status, and HITL flag.
Confirm all user-mandated elements are present: LangGraph, RAG-as-tool, MCP server/client wrapping of tools, HITL, and the three memory layers (rolling summary, Mem0 every N turns, chats table).
Confirm every referenced existing endpoint/file actually exists in the repo (paths verified during exploration).