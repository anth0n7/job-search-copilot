# Job Search Copilot

A full-stack app to track job applications, with some AI features to help figure out how well your resume actually matches a posting — parsed requirements, a similarity score, a list of matched/missing skills, and suggested resume/cover letter edits.

I built this as a learning project to practice full-stack development from the ground up: designing a database schema, building a REST API, adding real authentication, and eventually working with two different AI APIs.

## What it does

### Core tracking
- Add, edit, and delete companies, applications, contacts, and interview stages
- Each application has its own page showing everything related to it — the company, contacts, interview stages, the job posting, match history, and suggestions
- The companies page shows each company as a card; clicking one opens a popup where you can edit the company's info and manage its contacts
- Real accounts with Clerk — each user only ever sees their own data

### AI features
- **Job posting parser** — paste in a job description and Claude pulls out the seniority level, required skills, and responsibilities as structured data
- **Resume matching** — compares your resume against a job posting using text embeddings (Voyage AI) and cosine similarity to get an overall score, then asks Claude separately to list which required skills your resume actually shows and which ones are missing. Every match you run gets saved, so you can see your score improve as you edit your resume
- **Suggestions** — generates specific line-by-line resume rewrite suggestions (your original line, a suggested rewrite, and why) plus a cover letter draft, based on the job posting and whatever skills came back missing from the match. I specifically told the model not to make up skills or experience that aren't actually in the resume — it's easy for an LLM to "helpfully" exaggerate otherwise, and that's not something I want in a real cover letter.

## Built with

**Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router
**Backend:** Node.js, Express, TypeScript
**Database:** PostgreSQL
**Auth:** Clerk
**AI:** Anthropic Claude API (parsing, comparing skills, writing suggestions), Voyage AI (embeddings for the similarity score)

## Some decisions worth explaining

A few things I did on purpose that might look like they need explaining:

- **The backend is split into separate route files by resource** (`companies.ts`, `applications.ts`, etc.) instead of one giant file. I also pulled the repeated "check if the user is logged in" code into one shared piece of middleware, and did the same on the frontend with a small custom hook that handles attaching the auth token to every request. Both started out copy-pasted everywhere, and I went back and cleaned it up once I noticed how much was repeated.
- **Contacts and interview stages don't have their own `user_id` column.** Instead, ownership is checked by joining back to the company or application they belong to. This means a plain `user_id` check isn't enough on most routes — I had to actually join the tables and check ownership through the relationship.
- **I used a flexible JSON column for the parsed job posting data and the suggestions**, instead of separate rigid columns for each field, because I wasn't sure exactly what fields I'd end up wanting, and real job postings don't all have the same structure anyway. For simpler stuff like the skills lists, I just used a plain text array since there was nothing variable about the shape.
- **I decided not to use pgvector** (a Postgres extension for storing and searching embeddings) even though it's the "expected" tool for this kind of feature. It's built for searching across a lot of stored vectors efficiently, but I'm only ever comparing two vectors at a time (one resume, one job posting), so I just wrote the cosine similarity math directly instead of adding a whole extension I didn't actually need.
- **Every match attempt gets saved, not just the latest one**, along with a copy of the resume text used at the time. That way if I look back at an old match, I can see exactly what version of my resume produced that score, not just the score itself.
- **I found and fixed a real security bug while building this**: a user could take an application or contact they owned and reassign it to point at a company they didn't own, just by changing the ID in a request. I fixed it by checking that the new company actually belongs to the user too, not just the thing being edited.
- **The AI responses get cleaned up before being parsed as JSON.** Even when I explicitly told the model to return "only JSON, no other text," it would sometimes wrap the response in markdown code block formatting anyway. So I strip that out before parsing instead of assuming the model followed instructions perfectly.
- **Errors from the backend show up in a real message on screen**, not just in the browser console, using a small global error system I built with React Context so any component can trigger an error message without passing it down through a bunch of props.

## Running it locally

### You'll need
- Node.js 18+
- PostgreSQL
- Free API keys from [Clerk](https://clerk.com), [Anthropic](https://console.anthropic.com), and [Voyage AI](https://dashboard.voyageai.com)

### Setup

```bash
git clone <your-repo-url>
cd job-search-copilot

# Backend
cd server
npm install
# create a .env file in server/ with:
#   DATABASE_URL=postgresql://localhost:5432/jobtracker
#   CLERK_SECRET_KEY=...
#   CLERK_PUBLISHABLE_KEY=...
#   ANTHROPIC_API_KEY=...
#   VOYAGE_API_KEY=...
psql -c "CREATE DATABASE jobtracker;"
psql jobtracker -f schema.sql
npm run dev

# Frontend (in a new terminal)
cd client
npm install
# create a .env file in client/ with:
#   VITE_CLERK_PUBLISHABLE_KEY=...
#   VITE_API_URL=http://localhost:3001
npm run dev
```

Then open `http://localhost:5173`.

## What I'd add next

- Deploying it properly with Docker and AWS
- Automated tests
- CI/CD with GitHub Actions
- Caching AI responses with Redis so I'm not re-calling the API for the same thing twice
- Letting users upload a resume PDF instead of only pasting text

## Why I built this

I wanted a project that went past basic CRUD and actually used AI for something real, not just as a demo feature bolted on. Along the way I ran into (and had to actually debug) things like a real authorization vulnerability, a database serialization bug with JSON data, and inconsistent formatting in AI responses — the kind of problems that don't show up in a tutorial but do show up in real development.
