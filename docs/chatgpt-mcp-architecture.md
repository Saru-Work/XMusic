# XMusic × ChatGPT — MCP Architecture

Goal: type *"play some sad songs"* in ChatGPT and have them start playing in XMusic.

Status:
- **Phase 1 done** — remote-control hub (`server/realtime/`), browser side (`client/src/lib/remote.ts`), `npm run remote` terminal tool.
- **Phase 2 done** — `/mcp` with the six tools below (`server/mcp/`).
- **Phase 3 done** — OAuth: ChatGPT acts as whoever approves it on `/connect`; Connected apps to disconnect (`server/oauth/`).
- Phase 4 (polish) partly done: Google sign-in, background playback, YouTube ranking and search cache.

---

## 1. The core problem

ChatGPT runs in OpenAI's cloud. XMusic's player runs **in your browser tab** (Redux
`songSlice` + `AudioEngine` / `YouTubeEngine`). The Express server never plays audio.

So an MCP server alone isn't enough. We need **three hops**:

1. ChatGPT → **MCP server** (decides *what* to play)
2. MCP server → **realtime channel** → your open XMusic tab
3. The tab dispatches the same Redux actions a click would (`playSongs`, `setPlaying`, `nextSong`…)

## 2. Big picture

```
┌────────────┐  HTTPS (MCP Streamable HTTP)   ┌──────────────────────────── XMusic server (Express) ───────────────────────────┐
│  ChatGPT   │  + OAuth bearer token          │                                                                                │
│ (connector)│ ─────────────────────────────▶ │  /mcp            MCP endpoint (tools)                                          │
└────────────┘                                │    │                                                                           │
      │  OAuth login + consent (browser)      │    ├── Music resolver ──▶ MongoDB (Song, Album, Playlist, User.likedSongs)     │
      └─────────────────────────────────────▶ │    │                 └─▶ youtube.js (searchYouTube)                           │
                                              │    │                                                                           │
                                              │    └── Remote-control hub (Socket.IO, room per user)                           │
                                              │  /oauth/*, /.well-known/*   OAuth 2.1 authorization server                     │
                                              │  existing REST routes (unchanged)                                              │
                                              └──────────────────────────────────────────┬─────────────────────────────────────┘
                                                                                         │ WebSocket (cookie-authenticated)
                                                                                         ▼
                                              ┌──────────────── Browser: XMusic client (React) ─────────────┐
                                              │  remote.ts: receives commands → store.dispatch(...)         │
                                              │             sends acks + "now playing" state back           │
                                              │  AudioEngine / YouTubeEngine actually make the sound        │
                                              └─────────────────────────────────────────────────────────────┘
```

**Decision: put the MCP server inside the existing Express app** (mounted at `/mcp`), not a
separate process. It reuses the Mongoose models, `youtube.js`, and — most importantly — can
talk to the Socket.IO hub in-memory. A separate process would need Redis/pub-sub just to
reach the browser.

## 3. Components

### 3.1 MCP endpoint — `server/mcp/`

- Transport: **Streamable HTTP** (what ChatGPT connectors require), via the official
  `@modelcontextprotocol/sdk`, mounted at `POST/GET /mcp`.
- Stateless per request; the OAuth token identifies the user (`req.user` equivalent).
- Tool inputs validated with zod (already used in the client).

### 3.2 Tools (what ChatGPT can call)

Keep the set small and LLM-friendly. ChatGPT does the "mood" thinking; our tools just find
and play.

| Tool | Kind | Purpose |
|---|---|---|
| `search_music(query, limit?, sources?)` | read-only | Search the XMusic library (title / artist / album) and YouTube. Returns compact results with ids. |
| `play(items[], mode?, shuffle?)` | write | Play songs. `items` = any mix of `{id}` (library id or `yt:<videoId>`) or `{query: "Someone Like You Adele"}` (server resolves). `mode` = `replace` (default) \| `next` \| `append`. |
| `control_playback(action)` | write | `pause`, `resume`, `next`, `previous`, `shuffle_on/off`, `repeat_off/all/one`. (Seek and volume later: they live in the Player component, not Redux.) |
| `get_now_playing()` | read-only | Current song, queue preview, playing/paused — reported by the browser. |
| `list_my_library(kind)` | read-only | `playlists` \| `liked` for the logged-in user. |
| `play_collection(type, id, shuffle?)` | write | Play a playlist, album, artist, or liked songs. |

Mark read-only tools with `readOnlyHint: true` so ChatGPT doesn't ask for confirmation on
every search; write tools will (ChatGPT may show a confirm step for them — expected).

Each tool returns both a short **text summary** ("Playing 10 songs, starting with …") and
**structuredContent** (JSON) so ChatGPT can talk about what's playing.

### 3.3 How "play some sad songs" resolves

There is no mood/genre metadata on `Song` today (`GenrePage` says browsing by genre isn't
available). So:

1. **ChatGPT interprets the mood.** It knows "sad" ≈ ballads, slow, heartbreak, and knows
   specific sad songs.
2. It calls `play({ items: [{query:"Someone Like You Adele"}, {query:"Fix You Coldplay"}, …] })`
   — or first `search_music("sad")` to see what's in your own library.
3. **Resolver** (`server/mcp/resolve.js`) for each item:
   1. `songId` → load from Mongo (skip if artist deactivated, same rule as suggestions).
   2. `query` → search the **local library first**; if no good match → `searchYouTube(query)`,
      take the top result.
   3. YouTube hits are turned into the same shape as the client's `youtubeResultToSong`
      (`_id: "yt:<videoId>"`, `source: "youtube"`) — **no DB write needed**.
4. Returns a list of full `SongType` objects → sent to the browser.

Later upgrade (optional): add `tags: [String]` / `mood` to `Song` so library-only mood
search works without YouTube.

### 3.4 Remote-control hub — `server/realtime/`

- **Socket.IO** attached to the same HTTP server. Chosen over raw SSE because it gives
  rooms, auto-reconnect, and request/ack (`emitWithAck`) out of the box.
- Browser authenticates with the existing `access_token` cookie (same check as
  `auth.middleware.js`) during the socket handshake.
- Each socket joins room `user:<userId>` and registers as a **device**:
  `{ socketId, label ("Chrome on Mac"), lastInteraction, canAutoplay, nowPlaying }`.
- **Target device** = the one with the most recent user interaction. (Multi-device picking
  can come later as a `list_devices` / `device` arg.)

**Command protocol** (server → browser), each with an ack and a ~5s timeout:

```
{ id, type: "play",    songs: SongType[], mode, shuffle }
{ id, type: "control", action, value }
```
Ack (browser → server): `{ id, ok: true, nowPlaying }` or
`{ id, ok: false, reason: "autoplay_blocked" | "not_found" | ... }`.

State push (browser → server, debounced): `nowPlaying` whenever `store.subscribe` sees
`song`/`isPlaying`/`queue` change. Kept in memory per device; used by `get_now_playing`.

### 3.5 Browser side — `client/src/lib/remote.ts`

- Started once from `AppLayout` when the user is logged in; disconnects on logout.
- Maps commands to **existing** Redux actions — no new player logic:
  - `play/replace` → the action that starts a list (as `Suggestions`/`Song` do today)
  - `play/next` → `playNext`, `play/append` → `addToQueue`
  - `pause/resume` → `setPlaying`, `next` → `nextSong`, `previous` → `prevSong`,
    shuffle/repeat → existing reducers, seek → engine handle
- Small UI cue: toast "Playing from ChatGPT" via `toastSlice`, and a "Connected to ChatGPT"
  indicator.

### 3.6 Auth — OAuth 2.1 (`server/oauth/`)

ChatGPT connects with OAuth: authorization code + PKCE (S256), dynamic client registration.

| Endpoint | Purpose |
|---|---|
| `/.well-known/oauth-protected-resource[/mcp]` | Tells ChatGPT where to authorize for `/mcp` (RFC 9728) |
| `/.well-known/oauth-authorization-server` | Auth server metadata (RFC 8414; also at the OpenID path) |
| `POST /oauth/register` | Dynamic client registration; https redirects only (http on localhost) |
| `GET /oauth/authorize` | Checks client, redirect URL, PKCE, scope → sends the browser to the web app's `/connect` page |
| `GET /oauth/requests/:id` · `POST …/decision` | What `/connect` shows; Allow / Deny (login cookie, XMusic origin only) |
| `POST /oauth/token` | Single-use code (60 s) → 1 h access token + 30 day refresh token; refresh rotates |
| `POST /oauth/revoke` | RFC 7009 |
| `GET /oauth/grants` · `DELETE /oauth/grants/:id` | Connected apps (account menu) |

- **Approval page** `/connect` (React, `client/src/pages/ConnectPage.tsx`): sends logged-out
  visitors through login (Google or password) and back via `?next=`, then shows the account,
  what the app may do, and Allow / Deny.
- **Scopes:** `music:read` (search, now playing, library) and `player:control` (play,
  play collection, controls). `/mcp` only offers the tools the token's scopes allow.
- **Tokens:** JWT access tokens (`sub` = user, `aud` = `<PUBLIC_URL>/mcp`, `gid` = grant) signed
  with a key derived from `JWT_SECRET`, so they can't be swapped with login cookies. Each
  `/mcp` request also checks the grant still exists, so Disconnect works immediately.
  Refresh tokens are stored hashed on the grant (`OAuthGrant`); reconnecting replaces it.
- **No token:** `/mcp` answers `401` + `WWW-Authenticate: Bearer resource_metadata=…`.
  `MCP_DEV_USER` still works without a token, but only for requests from this machine
  (not through a tunnel or proxy) and never with `NODE_ENV=production`.

## 4. End-to-end flow

```
You (ChatGPT):  "play some sad songs"
 1. ChatGPT → POST /mcp  tools/call search_music {query:"sad"}          (optional)
 2. ChatGPT → POST /mcp  tools/call play {items:[{query:"Someone Like You Adele"}, …], mode:"replace"}
 3. Server: bearer token → userId
 4. Resolver: library match or YouTube search per item → SongType[]
 5. Hub: pick target device in room user:<id> → emitWithAck("command", {type:"play", songs})
 6. Browser remote.ts → dispatch(play list) → AudioEngine/YouTubeEngine start
 7. Browser ack {ok:true, nowPlaying} → server
 8. Tool result → ChatGPT: "Now playing 'Someone Like You' — 8 more queued"
```

## 5. Failure cases the design must handle

| Situation | What the tool returns |
|---|---|
| No XMusic tab open | Error text: "Open XMusic in your browser and log in, then ask again." |
| **Browser autoplay block** — tab was never clicked, `play()` rejects | Ack `autoplay_blocked` → "Songs are queued. Click anywhere in the XMusic tab once to allow playback." The queue is still loaded, so one click starts it. |
| Browser didn't ack in 5s | "Your XMusic tab didn't respond — is it asleep?" |
| Query matched nothing | Skipped, listed in the result so ChatGPT can retry with a different query |
| YouTube video not embeddable | Existing `youtubeErrorMessage` path on the client skips to next; reported in `nowPlaying` |
| Token expired / revoked | 401 → ChatGPT refreshes or asks you to reconnect |

Autoplay is the biggest real-world gotcha: browsers only allow `audio.play()` / YouTube
playback after the page has had a user gesture. Once you've clicked the tab once, remote
plays work for the rest of that page session.

## 6. Making it reachable from ChatGPT

- ChatGPT must reach `/mcp` over **public HTTPS**. Local dev: a tunnel to the API port, e.g.
  `cloudflared tunnel --url http://localhost:3100`, and `PUBLIC_URL=https://<tunnel host>` in
  `server/.env` (restart the server). `PUBLIC_URL` is the OAuth issuer and the token audience.
- The browser keeps talking to `localhost`; only ChatGPT uses the tunnel. The `/connect`
  approval page opens on `CLIENT_URL` (the Vite app), so approve in the browser where you use
  XMusic.

### Connecting ChatGPT

1. Tunnel + `PUBLIC_URL` as above; restart the server.
2. ChatGPT → Settings → Apps & Connectors → Advanced → Developer mode on → Create:
   URL `https://<tunnel host>/mcp`, authentication **OAuth** (leave client id / secret empty:
   ChatGPT registers itself).
3. ChatGPT opens a popup → XMusic `/connect` → log in if needed → **Allow**.
4. Open XMusic in your browser, click the tab once, then in a chat with the connector
   enabled: *"play some sad songs"*.

A quick tunnel gets a new address on every start, and an OAuth connection is tied to its
address, so you'd reconnect each time. A named Cloudflare tunnel on your own domain keeps
it stable. Each YouTube search costs 100 of the API key's 10,000 daily units; results are
saved for 7 days, and YouTube links play without searching.

## 7. File layout

```
server/
  mcp/
    index.js          /mcp router: host check, bearer token / grant, Streamable HTTP transport
    tools.js          the six tools (offered per scope)
    resolve.js        items → SongType[] (library first, then best YouTube match; links directly)
    library.js        catalog queries, songs in the player's shape
    rank.js           YouTube results, official version first
  oauth/
    config.js         scopes, lifetimes, issuer, token signing
    metadata.js       /.well-known discovery documents
    routes.js         register, authorize, decision, token, revoke, grants
    rateLimit.js      per-IP limiter for register / token
  realtime/
    hub.js            Socket.IO setup, cookie auth, device registry, sendCommand()
    commands.js       command validation
  models/
    OAuthClient.js  OAuthRequest.js  OAuthCode.js  OAuthGrant.js  YouTubeSearch.js
  scripts/remote.js   npm run remote (terminal remote control)
  server.js           http server + hub, mounts /remote, /.well-known, /oauth, /mcp

client/src/
  lib/remote.ts                 socket connection, command → dispatch, state push
  pages/ConnectPage.tsx         /connect: Allow / Deny for ChatGPT
  pages/ConnectedAppsPage.tsx   /connected-apps: see and disconnect apps
  Layout/AppLayout.tsx          start/stop remote when logged in
```

Dependencies: server `@modelcontextprotocol/sdk`, `socket.io`, `cookie`, `zod`,
`google-auth-library`; client `socket.io-client`.

## 8. Build phases

1. **Remote control without ChatGPT** — Socket.IO hub + `remote.ts`; test by sending a
   command from a tiny dev script. Proves the hard part (server → browser → sound).
2. **MCP without auth** — `/mcp` with the tools, a fixed dev user id, test with MCP Inspector.
3. **OAuth** — well-known + register/authorize/token; connect from ChatGPT via tunnel.
4. **Polish** — device picking, optional `Song.tags` for mood,
   optional ChatGPT Apps SDK widget (a now-playing card rendered inside ChatGPT).

## 9. Open decisions

- **Mood source:** rely on ChatGPT + YouTube (recommended to start) vs. tagging your
  library with moods.
- **YouTube fallback on/off:** if you want ChatGPT to play *only* your uploaded catalog,
  `play` should never call `searchYouTube`.
- **Multiple tabs/devices:** "most recently used tab wins" (recommended) vs. explicit device
  selection.
