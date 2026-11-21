# XMusic

A music streaming web app. Listen to songs uploaded by artists on XMusic and to
anything on YouTube in one player, build playlists, like songs, and control
playback from ChatGPT.

## Features

**Listening**
- One player for uploaded audio files and YouTube videos, with a bottom player
  bar and a full Now Playing page (`/playing`)
- Queue with play next / add to queue / remove, shuffle, repeat (off, all, one)
- Playback speed (0.5×–2×), sleep timer, volume with the arrow keys
- The queue and current song are restored after a reload
- Recently played history (kept in the browser, works logged out)

**Discovering**
- Home page suggestions, picked at random on every visit:
  songs, albums and playlists from XMusic, plus trending music, albums and
  playlists from YouTube
- Search across XMusic and YouTube, or paste a YouTube / YouTube Music link
- YouTube albums and playlists open inside XMusic and play in the same player
- Browse artists, albums, tracks and genres

**Your library**
- Liked songs (saved to your account; YouTube results can be liked too)
- Playlists: create, edit, add cover art, add songs from XMusic or YouTube
- Sign up with email and password, or with Google

**For artists**
- Become an artist from the profile menu, create albums and upload songs
  (mp3, wav, ogg, m4a, aac, flac, webm, opus) or add YouTube links
- Album colors are taken from the cover art

**ChatGPT and remote control**
- Connect XMusic to ChatGPT and say *"play some sad songs"*: it searches your
  library and YouTube and starts playing in your open XMusic tab
- Ask it to *"make me a 2000s Tamil playlist"*: it picks the songs, saves the
  playlist to your library and can start it. It can also add or remove songs,
  rename or delete playlists, and like or unlike songs; your open tab updates
  right away
- Manage or disconnect apps on the Connected apps page
- `npm run remote` controls your open tab from the terminal

## Tech stack

| Part | Built with |
|---|---|
| Client (`client/`) | React 19, TypeScript, Vite, Redux Toolkit, React Router, Tailwind CSS 4, shadcn/ui, YouTube IFrame API |
| Server (`server/`) | Node.js, Express 5, MongoDB with Mongoose, Multer, Socket.IO |
| ChatGPT | Model Context Protocol (`@modelcontextprotocol/sdk`), OAuth 2.1 |
| External | YouTube Data API v3, Google Identity Services |

Uploaded files are stored on disk in `server/uploads/` and served by the API.

## Getting started

### Requirements

- Node.js 20.19+ or 22.12+
- MongoDB running locally (or a connection string to a hosted one)
- Optional: a YouTube Data API v3 key (for YouTube search and suggestions)
  and a Google OAuth client id (for "Continue with Google")

### Install and run

```bash
npm run setup   # installs everything and creates server/.env from the example
# edit server/.env (at least MONGO_URI and JWT_SECRET)
npm run dev     # starts the API and the web app together
```

Open http://localhost:5173. The API runs on http://localhost:3000.

If you change the API port, also point the client at it in
`client/.env.local`:

```bash
VITE_API_URL=http://localhost:3100
```

### Environment variables (`server/.env`)

| Variable | What it's for |
|---|---|
| `PORT` | Port the API listens on (default `3000`) |
| `SERVER_URL` | Public base URL of the API, used for links to uploaded files |
| `CLIENT_URL` | URL of the web app (CORS, the ChatGPT approval page) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret that signs login cookies. Use a long random value |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key. Without it, YouTube search and suggestions are off, but pasted YouTube links still play |
| `GOOGLE_CLIENT_ID` | Google OAuth client id. Leave empty to hide the Google button |
| `PUBLIC_URL` | Public HTTPS address of the API when ChatGPT reaches it through a tunnel |
| `MCP_DEV_USER` | Local testing only: email of the account `/mcp` acts as without a token |
| `XMUSIC_EMAIL`, `XMUSIC_PASSWORD` | Account used by `npm run remote` |

Keep real keys in `server/.env` only. It is ignored by git;
`server/.env.example` is the shared template and should only hold placeholders.

**YouTube quota:** a key gets 10,000 units a day. A search costs 100 units, so
results are cached. Trending tracks, album and playlist suggestions and
YouTube playlist pages are cached for hours too.

## Scripts

| Where | Command | Does |
|---|---|---|
| root | `npm run setup` | Install all dependencies and create `server/.env` |
| root | `npm run dev` | Run the API (nodemon) and the client (Vite) together |
| `server/` | `npm start` | Run the API only |
| `server/` | `npm run remote -- <command>` | Control your open XMusic tab from the terminal (see below) |
| `client/` | `npm run dev` | Run the web app only |
| `client/` | `npm run build` | Type-check and build for production into `client/dist` |
| `client/` | `npm run lint` | Lint the client |

### Terminal remote control

Log in to XMusic in a browser tab, set `XMUSIC_EMAIL` / `XMUSIC_PASSWORD`, then:

```bash
cd server
npm run remote -- play daft punk --shuffle
npm run remote -- pause | resume | next | previous
npm run remote -- shuffle on
npm run remote -- repeat all
npm run remote -- now
npm run remote -- devices
```

## Connecting ChatGPT

ChatGPT talks to XMusic through an MCP server at `/mcp`. XMusic sends the
command to your open browser tab, which does the playing. ChatGPT can search
music, play songs, albums, playlists or your liked songs, control playback,
see what's playing, and create and edit your playlists and liked songs. It
only gets the permissions you approve.

1. Expose the API over HTTPS, for example
   `cloudflared tunnel --url http://localhost:3000`, and set
   `PUBLIC_URL=https://<tunnel host>` in `server/.env`. Restart the server.
2. In ChatGPT: Settings → Apps & Connectors → Advanced → turn on Developer
   mode → Create. URL `https://<tunnel host>/mcp`, authentication **OAuth**
   (leave client id and secret empty).
3. Approve the connection on the XMusic page that opens.
4. Open XMusic in your browser, click the page once, and ask ChatGPT to play
   something.

A quick tunnel gets a new address every time it starts, so you'd need to
reconnect. The full design is in
[docs/chatgpt-mcp-architecture.md](docs/chatgpt-mcp-architecture.md).

## Project layout

```
client/                 React web app
  src/pages/            one file per page (home, album, playlist, search, …)
  src/components/       player, song rows, cards, forms, suggestions
  src/reducers/         Redux slices: player/queue, user, likes, toasts
  src/lib/              API client, YouTube player, remote control, helpers
server/                 Express API
  routes/ controllers/  REST endpoints (songs, artists, albums, playlists,
                        likes, suggestions, YouTube, auth)
  models/               Mongoose models
  youtube.js            YouTube search, trending, playlists (with caching)
  realtime/             Socket.IO hub that sends commands to open tabs
  mcp/                  MCP server for ChatGPT
  oauth/                OAuth 2.1 server for connected apps
  scripts/remote.js     terminal remote control
  uploads/              uploaded audio and images (not in git)
docs/                   design notes
```
