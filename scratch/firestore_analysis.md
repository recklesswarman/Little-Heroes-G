# Firestore Security Rules Analysis: Little Heroes Adventures

## 1. Environment & Stack
- **Framework**: Vite + Vanilla JS / Modular Client Web App (ESM) + Firebase Functions (TypeScript)
- **Firebase SDK**: Firebase JS SDK v12 Modular (`firebase/firestore`, `firebase/auth`, `firebase/storage`)
- **Backend**: Firebase Cloud Functions (v2) with `firebase-admin/firestore`

## 2. Collections & Document Paths
1. `households/{householdCode}`
   - **Path**: `/households/{householdCode}`
   - **Access Patterns**:
     - `onSnapshot(doc(db, "households", code))`
     - `setDoc(doc(db, "households", code), payload, { merge: true })`
     - `updateDoc(doc(db, "households", code), updates)`
   - **Queries**: Direct document access by ID (`householdCode`). No collection group or compound queries (`where()`, `orderBy()`) used by client.
   - **Data Schema**:
     - `syncCode`: string (<= 32 chars)
     - `name` / `householdName`: string (<= 100 chars)
     - `devices`: map (<= 25 devices)
     - `heroes`: list (<= 20 heroes)
     - `heroesMap`: map (<= 20 heroes keyed by hero ID)
     - `deletedHeroIds`: list of strings (<= 50 IDs)
     - `parents`: list (<= 15 items)
     - `parentUids`: list of string UIDs (<= 15 items)
     - `parentEmails`: list of string emails (<= 15 items)
     - `pendingApprovals`: list (<= 100 items)
     - `taskCompletionLogs`: list (<= 500 items)
     - `taskForest`: list (<= 50 items)
     - `habitIslands`: list (<= 50 items)
     - `aiQuests`: list (<= 50 items)
     - `recentlyUnlocked`: list (<= 50 items)
     - `parentSettings`: map (<= 30 keys)
     - `lastUpdated`: number or timestamp (optional)
     - `updatedAt`: number or timestamp (optional)

2. `user_households/{linkId}`
   - **Path**: `/user_households/{linkId}`
   - **Access Patterns**:
     - `getDoc(doc(db, "user_households", userIdOrEmail))`
     - `setDoc(doc(db, "user_households", linkId), payload, { merge: true })`
   - **Document ID**: `request.auth.uid` OR `email_${cleanEmail}`
   - **Data Schema**:
     - `userId`: string (must match `request.auth.uid`)
     - `householdCode`: string (4-32 chars)
     - `email`: string (optional, valid email format)
     - `role`: string (optional, allowed: 'parent', 'child', 'admin')
     - `linkedAt`: number or timestamp
     - `updatedAt`: number or timestamp

3. `heroes/{heroId}` (and subcollections: `settings`, `chatHistory`)
   - **Path**: `/heroes/{heroId}/**`
   - **Access Patterns**: Server-only via Firebase Admin SDK.
   - **Client Rules**: `allow read, write: if false;`

4. `users/{heroId}` (Legacy)
   - **Client Rules**: `allow read, write: if false;`

5. Catch-all:
   - `match /{document=**} { allow read, write: if false; }`

## 3. Business Logic & Security Requirements
- **Default Deny**: All unmapped documents are denied.
- **Parent vs. Kid Access Control**:
  - Parents identified by `request.auth.uid in householdData.parentUids` or `request.auth.token.email in householdData.parentEmails`.
  - Bootstrap claim allowed for first authenticated user if `parentUids` is unassigned or empty.
  - Kids can submit chore completion requests via `isAllowedKidChoreUpdate()`.
  - Kids CANNOT modify parental controls, admin lists, delete kid profiles, approve tasks, or manipulate point/reward balances.
- **Resource Limits**:
  - Max string lengths on names and codes.
  - Max list sizes on logs, approvals, heroes, and devices.
- **UID Protection**:
  - `user_households` requires `request.resource.data.userId == request.auth.uid`.
