# XMusic

A music streaming web app. Listen to songs uploaded by artists on XMusic and to
anything on YouTube in one player, build playlists, like songs, and control it
all from ChatGPT.

| | |
|---|---|
| Web app | https://xmusic.datameld.org |
| API | https://xmusic-api.datameld.org |
| ChatGPT (MCP) endpoint | `https://xmusic-api.datameld.org/mcp` |

**Contents:** [Features](#features) ·
[Use XMusic with ChatGPT](#use-xmusic-with-chatgpt) ·
[Run it locally](#run-it-locally) ·
[Working on the MCP server](#working-on-the-mcp-server) ·
[Troubleshooting ChatGPT](#troubleshooting-chatgpt) ·
[Tech stack](#tech-stack) · [Project layout](#project-layout)

## Features

**Listening**
- One player for uploaded audio files and YouTube videos, with a bottom player
  bar and a full Now Playing page (`/playing`)
- Queue with play next / add to queue / remove, shuffle, repeat (off, all, one)
- Playback speed (0.5×–2×), sleep timer, volume with the arrow keys
- The queue and current song are restored after a reload
- Recently played history, saved to your account and the same on every device
  (kept in the browser when you're logged out)

**Discovering**
- Home page suggestions, picked at random on every visit: songs, albums and
  playlists from XMusic, plus trending music, albums and playlists from YouTube
- Search across XMusic and YouTube, or paste a YouTube / YouTube Music link
- Only official YouTube uploads are shown and played: WhatsApp-status clips,
  slowed / lofi / 8D edits, covers and re-uploads by other channels are left
  out (**Show all** on the search page brings them back, and asking for a
  version by name, like *"... slowed"*, finds it)
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
- Say *"play some sad songs"*: ChatGPT picks songs, finds them in your library
  or on YouTube and plays them in your open XMusic tab, even while you stay in
  the ChatGPT tab
- Say *"make me a 2000s Tamil playlist"*: it saves the playlist to your
  library and can start it. It can also add or remove songs, rename or delete
  playlists, and like or unlike songs; your open tab updates right away
- Pause, skip, shuffle, repeat and "what's playing?" from the chat
- See and disconnect connected apps on the **Connected apps** page
- `npm run remote` controls your open tab from the terminal

## Use XMusic with ChatGPT

ChatGPT connects to XMusic's MCP server and sends commands to your open
XMusic browser tab, which does the playing. **Keep XMusic open and logged in**
while you use it.

You need an XMusic account and a ChatGPT plan that allows custom apps
(connectors) in developer mode. You only connect once.

### 1. Connect

1. In ChatGPT: **Settings → Apps & Connectors → Advanced settings**, turn on
   **Developer mode**.
2. In **Apps & Connectors**, choose **Create**:
   - **Name:** XMusic
   - **MCP server URL:** `https://xmusic-api.datameld.org/mcp`
   - **Authentication:** OAuth. Leave client id and secret empty; ChatGPT
     registers itself.
3. ChatGPT opens the XMusic **connect** page. Log in if asked, review the
   permissions and click **Allow**.

### 2. Play

1. Open https://xmusic.datameld.org, log in and **click anywhere on the page
   once**. Browsers don't let a page play sound until you've interacted with
   it.
2. In a ChatGPT chat, pick XMusic from the tools (**+** → XMusic) or mention
   it, and ask, for example:
   - *"Play some 2000s Tamil melodies"*
   - *"Make me a workout playlist and play it on shuffle"*
   - *"Add this song to my road trip playlist"*, *"Skip"*, *"What's playing?"*

### What ChatGPT can do

Grouped by the permissions you approve on the connect page:

| Permission | Lets ChatGPT | Tools |
|---|---|---|
| `music:read` | Search your library and YouTube, see what's playing, list your playlists and liked songs | `search_music`, `get_now_playing`, `list_my_library` |
| `player:control` | Play songs, albums, artists, playlists or liked songs; pause, skip, shuffle, repeat | `play`, `play_collection`, `control_playback` |
| `library:write` | Create and edit your playlists and liked songs | `create_playlist`, `add_to_playlist`, `remove_from_playlist`, `get_playlist`, `update_playlist`, `delete_playlist`, `like_songs`, `unlike_songs` |

ChatGPT can only change your own playlists. Removing songs and deleting a
playlist are marked as destructive, so ChatGPT normally asks you first. To disconnect it, use **Connected apps**
(`/connected-apps`) in XMusic.

An app connected before a permission existed (for example `library:write`)
doesn't get its tools. Delete the app in ChatGPT and create it again.

## Run it locally

### Requirements

- Node.js 20.19+ or 22.12+
- MongoDB running locally (or a connection string to a hosted one)
- Optional: a YouTube Data API v3 key (for YouTube search and suggestions)
  and a Google OAuth client id (for "Continue with Google")

### Install and start

```bash
npm run setup   # installs everything and creates server/.env from the example
# edit server/.env (at least MONGO_URI and JWT_SECRET)
npm run dev     # starts the API and the web app together
```

Open http://localhost:5173. The API runs on http://localhost:3000.

If you change the API port, point the client at it in `client/.env.local`:

```bash
VITE_API_URL=http://localhost:3100
```

### Environment variables (`server/.env`)

| Variable | What it's for |
|---|---|
| `PORT` | Port the API listens on (default `3000`) |
| `SERVER_URL` | Public base URL of the API, used for links to uploaded files |
| `CLIENT_URL` | URL of the web app (CORS, the ChatGPT connect page) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret that signs login cookies. Use a long random value |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key. Without it, YouTube search and suggestions are off, but pasted YouTube links still play |
| `GOOGLE_CLIENT_ID` | Google OAuth client id. Leave empty to hide the Google button |
| `PUBLIC_URL` | Public HTTPS address of the API that ChatGPT connects to (the OAuth issuer). Empty = `SERVER_URL` |
| `MCP_DEV_USER` | Local testing only: email of the account `/mcp` acts as without a token |
| `XMUSIC_EMAIL`, `XMUSIC_PASSWORD` | Account used by `npm run remote` |

Keep real keys in `server/.env` only; it is ignored by git.
`server/.env.example` is the shared template and must only hold placeholders.

**YouTube quota:** a key gets 10,000 units a day and a search costs 100, so
search results are cached for a week. Telling official uploads from edits
costs 2 more units per search (video and channel details). Trending tracks, album and playlist
suggestions and YouTube playlist pages are cached for hours.

### Scripts

| Where | Command | Does |
|---|---|---|
| root | `npm run setup` | Install all dependencies and create `server/.env` |
| root | `npm run dev` | Run the API (nodemon) and the client (Vite) together |
| `server/` | `npm start` | Run the API only |
| `server/` | `npm run remote -- <command>` | Control your open XMusic tab from the terminal |
| `server/` | `npm test` | Test the official-upload filter against saved YouTube searches |
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

## Working on the MCP server

The MCP server lives in `server/mcp/` and is served at `/mcp` (Streamable HTTP,
stateless). The full design (OAuth flow, tokens, the remote-control hub) is in
[docs/chatgpt-mcp-architecture.md](docs/chatgpt-mcp-architecture.md).

### Test it without ChatGPT

Set `MCP_DEV_USER` in `server/.env` to the email of your XMusic account and
restart the API. Requests to `http://localhost:3000/mcp` without a token, made
from your own machine and not through a proxy, then act as that account.
This never applies when `NODE_ENV=production`.

```bash
# List the tools
curl -s http://localhost:3000/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Play a song in your open XMusic tab
curl -s http://localhost:3000/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"play","arguments":{"items":[{"query":"Vaseegara Minnale"}]}}}'
```

Or run the MCP Inspector (`npx @modelcontextprotocol/inspector`), choose
**Streamable HTTP** and connect to `http://localhost:3000/mcp`.

### Production settings

On the server, `PUBLIC_URL` must be `https://xmusic-api.datameld.org` (no
trailing slash). It is the OAuth issuer and the audience of ChatGPT's tokens,
and `/mcp` only answers requests addressed to it or to `localhost`. If it
ever changes, every connected app has to connect again. To check it:

```bash
curl https://xmusic-api.datameld.org/.well-known/oauth-protected-resource
```

The answer should list `https://xmusic-api.datameld.org/mcp` as the
`resource`. Every tool call is logged on the server as
`[mcp] ChatGPT: tools/call <tool>`. Server setup and deploys are described in
[DEPLOYMENT.md](DEPLOYMENT.md).

## Troubleshooting ChatGPT

| What you see | Likely cause | Fix |
|---|---|---|
| "Internal error" / ChatGPT can't reach XMusic, and nothing shows in the server log | The API is down or unreachable | Run the `curl` check in [Production settings](#production-settings); if it fails, check the server ([DEPLOYMENT.md](DEPLOYMENT.md)) |
| ChatGPT asks you to sign in again, or says the app was disconnected | `PUBLIC_URL` changed, or the app was disconnected in XMusic | Delete the app in ChatGPT and create it again |
| "No XMusic tab is open" | No logged-in XMusic tab is connected | Open or reload XMusic and log in |
| "Click the XMusic tab once" | The tab hasn't been clicked since it loaded, so the browser blocks sound | Click anywhere in the XMusic tab; playback starts on that click |
| "Switch to the XMusic tab" | The browser is holding playback in a background tab | Switch to the tab; it starts by itself |
| YouTube songs can't be found | `YOUTUBE_API_KEY` is missing, or the daily quota is used up | Set the key, or wait for the reset (midnight Pacific). Library songs and YouTube links still work |
| ChatGPT says there are "only unofficial uploads" of a song | YouTube has no upload of it from the artist, label or an auto-generated art track | Ask for it with the artist or film name, or paste a YouTube link to play a specific video |
| Playlist tools aren't offered | The app was connected before `library:write` existed | Delete the app in ChatGPT and create it again |
| `403 Forbidden` from `/mcp` | The request's host is neither `localhost` nor the `PUBLIC_URL` host | Set `PUBLIC_URL` on the server to exactly `https://xmusic-api.datameld.org` |

## Tech stack

| Part | Built with |
|---|---|
| Client (`client/`) | React 19, TypeScript, Vite, Redux Toolkit, React Router, Tailwind CSS 4, shadcn/ui, YouTube IFrame API |
| Server (`server/`) | Node.js, Express 5, MongoDB with Mongoose, Multer, Socket.IO |
| ChatGPT | Model Context Protocol (`@modelcontextprotocol/sdk`), OAuth 2.1 |
| External | YouTube Data API v3, Google Identity Services |

Uploaded files are stored on disk in `server/uploads/` and served by the API.

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
  youtubeOfficial.js    which YouTube results are official uploads
  test/                 server tests (npm test)
  realtime/             Socket.IO hub that sends commands to open tabs
  mcp/                  MCP server for ChatGPT: tools, song lookup, playlists
  oauth/                OAuth 2.1 server for connected apps
  scripts/remote.js     terminal remote control
  uploads/              uploaded audio and images (not in git)
docs/                   design notes
DEPLOYMENT.md           how the production server is set up and deployed
```
