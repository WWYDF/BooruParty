# BooruParty — Monorepo

A few months ago, I set out to make a pretty booru-based imageboard in NextJS, mainly for practice. Originally, it was being developed on my private git server, so commits may be a bit funky from the import. Though, I've moved over to GitHub as I would say it's in a pretty good state for myself and others to use.

> [!note]
There's still a few things that I have to do before I would consider it "full", so until then, all releases will be "Pre-Releases".


# Features
- Tags
  - Implications
  - Suggestions
  - Descriptions
  - Aliases
- Tag Categories
  - Reordering
  - Colors
- Post Creation
  - Support for Images, GIFs, and Videos
  - Post Relations (Variants)
  - Safety Filters
- Fullscreen Viewer on Posts
- Preview & Thumbnail Creation
  - Serve lower-sized files unless user requests for original
- Pools (Collections)
  - Reordering (Drag & Drop)
  - Metadata (Description, title, author, etc.)
- Comments
  - Embed tenor GIFs
  - Embed Post Previews
- Voting
  - Posts
  - Comments
  - Tags
- Mass Post Editing
  - Tags
  - Safety
  - Post Relations
  - Pools
  - Deletion
- Moderation Tools
  - Audit Log for most actions
  - Roles & Permissions System
- Public User Profiles
  - Recent Posts
  - Recent Favorites
  - Recent Comments
- Importer
  - Support for Szurubooru
- A Decent REST API
- ✨ Animations ✨
- Probably something else I forgot about 😅

# Installation
This will be moved over to the website soon, but for now, I'll throw together this. You will need to have [NodeJS 22+](https://nodejs.org/en/download) with Yarn, and [PostgreSQL](https://www.postgresql.org/download/).

Make sure you download the latest release, extract it, and open the folder before starting any of the commands below. Currently, this guide assumes you are on Linux. (Debian Based)

## Frontend
Frontend hosts NextJS and Prisma.

First, we're going to setup our database.
```bash
# Connect to Local PostgreSQL
sudo -u postgres psql

# Create Database (db_name)
CREATE DATABASE booruparty;

# Create User with a secure password, remember this, we'll need it later
CREATE USER bpuser WITH PASSWORD 'Password1234';

# Give our new user admin on the new database.
GRANT ALL PRIVILEGES ON DATABASE booruparty TO bpuser;

# Change current database to our new one.
\c booruparty

# Grant permissions to bpuser. Required on PostgreSQL 15+.
GRANT ALL ON SCHEMA public TO bpuser;

# Exit psql.
\q
```

Now we will continue with NextJS and Prisma

1. First, open the correct folder with `cd frontend`.
2. Now install dependencies with `yarn`.
3. When that is done, open the `.env` file in your preferred editor. (Like `nano .env`)
   1. Make sure to remove the comments.

```bash
# Replace the same fields as above with what you typed in in the database setup.
# Leave 'postgresql', 'localhost', '5432' and '?schema=public' there.
DATABASE_URL="postgresql://bpuser:Password1234@localhost:5432/booruparty?schema=public"

# These should be publicly accessible URLs.
NEXT_PUBLIC_SITE_URL=https://<Public IP>:3069
NEXT_PUBLIC_FASTIFY=http://<Public IP>:3005
NEXTAUTH_URL=http://<Public IP>:3069

# Change this to something secure. It's what hashes sensitive information.
NEXTAUTH_SECRET=f8532753-9d31-4e02-aeb1-75f1bdc53254

# Should non-logged-in users be able to view Users/Posts/etc?
GUEST_VIEWING=false

# Should non-logged-in users be allowed to register an account?
REGISTRATION=true
```

4. Once that is filled out, type `yarn regen`.
5. If there are no errors, type `yarn build && yarn start`.
6. You're done with the frontend! (Press CTRL + C to close)


## Backend
Backend hosts Fastify, and will only accept uploads through NextJS.

1. First, open the correct folder.
   1. If you just finished the frontend, first do `cd ..`
   2. Then do `cd backend`
2. Now install dependencies with `yarn`.
3. Open the `.env` file in your preferred editor. (Like `nano .env`)
   1. Make sure to remove the comments.

```bash
# These are the IPs allowed to access API Routes.
# If you are hosting the frontend on the same machine, leave this alone.
# If they are separate machines, set this to the public IP of the frontend.
ALLOWED_IPS=127.0.0.1,::1

# What codec should video previews be re-encoded in?
# Accepts: h264, h265, vp9, av1.
VIDEO_ENCODER=av1
```

4. Once that is filled out, type `yarn start`.
5. If there's no errors, you're good to go!


## Keeping the Server Online
Currently, the services only stay up while you're signed into the terminal. For this, we will use [pm2](https://pm2.keymetrics.io/).

```bash
# First, we'll install pm2 globally with:
npm i -g pm2

# Then, we'll navigate to each folder (`frontend` and `backend`), and inside each we will run the following:
pm2 start "yarn start" --name backend
cd ../frontend
pm2 start "yarn start" --name frontend
```

Doing this will make pm2 manage this instead. Feel free to close the terminal/logout now!