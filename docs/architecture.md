# InternHub MVP Architecture

## Folder Structure

```txt
app/
  api/
    auth/[...nextauth]/route.ts
    profile/route.ts
    student/route.ts
    company/route.ts
    internships/route.ts
    internships/[slug]/route.ts
    internships/[slug]/apply/route.ts
    chats/route.ts
    chats/connect/route.ts
    chats/[chatId]/messages/route.ts
    upload/route.ts
  auth/signin/page.tsx
  onboarding/page.tsx
  dashboard/page.tsx
  internships/page.tsx
  internships/new/page.tsx
  internships/[slug]/page.tsx
components/
lib/
types/
docs/
```

## MongoDB Collections

### `users`

- `email` (unique index)
- `name`
- `username` (unique sparse index)
- `role` (`student` | `company`)
- `provider` (`google`)
- `image`

### `studentProfiles`

- `userId`
- `skills` (max 10)
- `level`
- `education`
- `gpa` (optional)
- `languages`
- `location`
- `country`
- `preferredType`
- `resumeUrl` (optional)

### `companyProfiles`

- `userId`
- `companyName`
- `industry`
- `location`
- `country`
- `isRemote`
- `description` (max 200)

### `internships`

- `companyId`
- `slug` (unique index)
- `title`
- `skillsRequired` (index)
- `level`
- `type`
- `isPaid`
- `location` (index)
- `country` (index)
- `isRemote`
- `duration`
- `resumeRequired`
- `imageUrl` (optional)
- `description` (max 300)

### `applications`

- `internshipId`
- `studentId`
- unique compound index (`internshipId`, `studentId`)

### `chats`

- `internshipId`
- `companyId`
- `studentId`
- unique compound index (`internshipId`, `companyId`, `studentId`)

### `chatMessages`

- `chatId`
- `senderId`
- `senderRole`
- `text`

## API Routes

- `GET/POST /api/auth/[...nextauth]`
- `GET/PUT /api/profile`
- `GET/PUT /api/student`
- `GET/PUT /api/company`
- `GET/POST /api/internships`
- `GET /api/internships/[slug]`
- `POST /api/internships/[slug]/apply`
- `GET /api/chats`
- `POST /api/chats/connect`
- `GET/POST /api/chats/[chatId]/messages`
- `POST /api/upload`

## Search Logic

- Query parser extracts:
  - skill terms
  - location tokens
  - level/type hints
- Location-aware queries include `isRemote: true` results.
