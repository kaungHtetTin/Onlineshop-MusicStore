# LaLaPick — Remaining Development Jobs

A actionable backlog of work still needed to reach MVP and full product-spec coverage.  
Use this alongside [`ROADMAP.md`](./ROADMAP.md) (high-level phases) and [`project_specification.md`](./project_specification.md) (full vision).

**Last updated:** June 9, 2026

---

## Progress snapshot

| Area | Status |
| --- | --- |
| Phases 1–4 (foundation, auth, catalog, orders) | **Done** |
| Phase 2 staff management | **Done** (Super Admin CRUD at `/admin/users`) |
| Admin UI (glass kit) | **Done** for shell + main pages |
| Phase 5 loyalty & coupons | **Not started** (DB tables only) |
| Phase 5 recommendations | **Partial** |
| Phase 6 chat | **Partial** (polling UI; no Echo/Pusher) |
| Phase 7 i18n / storefront dark mode / perf | **Mostly open** |
| Phase 8 deployment | **Not started** |

**Estimated remaining effort:** ~4–6 focused development sprints (depends on scope of analytics, payments, and i18n).

---

## Priority order (recommended)

1. **Phase 5 — Loyalty & coupons** (tables exist; high business value)
2. **Phase 6 — Real-time chat upgrade** (UI exists; wire broadcasting)
3. **Phase 7 — Polish** (i18n, storefront dark mode, performance)
4. **Spec gaps** (review moderation, reports, audit logs)
5. **Phase 8 — Production launch**

---

## Phase 5: Loyalty & smart features

### 5.1 Loyalty points system

**Goal:** Customers earn and redeem points on purchases.

| # | Task | Backend | Frontend | Notes |
| --- | --- | --- | --- | --- |
| 5.1.1 | Create `Coupon` and `RewardHistory` models | `app/Models/` | — | Tables: `coupons`, `reward_histories` |
| 5.1.2 | Points earn on order payment confirm | `OrderPaymentService` or listener | — | Write `reward_histories` row; update `users.loyalty_points` |
| 5.1.3 | Configurable earn rate | `config/loyalty.php` | — | e.g. 1 point per $1 spent |
| 5.1.4 | Redeem points at checkout | `CheckoutController` | `User/Checkout/Index.jsx` | Validate balance; reduce `final_amount` |
| 5.1.5 | Customer points balance UI | API or Inertia prop | Profile + checkout summary | Show current points |
| 5.1.6 | Admin loyalty overview (optional) | `Admin/LoyaltyController` | `Admin/Loyalty/Index.jsx` | Per-customer history |

**DB already has:** `users.loyalty_points`, `users.tier`, `reward_histories`.

---

### 5.2 Tier logic

**Goal:** Auto-upgrade Bronze → Silver → Gold → Platinum.

| # | Task | Details |
| --- | --- | --- |
| 5.2.1 | Define tier thresholds in config | e.g. points or lifetime spend |
| 5.2.2 | `UserTierService` | Recalculate tier after earn/redeem |
| 5.2.3 | Tier badge on profile & checkout | Storefront UI |
| 5.2.4 | Tier-based earn multiplier (optional) | e.g. Gold earns 1.25× |

---

### 5.3 Coupon engine

**Goal:** Admin creates promo codes; customers apply at checkout.

| # | Task | Backend | Frontend |
| --- | --- | --- | --- |
| 5.3.1 | `Coupon` model + validation service | `app/Services/CouponService.php` | — |
| 5.3.2 | Admin coupon CRUD | `Admin/CouponController` | `Admin/Coupons/Index.jsx` |
| 5.3.3 | Apply coupon at checkout | `CheckoutController` | Coupon input + discount line |
| 5.3.4 | Usage limits & expiry | Validation rules | Show error messages |
| 5.3.5 | Increment `used_count` on successful order | Order create hook | — |

**DB already has:** `coupons` (code, type, value, min_order, dates, usage_limit).

---

### 5.4 Recommendations (remaining)

| # | Task | Status | Details |
| --- | --- | --- | --- |
| 5.4.1 | Category “You may also like” | ✅ Done | `ProductController@show` |
| 5.4.2 | Personalized recommendations | ✅ Done | Order-history category affinity |
| 5.4.3 | **Frequently Bought Together** | ❌ Todo | Co-occurrence from `order_items`; block on product detail |
| 5.4.4 | Ranking / analytics feedback | ❌ Todo | Track clicks; optional admin report |

---

### 5.5 Product ratings & reviews

| # | Task | Status | Details |
| --- | --- | --- | --- |
| 5.5.1 | Submit rating + comment | ✅ Done | `POST /products/{slug}/reviews` |
| 5.5.2 | Average rating on product | ✅ Done | Product model / detail page |
| 5.5.3 | **Review moderation (admin)** | ❌ Todo | Approve/reject; `is_approved` already on `reviews` |
| 5.5.4 | Admin reviews list | ❌ Todo | `Admin/Reviews/Index.jsx` |

---

## Phase 6: Real-time communication

**Current state:** Customer + admin chat UIs work with **HTTP polling** (~2.6s). Unread badges work. Image upload works.  
**Missing:** Laravel Echo, Pusher (or compatible broadcaster), true push.

| # | Task | Files / area |
| --- | --- | --- |
| 6.1 | Install & configure `laravel-echo`, `pusher-js` | `package.json`, `resources/js/bootstrap.js` |
| 6.2 | Broadcasting driver (Pusher / Soketi / Redis) | `.env`, `config/broadcasting.php` |
| 6.3 | `MessageSent` event + channel auth | `app/Events/`, `routes/channels.php` |
| 6.4 | Replace polling in admin chat | `Admin/Chats/Show.jsx` |
| 6.5 | Replace polling in customer chat | `User/Chat/Show.jsx` |
| 6.6 | Typing indicator (optional) | Whisper / presence channel |
| 6.7 | Push notification hook (optional) | Browser notification API |
| 6.8 | Update `ROADMAP.md` Phase 6 | Mark partial → complete when Echo live |

**Already done:** `SupportChatService`, `AdminChatController`, `CustomerChatController`, inbox UI, unread counts in `HandleInertiaRequests`.

---

## Phase 7: Localization & refinement

### 7.1 Multi-language (i18n)

| # | Task | Stack |
| --- | --- | --- |
| 7.1.1 | Laravel lang files | `lang/en`, `lang/my`, `lang/ja` |
| 7.1.2 | `react-i18next` on storefront | `resources/js/i18n/` |
| 7.1.3 | Language switcher in navbar | `Components/User/Navbar.jsx` |
| 7.1.4 | Persist locale (cookie / localStorage) | Middleware or Zustand |
| 7.1.5 | Localized currency/date formatting | Utils + checkout labels |

**Languages:** English, Myanmar, Japanese (per spec).

---

### 7.2 Dark mode

| # | Task | Status |
| --- | --- | --- |
| 7.2.1 | Admin light/dark + brand color | ✅ Done (`AdminLayout`, `admin.css`) |
| 7.2.2 | **Storefront dark theme** | ❌ Todo — Romantic Pink AMOLED palette |
| 7.2.3 | Theme toggle on user app | ❌ Todo — `UserTheme` or Zustand |
| 7.2.4 | System preference detection | ❌ Todo — `prefers-color-scheme` |

---

### 7.3 Performance optimization

| # | Task | Status | Details |
| --- | --- | --- | --- |
| 7.3.1 | Chat image compression | ✅ Done | `supportChatCore` |
| 7.3.2 | Product image WebP pipeline | ❌ Todo | Upload + storage conversion |
| 7.3.3 | Catalog API caching | ❌ Todo | Redis/file cache on product lists |
| 7.3.4 | Skeleton loaders (all heavy pages) | ❌ Partial | Chats only; extend to products, orders |
| 7.3.5 | Lazy-load product images | ❌ Todo | `loading="lazy"` + placeholders |

---

### 7.4 UI polish (admin kit follow-ups)

| # | Task | Details |
| --- | --- | --- |
| 7.4.1 | Migrate profile partials to kit `.form-field` | `Profile/Partials/*` when in admin context |
| 7.4.2 | Align `ROADMAP.md` Phase 1 with admin UI kit | Document glass admin vs pink MUI storefront |
| 7.4.3 | Cashier POS view (optional) | Dedicated compact order screen per role |

---

## Phase 8: Deployment & MVP launch

| # | Task | Details |
| --- | --- | --- |
| 8.1 | `.env.example` audit | Document all required keys |
| 8.2 | Security headers | CSP, HSTS, `X-Frame-Options` middleware |
| 8.3 | Production build pipeline | `npm run build`, `php artisan config:cache` |
| 8.4 | Database backup strategy | mysqldump / hosted backup |
| 8.5 | File storage (S3 or local) | Payment proofs + product images |
| 8.6 | Hosting setup | Apache/Nginx, SSL, queue worker |
| 8.7 | UAT checklist | Mobile + desktop flows (see below) |
| 8.8 | Error monitoring | Sentry or log aggregation (optional) |

### UAT checklist (minimum)

- [ ] Guest browse → cart → login → checkout → payment proof upload
- [ ] Admin confirm payment → fulfillment → delivered
- [ ] Admin reject payment → customer sees cancelled state
- [ ] Staff roles: Manager vs Cashier vs Support access boundaries
- [ ] Super Admin staff CRUD at `/admin/users`
- [ ] Customer chat send/receive (admin + user)
- [ ] Product create/edit with variants and images
- [ ] Phone-width responsive (375px) on storefront and admin

---

## Spec gaps (not in ROADMAP phases)

Items from [`project_specification.md`](./project_specification.md) not yet scheduled in ROADMAP:

### Authentication & payments

| # | Feature | Status |
| --- | --- | --- |
| S.1 | Email verification enforced | Partial (Breeze routes exist) |
| S.2 | Social login (Google/Facebook) | ❌ Not started |
| S.3 | Stripe / PayPal / COD payment gateways | ❌ Manual screenshot only today |
| S.4 | Invoice PDF generation | ❌ Not started |

### Admin & operations

| # | Feature | Status |
| --- | --- | --- |
| S.5 | Staff activity / audit logs | ❌ Recommended in `ADMIN_USER_MANAGEMENT_SPEC.md` |
| S.6 | Granular `permissions` JSON per user | ❌ Column exists; no UI |
| S.7 | Analytics dashboard | ❌ Basic stats only on admin dashboard |
| S.8 | Sales / customer / product reports | ❌ Not started |
| S.9 | Customer management (admin view of shoppers) | ❌ Not started |
| S.10 | Welcome email on new staff create | ❌ Optional Phase 2 item |

### Storefront

| # | Feature | Status |
| --- | --- | --- |
| S.11 | Discount pricing on products | ❌ Not started |
| S.12 | Order invoice download (customer) | ❌ Not started |

---

## Quick reference: what exists today

### Admin routes (`routes/admin.php`)

- Dashboard, UI showcase  
- Categories, Products (CRUD)  
- Orders (list, detail, payment, fulfillment)  
- Chats (inbox, conversation)  
- **Users / staff** (Super Admin only)  
- Profile  

### Storefront routes (`routes/web.php`)

- Home, categories, products, cart, wishlist  
- Checkout, orders, profile  
- Product reviews, customer chat  

### Key models

`User`, `Product`, `Sku`, `Category`, `Order`, `OrderItem`, `Review`, `Conversation`, `ConversationMessage`  
**Missing models:** `Coupon`, `RewardHistory`

---

## Suggested sprint breakdown

### Sprint A — Monetization core
- Coupon engine (admin + checkout)
- Loyalty earn on payment confirm
- Points redeem at checkout

### Sprint B — Engagement
- Tier logic
- Frequently Bought Together
- Review moderation admin page

### Sprint C — Real-time & polish
- Echo/Pusher for chat
- Storefront dark mode
- WebP + catalog caching

### Sprint D — Launch
- i18n (EN + MY minimum)
- Production hardening + UAT
- Deploy to hosting

---

## Document maintenance

When completing a job:

1. Check the box or remove the row in this file.  
2. Update [`ROADMAP.md`](./ROADMAP.md) phase status.  
3. Add implementation notes to the relevant spec (`ProductManagement.md`, `ADMIN_USER_MANAGEMENT_SPEC.md`, etc.) if behavior changes.

---

## Related docs

| Document | Purpose |
| --- | --- |
| [`ROADMAP.md`](./ROADMAP.md) | Phase-level completion tracker |
| [`project_specification.md`](./project_specification.md) | Full product vision |
| [`admin-dashboard-ui-kit.md`](./admin-dashboard-ui-kit.md) | Admin visual system |
| [`ADMIN_USER_MANAGEMENT_SPEC.md`](./ADMIN_USER_MANAGEMENT_SPEC.md) | Staff CRUD (implemented) |
| [`ProductManagement.md`](./ProductManagement.md) | SKU / variant flows |
