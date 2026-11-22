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
| `PUBLIC_URL` | Public HTTPS address of the API that ChatGPT connects to (OAuth issuer). Empty = `SERVER_URL` |
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

## Connecting ChatGPT (MCP)

ChatGPT talks to XMusic through an MCP server at `/mcp` on the API. It sends
commands to your open XMusic browser tab, which does the playing, so **XMusic
must be open and logged in** in a browser for anything to play.

What ChatGPT can do, grouped by the permissions you approve when connecting:

| Permission | Tools | Lets ChatGPT |
|---|---|---|
| `music:read` | `search_music`, `get_now_playing`, `list_my_library` | Search your library and YouTube, see what's playing, list your playlists and liked songs |
| `player:control` | `play`, `play_collection`, `control_playback` | Play songs, albums, artists, playlists or liked songs; pause, skip, shuffle, repeat |
| `library:write` | `create_playlist`, `add_to_playlist`, `remove_from_playlist`, `get_playlist`, `update_playlist`, `delete_playlist`, `like_songs`, `unlike_songs` | Build and edit your playlists and liked songs; your open tab updates right away |

### What you need

- An XMusic account on https://xmusic.datameld.org
- A ChatGPT plan that allows custom apps / connectors in developer mode

XMusic is hosted at a fixed HTTPS address (see [DEPLOYMENT.md](DEPLOYMENT.md)),
so you only connect once:

| | |
|---|---|
| MCP server URL | `https://xmusic-api.datameld.org/mcp` |
| Web app (log in and keep it open) | https://xmusic.datameld.org |

### 1. Add XMusic to ChatGPT

1. In ChatGPT: **Settings → Apps & Connectors → Advanced settings** and turn
   on **Developer mode**.
2. Back in **Apps & Connectors**, choose **Create**:
   - **Name:** XMusic
   - **MCP server URL:** `https://xmusic-api.datameld.org/mcp`
   - **Authentication:** OAuth. Leave client id and secret empty; ChatGPT
     registers itself.
3. ChatGPT opens the XMusic **connect** page. Log in if asked, check the
   permissions and click **Allow**.

Connected apps are listed in XMusic under **Connected apps**
(`/connected-apps`), where you can see when each was last used and
disconnect it.

New permissions (such as `library:write`) need a reconnect: an app connected
before they existed only gets the tools it was approved for. Delete the app
in ChatGPT and create it again.

### 2. Use it

1. Open https://xmusic.datameld.org, log in and **click anywhere on the page
   once**. Browsers don't let a page play sound until you've interacted with
   it.
2. In a ChatGPT chat, pick XMusic from the tools (**+** → the app) or
   mention it, and ask, for example:
   - *"Play some 2000s Tamil melodies"*
   - *"Make me a workout playlist and play it on shuffle"*
   - *"Add this song to my road trip playlist"*, *"Skip"*, *"What's playing?"*

You can stay in the ChatGPT tab: songs start in the XMusic tab in the
background. Each call shows in the API log as `[mcp] ChatGPT: tools/call play`.

### Server settings

On the server, `PUBLIC_URL` in `server/.env` must be the API's public address
(`https://xmusic-api.datameld.org`, no trailing slash). It's the OAuth issuer
and the audience of ChatGPT's tokens, and `/mcp` only answers requests
addressed to it or to `localhost`. If it ever changes, every connected app has
to be connected again. Check it with:

```bash
curl https://xmusic-api.datameld.org/.well-known/oauth-protected-resource
```

The answer should list `https://xmusic-api.datameld.org/mcp` as the
`resource`.

### Testing the MCP server locally (without ChatGPT)

Set `MCP_DEV_USER` in `server/.env` to the email of your XMusic account and
restart the API. Requests to `http://localhost:3000/mcp` without a token,
from your own machine (not through a proxy), then act as that account.
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

Or use the MCP Inspector: run `npx @modelcontextprotocol/inspector`, choose
**Streamable HTTP** and connect to `http://localhost:3000/mcp`.

### Troubleshooting

| ChatGPT says | Likely cause | Fix |
|---|---|---|
| "Internal error" / can't reach XMusic, and nothing shows in the API log | The API is down or unreachable | Check `curl https://xmusic-api.datameld.org/.well-known/oauth-protected-resource`; if it fails, check the server (see [DEPLOYMENT.md](DEPLOYMENT.md)) |
| Asks you to sign in again, or "this app was disconnected" | `PUBLIC_URL` changed since you connected, or you disconnected it in XMusic | Delete and re-create the app in ChatGPT |
| "No XMusic tab is open" | No logged-in XMusic tab is connected to the API | Open or reload XMusic and log in (restarting the API also drops the tab's connection until it reconnects) |
| "Click the XMusic tab once" | The tab hasn't been clicked since it was loaded, so the browser blocks sound | Click anywhere in the XMusic tab; playback starts on that click |
| "Switch to the XMusic tab" | The browser is holding playback in a background tab | Switch to the tab; it starts by itself |
| YouTube songs can't be found | `YOUTUBE_API_KEY` missing, or the daily quota is used up | Set the key, or wait for the quota reset (midnight Pacific). Library songs and YouTube links still work |
| Playlist tools aren't offered | The app was connected before `library:write` existed | Reconnect it |
| `403 Forbidden` from `/mcp` | The request's host isn't `localhost` or the `PUBLIC_URL` host | Make sure `PUBLIC_URL` on the server is exactly `https://xmusic-api.datameld.org` |

The full design (OAuth flow, tokens, the remote-control hub) is in
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
