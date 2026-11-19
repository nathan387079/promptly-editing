# Account roles and access

The user profile field `account-type` is descriptive only. It is editable profile data and must never grant access to staff or classroom features. Dashboards read the trusted Firebase Authentication custom claim `role`; Firestore rules independently enforce it.

## Supported role claims

| Claim | Dashboard access |
| --- | --- |
| `role: "personal"` (or no role) | Personal writing summary and premium status. |
| `role: "student"` | Join classrooms with a code, read assignments, and submit class work. |
| `role: "teacher"` | Create classrooms and assignments; view classroom rosters and submitted class work. |
| `role: "school-administrator"` with `schoolId` | Update school details and review its classrooms. |
| `role: "site-administrator"` | Create and list schools; site wide support access. |
| `role: "moderator"` or `role: "support-team"` | Review support requests and change their status. |

`schoolId` is a string claim used to scope school administrators and teacher classrooms. `premium: true` is a separate claim used to show an active membership. Neither claim is stored in a user-editable profile.

## Assigning access

Only a trusted server using the Firebase Admin SDK may set custom claims. For example, trusted server code can set a role after verifying the user and school:

```js
await getAuth().setCustomUserClaims(uid, {
  role: "teacher",
  schoolId: "SCHOOL_DOCUMENT_ID"
});
```

Use the same operation with `role: "student"`, `role: "school-administrator"` plus `schoolId`, `role: "moderator"`, or `role: "site-administrator"` as appropriate. For a confirmed premium purchase, set `premium: true` from the payment webhook. Do not set roles from browser code or let users edit claims through Firestore. Existing users may need to sign out and back in after claim changes so their ID token refreshes.

Deploy the rules in `firestore.rules` before enabling classroom accounts:

```sh
firebase deploy --only firestore:rules
```

## Classroom data

- A teacher creates `classrooms/{classCode}`. The document ID is a random invite code; share it only with students in that class.
- Students join under `classrooms/{classCode}/members/{uid}`.
- Assignments are stored at `classrooms/{classCode}/assignments/{assignmentId}`.
- Student work is stored at each assignment's `submissions/{uid}` document. Teachers can read work submitted to their classrooms; they do not get access to students' personal daily writing.
- School administrators are scoped to classrooms whose `schoolId` matches their trusted claim.

## Payments and advertising

The Premium page can open a hosted HTTPS checkout URL from `window.PROMPTLY_CONFIG.stripePaymentLink` in `js/app-config.js`. It is intentionally not enabled until a hosted payment page and a trusted payment webhook are configured. The webhook must verify payment before writing a purchase record or setting the `premium` claim. Clients cannot create or change purchase records.

The public landing pages load AdSense Auto ads with the publisher ID already listed in `googleads.txt`. Ads still depend on the AdSense account approving the site and having Auto ads enabled for it.
