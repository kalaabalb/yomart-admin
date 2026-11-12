# YoMart Admin

React administrator dashboard for managing the YoMart catalog, categories, brands, collections, posters, orders, payment settings and customer-facing store configuration.

## Deployment

- Admin: https://yomart-admin.onrender.com
- API: https://yomart-api.onrender.com
- The API runtime is production; the current admin static build remains staging/noindex pending final owner/legal/catalogue approval.
- The admin reads/writes live API-backed data after authentication. Use the actual owner/admin account; do not create demo users or fake orders for screenshots.

## Current data boundary — 12 November 2026

The connected Atlas Free database is the active production database, despite historical project/database names containing “Staging”. It contains 8 active synthetic catalogue products, 2 inactive historical test fixtures, 4 categories, 4 subcategories, 2 brands, 2 collections, 2 posters, one admin account, one customer account, and zero orders/payment proofs.

Prices and stock are illustrative only. Production checkout is disabled. Public catalog endpoints hide synthetic price/stock fields; authenticated admin product endpoints retain them so the owner can review/update the records. The enabled manual payment method is **Cash at shop or handover**; no online gateway is configured.

## Visual evidence

Real desktop and mobile screenshots of the admin sign-in page are captured by the web repository's CI workflow. The authenticated dashboard, product CRUD, collections/posters, orders and payment-settings screenshots still require owner login; no admin password is stored in this repository or chat.

See [YoMart launch readiness](https://github.com/kalaabalb/yomart-docs/blob/main/docs/launch/readiness.md) and the [production cutover runbook](https://github.com/kalaabalb/yomart-docs/blob/main/docs/launch/production-cutover-runbook.md).
