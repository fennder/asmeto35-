# Security Specification — Pelada ASMETO

## 1. Data Invariants
1. No PII (email, phone, CPF, home address) is ever stored in public `players` or `sessions` documents.
2. Public reads (`get`, `list`) on `players` and `sessions` are strictly gated by `resource.data.visibility == 'public'`.
3. All writes (`create`, `update`, `delete`) require verified Google Authentication (`request.auth != null && request.auth.token.email_verified == true`), strict `isValidId()`, `isValid[Entity]()` schema checks, bounded strings/lists, and `request.time` server timestamp checks.
4. `createdBy` and `createdAt` are immutable after creation.
5. Finished sessions (`status == 'finished'`) cannot be mutated by non-admin users (terminal state lock).

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated `create` on `/players/p1`
2. Unverified email `create` on `/players/p1` (`email_verified: false`)
3. Oversized `id` (>128 chars) or invalid characters (`../evil`) on `/players/{id}`
4. Shadow/ghost field injection (`isAdmin: true`) on `/players/p1`
5. Identity spoofing (`createdBy: "other-uid"`) on `/players/p1`
6. Forged client `createdAt` timestamp (`createdAt != request.time`)
7. Negative stats (`goals: -5`) or wrong type (`goals: "ten"`)
8. Oversized `photoDataUrl` (>180000 chars) denial-of-wallet payload
9. Missing required key (`assists` omitted) on `/players/p1`
10. Modifying immutable `createdBy` or `createdAt` during `update`
11. Mutating a `finished` session as a non-admin user
12. Unauthenticated `delete` on `/sessions/s1`
