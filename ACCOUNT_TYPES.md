# Account types

User profiles in Firestore use the string field `account-type` at `users/{userId}`.

## Default

New profiles get `account-type: "personal"`. Both login and the prompt page initialize this field when saving a profile that does not have it yet. Existing account types are preserved, including types assigned manually in Firestore.

## Planned types

| Value | Purpose |
| --- | --- |
| `personal` | Default account for individual users. |
| `student` | Student accounts. |
| `teacher` | Teacher accounts. |
| `school-administrator` | School administrators managing schools. |
| `site-administrator` | Site owners and managers, with all permissions. |
| `support-team` | Support staff answering support tickets. |

## Implementation status

Only the default field initialization is implemented in the app. Role-specific permissions, school management, and support-team workflows are planned for later.

The current Firestore rules allow users to write their own profile. This field must not be used to grant privileged access until rules or trusted backend logic prevent users from assigning themselves privileged account types. Who can assign each type, and the detailed permissions for each type, still need to be defined.
