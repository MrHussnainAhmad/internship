# InternHub MVP

InternHub is a production-oriented internship marketplace built with:

- Next.js App Router
- NextAuth (Google OAuth)
- MongoDB
- Cloudinary

## Setup

1. Copy environment variables:

```bash
cp .env.example .env.local
```

2. Fill all required values in `.env.local`.
3. Install packages:

```bash
npm install
```

4. Run locally:

```bash
npm run dev
```

## MVP Features

- Google-only authentication
- Profile completion flow (student/company)
- Internship posting (company)
- Intelligent internship search + filters
- Basic apply flow (student)
- SEO-ready routes with dynamic internship metadata

## Deployment (Vercel)

1. Push repository to GitHub.
2. Import project in Vercel.
3. Set all `.env.example` variables in Vercel project settings.
4. Deploy.

Build and start commands are already configured:

- Build: `npm run build`
- Start: `npm run start`
