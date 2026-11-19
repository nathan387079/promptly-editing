# Promptly

Promptly is a lightweight creative writing app built around daily prompts, habit-building, and personal reflection. The goal is to make writing feel approachable, consistent, and rewarding without turning it into a traditional classroom assignment.

## Product vision

- Daily creative and personal writing prompts
- A simple, low-friction experience for users to build a writing habit
- Encouragement-focused growth rather than grades or harsh evaluation
- A flexible app that could work for individuals, classrooms, or writing communities

## Current status

The project already includes the foundation of the MVP:

- Landing page and app branding
- Firebase setup for authentication and database access
- Google sign-in and email/password login flow
- User profile saving in Firestore
- Daily prompt generation based on user ID and date
- One submitted response per user per day
- Minimum character requirement before submission
- Firestore persistence for daily writing entries
- Basic logout flow and redirect-based auth handling

## Core features

### 1. Daily writing prompts
- Users receive a different prompt each day based on their unique user ID and the current date
- Prompts mix reflective, personal, and imaginative writing styles
- The app is designed to encourage daily writing without requiring complicated setup

### 2. Writing submission workflow
- Users can write a response in a textarea
- Responses must meet a minimum length requirement before submission
- Submissions are stored in Firestore for future access
- Users are prevented from submitting more than once per day

### 3. Authentication
- Google sign-in support
- Email/password login support
- Password reset flow
- User profile creation and metadata tracking in Firestore

### 4. Habit-building focus
- The app is structured around consistency, progress, and routine rather than competition
- This fits a writing habit product, especially for personal growth and creative practice

## Roadmap

### Phase 1: MVP foundation (already in progress / completed)
- [x] Basic website structure and branding
- [x] Firebase auth setup
- [x] Daily prompt system
- [x] Daily writing submission and persistence
- [x] User account creation and login flow

### Phase 2: Engagement and retention
- [ ] Streak tracking for daily writing
- [ ] Progress dashboard showing writing history
- [ ] Simple leaderboard or community ranking
- [ ] Personalized prompt categories (personal, creative, reflective, fantasy, etc.)
- [ ] Optional prompt refresh or custom prompt generation

### Phase 3: Feedback and writing support
- [ ] AI-based writing check before final submission
- [ ] Encouraging feedback on clarity, tone, or engagement
- [ ] Grammar and style suggestions for premium users
- [ ] Writing reflection prompts after submission
- [ ] Growth summaries instead of grades

### Phase 4: Premium and classroom features
- [ ] Premium tier for advanced writing feedback
- [ ] Grammar support and editing assistance
- [ ] Teacher or classroom dashboards for English assignments
- [ ] Assignment tracking and writing prompts tailored for educational use
- [ ] Mascot or gamified companion experience

### Phase 5: Expansion
- [ ] Mobile-friendly polish and improved UX
- [ ] More interactive design elements
- [ ] Community features for sharing progress and inspiration
- [ ] More robust onboarding and first-run experience

## Recommended next steps

1. Add streak tracking and daily progress data.
2. Build a user dashboard for past submissions and writing growth.
3. Create a lightweight AI feedback layer for pre-submit guidance.
4. Introduce premium features carefully so the core experience remains free and motivating.
5. Explore educational use cases for English classrooms without making the app feel like a grading tool.

## Summary

Promptly is positioned as a daily writing habit app with a strong creative and reflective angle. The current MVP already includes the essential building blocks: login, daily prompts, and saved writing submissions. The next steps should focus on retention, feedback, and growth-tracking features that make the app feel rewarding without turning writing into a performance score.

## Dashboards and membership

The role dashboard is at `/dashboard/`:

- Teachers create classrooms, share a class code, post assignments, and review submitted class work.
- Students join with a class code and submit work to assignments. Their personal daily writing remains private.
- School administrators can update their school name and review its classrooms.
- Site administrators can create and list schools.
- Moderators and support staff can review support requests and update their status.
- Personal accounts can view writing totals and membership status.

Role access uses Firebase Authentication custom claims. The profile field `account-type` is not trusted for permissions. Set claims only through the Firebase Admin SDK, then deploy `firestore.rules` before enabling the dashboards. See [ACCOUNT_TYPES.md](ACCOUNT_TYPES.md) for role names, school scoping, and setup steps.

The Premium page is at `/shop/`. It reads purchase history but keeps checkout disabled until `js/app-config.js` has a hosted HTTPS payment link and a trusted webhook is configured to verify charges, write purchase records, and set the `premium` claim. Never write purchase records or premium status from browser code.

The public landing pages load AdSense Auto ads using the publisher ID already present in `googleads.txt`. Ad display depends on the AdSense account approving the site and enabling Auto ads.
