# VIEK Client Management — Debugging Assessment

A full-stack client and project management app (React/Vite frontend, Node/Express backend) 
built and debugged as part of the Software Development Intern assessment.

## Bugs Identified

1. Client list never loaded on the dashboard
2. Deleting a client always failed with "Client not found"
3. Filtering projects by client always returned an empty list
4. App crashed with "Cannot read properties of undefined (reading 'map')" on load
5. Adding a new client always failed with "Name and email are required"
6. Passwords stored and compared in plaintext
7. A single hardcoded, non-expiring token ("demo-token") was used for all sessions
8. Login response leaked the user's password hash back to the client
9. Login form shipped with real credentials pre-filled in component state
10. `Uncaught ReferenceError: React is not defined` — blank white screen on load

## Root Causes

1. The backend returned client data as `{ data: clients }`, but the frontend read `result.clients`, which was always `undefined`.
2. `req.params.id` is always a string, while `client.id` is stored as a number. The strict inequality check `client.id !== id` was therefore always `true` for every client, so the delete filter never removed anything.
3. Same string-vs-number mismatch: `clientId` from the query string was compared with `===` against a numeric `project.clientId`, so it never matched.
4. `useState()` for `projects` had no default value, so `projects.map(...)` executed on `undefined` during the first render, before the initial fetch resolved.
5. The `addClient` request sent an `Authorization` header but no `Content-Type: application/json` header, so Express's `express.json()` middleware never parsed the request body — `req.body` came through empty.
6. The original implementation stored and compared raw password strings with no hashing.
7. The token was a static string checked with a direct comparison, shared across all users and sessions, with no expiry or per-user identity.
8. The login route returned the full user object, including the password field, directly in the JSON response.
9. `email`/`password` state was initialized with real values instead of empty strings.
10. The Vite/JSX setup required `React` to be explicitly in scope in files using JSX, but `App.jsx` only imported `useEffect` and `useState`.

## Solutions

1. Changed the frontend to read `result.data` from the clients response.
2. Cast `req.params.id` to a number (`Number(req.params.id)`) before comparing against `client.id`.
3. Cast the `clientId` query parameter to a number before filtering projects.
4. Gave `projects` a default of `[]` in `useState([])`, and defaulted `result.projects ?? []` when setting state after fetch.
5. Added `"Content-Type": "application/json"` to the `addClient` fetch headers.
6. Hashed passwords with SHA-256 before storing and comparing (noted as a baseline fix — see Security section for further improvement).
7. Replaced the static token with a randomly generated per-login token (`crypto.randomBytes`), stored server-side in a session map keyed to the user.
8. Stripped the password field out of the user object before sending the login response.
9. Changed `email`/`password` initial state to empty strings.
10. Added `import React from "react"` to `App.jsx`.

## Testing

Manually tested end-to-end in the browser after each fix:
- Logged in with `admin@viek.test` / `password123` — succeeds, no errors.
- Confirmed the client list populates with the two seeded clients (Acme Limited, Bright Solutions).
- Added a new client and confirmed it appears in the list immediately with no error.
- Deleted a client and confirmed it's removed from the list and the UI updates correctly.
- Selected each client in the Projects filter dropdown and confirmed only that client's projects display; confirmed "All Clients" shows every project.
- Checked the browser console after each change to confirm no uncaught errors remained.

## Security

- Passwords are now hashed (SHA-256) rather than stored in plaintext. This is a meaningful improvement over the original code, but SHA-256 alone is not sufficient for production password storage — a proper implementation should use a slow, salted hashing algorithm such as bcrypt or argon2.
- Session tokens are now randomly generated per login and tracked server-side, rather than a single hardcoded value shared by everyone. This is still an in-memory store (`Map`), so all sessions are lost on server restart — a production system would use JWTs with expiry or a persistent, database-backed session store.
- The login response no longer includes the password field.
- Login credentials are no longer pre-filled in the frontend source.

## Reflection

The hardest bug to catch was the blank white screen after fixing the functional issues — 
the actual error (`React is not defined`) was buried under unrelated browser-extension 
noise (MetaMask connection warnings) in the console, which made it easy to overlook at first.

My general approach was to read through the given code first to predict likely bugs from 
the description alone (the string/number ID mismatches and missing state defaults were 
visible just from reading), then confirm each one by actually running the app and 
reproducing the failure before writing a fix, rather than guessing blind.

Left unresolved / known limitations: the session store is in-memory and won't survive a 
server restart, and password hashing uses plain SHA-256 rather than a purpose-built, 
salted algorithm. Both would need to be addressed before this could be considered 
production-ready.