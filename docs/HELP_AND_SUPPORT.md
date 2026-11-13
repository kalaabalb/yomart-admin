# Help & Support content management

Open **Help & Support** from the admin navigation. The section loads existing records from the authenticated `/support-content/admin` endpoint and supports adding, editing, publishing/unpublishing, refreshing, and deleting entries (deletion requires browser confirmation).

Enter owner-approved customer-facing titles and plain-text help content. The API validates and limits both fields. New entries start unpublished by default; enable **Published to customers** only after content review. Display order must be a non-negative integer. Published changes are fetched when the customer app opens Help & Support, so they do not require a mobile release.

The API requires the existing `contacts.manage` capability. Moderators and unauthenticated visitors cannot manage content. Do not enter credentials, private customer details, unverified contact information, or unsupported business promises. An empty list is expected until approved content is added.
