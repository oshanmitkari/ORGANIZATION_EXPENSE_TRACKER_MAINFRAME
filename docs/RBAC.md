# Local Authentication, RBAC, and API Rules

## Demo authentication

There is no public registration or default password. From PowerShell, run `ALLOW_DEMO_BOOTSTRAP=YES` with `npm run demo:bootstrap` (commands are in the README). The bootstrap refuses to overwrite `data/users.json`, generates random one-time passwords, and stores scrypt password hashes with per-user salts. Keep the printed credentials private. The app resolves the actor only from the session cookie; `X-Role`, `X-Employee`, and `X-User` headers are ignored.

The session cookie is HttpOnly, SameSite=Strict, and Secure when `NODE_ENV=production`. Sessions are in process memory, use a four-hour sliding expiration, and are invalidated on logout or restart. Login attempts are rate limited in process memory. This local implementation needs HTTPS termination, persistent shared sessions, durable account lifecycle, stronger operational controls, and independent security review before production use.

## Role-to-permission matrix

| Permission | EMPLOYEE | MANAGER | FINANCE_OPERATOR | FINANCE_ADMIN | AUDITOR |
|---|---:|---:|---:|---:|---:|
| expense:create | Yes | — | Yes | Yes | — |
| expense:read_own | Yes | — | — | — | — |
| expense:read_team | — | Yes | — | — | — |
| expense:read_all | — | — | Yes | Yes | Yes |
| expense:update_own_draft | Yes | — | Yes | Yes | — |
| expense:update_all_draft | — | — | Yes | Yes | — |
| expense:submit | Yes | — | Yes | Yes | — |
| expense:approve_assigned | — | Yes | — | Yes | — |
| expense:reject_assigned | — | Yes | — | Yes | — |
| expense:post | — | — | Yes | Yes | — |
| employee:read | Yes | Yes | Yes | Yes | Yes |
| employee:manage | — | — | — | Yes | — |
| batch:read | — | — | Yes | Yes | Yes |
| batch:execute | — | — | Yes | Yes | — |
| report:read_own / report:read_team / report:read | Own | Team | All | All | All |
| report:export | — | — | Yes | Yes | Yes |
| audit:read | — | — | — | Yes | Yes |
| category:manage | — | — | — | Yes | — |
| batch:restart | — | — | — | Reserved | — |
| user:manage_roles | — | — | — | Reserved | — |
| system:configure | — | — | — | Reserved | — |

Reserved permissions have no route or UI yet; they do not grant an action by themselves. There is no user-role management API. Demo roles are created by an explicit local bootstrap script, not from browser-submitted data.

## Route inventory

| Route | Permission / policy |
|---|---|
| `GET /api/auth/session`, `POST /api/auth/login` | Public session check / credential login; rate limited and failure-audited |
| `POST /api/auth/logout` | Clears current cookie/session; same-origin checked |
| `GET /api/enterprise` | Role-specific expense read permission; employee own, manager assigned-team, finance/auditor all; subordinate audit/batch/approval data further filtered |
| `GET /api/dashboard` | Role-specific report permission; aggregates only authorized expense rows |
| `GET /api/reports` | Role-specific report permission; expense and approval data scope applied server-side |
| `GET /api/audit` | `audit:read`; read-only, admin/auditor only |
| `POST /api/expenses` | `expense:create`; employee must use their authenticated employee ID and active master record |
| `GET /api/expenses/:id` | Read permission plus object-scope check |
| `PATCH /api/expenses/:id` | Own draft permission or finance all-draft permission; status is not mass assignable |
| `POST /api/expenses/:id/submit` | `expense:submit`; employee owner check and state validation |
| `POST /api/expenses/:id/approve` | `expense:approve_assigned`; assigned manager check, no self-approval |
| `POST /api/expenses/:id/reject` | `expense:reject_assigned`; assigned manager check and nonblank reason |
| `POST /api/expenses/:id/post` | `expense:post`; approved-only and idempotent by transaction ID |
| `POST /api/employees`, `POST /api/master` | `employee:manage`; administrator only, unique employee ID and active manager reference |
| `POST /api/run`, `/api/upload`, `/api/sample`, dataset mutation routes | `batch:execute`; finance operator/admin only |
| Dataset reads (`/api/state`, `/api/file/...`) | `batch:read`; finance operator/admin/auditor only |

Unlisted API routes return 404. Every listed protected route requires a valid server-side session. Authentication/authorization failures are recorded with actor/route or bounded login name and outcome; passwords, cookies, and request bodies are not written to audit records.

## Expense transitions

`Draft → Pending approval → Approved → Posted`

`Draft → Pending approval → Rejected → Draft-edit → Pending approval`

The API does not accept arbitrary status changes. Posting is separate from approval. The local JSON write uses atomic replacement, but it is not a database transaction or multi-process lock.

## Test each role

1. Bootstrap local accounts once and retain the printed one-time passwords.
2. Sign in using each generated username: employee, manager, finance, admin, auditor.
3. Verify that the navigation follows the account’s permissions; direct API authorization is tested independently by `npm test`.
4. For sample users, the manager account E0001001 is assigned as manager for the seed employees. The employee account E0001002 owns the employee demo’s claims.
5. Log out and verify `/api/enterprise` returns HTTP 401 until login.

The HTTP suite uses temporary user/data files and does not modify the project’s live demo data.
