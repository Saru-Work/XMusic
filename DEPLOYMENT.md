# XMusic – Production Deployment

This is how XMusic runs in production on an Ubuntu 24.04 VPS with Nginx, PM2, a MongoDB instance on the same server and Let's Encrypt certificates.

| Part                            | URL / location                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Frontend (React + Vite, static) | `https://xmusic.datameld.org`                                                         |
| Backend API + Socket.IO + MCP   | `https://xmusic-api.datameld.org`                                                     |
| ChatGPT MCP endpoint            | `https://xmusic-api.datameld.org/mcp`                                                 |
| App checkout                    | `/var/www/apps/XMusic`                                                                |
| Server env file (secrets)       | `/var/www/shared/env/xmusic/server.env` → linked as `server/.env`                     |
| Uploaded files                  | `/var/www/shared/data/xmusic/uploads` → linked as `server/uploads`                    |
| PM2 logs                        | `/var/www/logs/xmusic/`                                                               |
| Nginx sites                     | `/etc/nginx/sites-available/xmusic.datameld.org.conf`, `xmusic-api.datameld.org.conf` |

Secrets and uploads are stored **outside the repository**, so `git pull`, `git clean` or re-cloning can't touch them.

---

## Updating the deployment

**Automatic:** every push to `main` runs `.github/workflows/deploy.yml`. It checks that the client builds, then connects over SSH and runs `/var/www/shared/scripts/deploy-xmusic.sh`, which is a copy of `deploy/deploy.sh`. You can also start it by hand from the Actions tab (**Run workflow**). Deploy logs are written to `/var/www/logs/xmusic/deploy.log`.

The SSH key the workflow uses can **only** run that script, because the key entry in `authorized_keys` forces it with `command=`. Required repository secrets (store them in the `production` environment): `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`.

If you change `deploy/deploy.sh`, reinstall it on the server yourself after pulling:
`install -m 750 deploy/deploy.sh /var/www/shared/scripts/deploy-xmusic.sh`

**Manual:**

```bash
cd /var/www/apps/XMusic && git pull \
  && (cd server && npm ci) \
  && (cd client && npm ci && npm run build) \
  && pm2 restart xmusic-api
```

The server reads `server/.env` every time it starts, so a plain `pm2 restart` picks up any changes to the env file.

---

## Server layout (reusable for other apps)

```
/var/www/apps/<app>/                   git checkout only
/var/www/shared/env/<app>/server.env   secrets (dir 700, file 600)
/var/www/shared/data/<app>/            persistent data (uploads, etc.)
/var/www/shared/backups/               config backups
/var/www/logs/<app>/                   PM2 logs
```

Give each app its own subdomain(s) and its own local port (XMusic uses 3000).

---

## First-time setup

### 1. DNS

Add A records for `xmusic` and `xmusic-api` that point to the VPS IP. Don't change the records for the root domain or `www`.

### 2. MongoDB

MongoDB runs on the same server (`127.0.0.1:27017`) with authorization enabled. The app uses a dedicated user that can only read and write the `xmusic` database:

```javascript
// as the admin user, in mongosh
use xmusic
db.createUser({user:"xmusic_app", pwd:passwordPrompt(), roles:[{role:"readWrite",db:"xmusic"}]})
```

Test the login. Use `--password` with **no value after it**, so mongosh prompts for the password:

```bash
mongosh --host 127.0.0.1 --username xmusic_app --authenticationDatabase xmusic --password
```

### 3. Shared folders and symlinks

```bash
sudo install -d -o deploy -g deploy -m 700 /var/www/shared/env/xmusic
sudo install -d -o deploy -g deploy -m 755 /var/www/shared/data/xmusic/uploads/{images,audio} /var/www/logs/xmusic
cd /var/www/apps/XMusic
ln -s /var/www/shared/data/xmusic/uploads server/uploads
printf '/server/uploads\n/client/.env.production\n' >> .git/info/exclude
```

### 4. Environment files

`/var/www/shared/env/xmusic/server.env` (mode 600), linked with `ln -s /var/www/shared/env/xmusic/server.env server/.env`:

```env
NODE_ENV=production
PORT=3000
SERVER_URL=https://xmusic-api.datameld.org
CLIENT_URL=https://xmusic.datameld.org
MONGO_URI=mongodb://xmusic_app:<URL-ENCODED-PASSWORD>@127.0.0.1:27017/xmusic?authSource=xmusic
JWT_SECRET=<output of: openssl rand -hex 48>
YOUTUBE_API_KEY=
GOOGLE_CLIENT_ID=
PUBLIC_URL=https://xmusic-api.datameld.org
MCP_DEV_USER=
```

Notes:

- `PUBLIC_URL` **must** be set in production. The `/mcp` endpoint only accepts requests whose host is `localhost` or the host in `PUBLIC_URL`. If it's empty, ChatGPT gets `403`.
- `MCP_DEV_USER` stays empty. It's ignored anyway when `NODE_ENV=production`.
- `XMUSIC_EMAIL` / `XMUSIC_PASSWORD` / `XMUSIC_API` are only used by the `npm run remote` dev tool, so they aren't needed on the server.
- URL-encode the MongoDB password if it contains special characters:
  `node -e 'console.log(encodeURIComponent(process.argv[1]))' '<password>'`

`client/.env.production`:

```env
VITE_API_URL=https://xmusic-api.datameld.org
```

### 5. Install and build

```bash
(cd server && npm ci)
(cd client && npm ci && npm run build)   # output: client/dist
```

### 6. PM2

```bash
cd /var/www/apps/XMusic/server
pm2 start server.js --name xmusic-api --cwd /var/www/apps/XMusic/server --time \
  -o /var/www/logs/xmusic/out.log -e /var/www/logs/xmusic/error.log --max-memory-restart 700M
pm2 save
sudo env PATH="$PATH:$(dirname "$(which node)")" "$(which pm2)" startup systemd -u deploy --hp "$HOME"
```

PM2 must start the server from `server/`, because `dotenv` loads `.env` from the folder the process starts in.

### 7. Nginx

Add this once in `/etc/nginx/conf.d/websocket-map.conf`. It's shared by every app on the server:

```nginx
map $http_upgrade $connection_upgrade { default upgrade; "" close; }
```

`/etc/nginx/sites-available/xmusic.datameld.org.conf`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name xmusic.datameld.org;
    root /var/www/apps/XMusic/client/dist;
    index index.html;
    access_log /var/log/nginx/xmusic.access.log;
    error_log  /var/log/nginx/xmusic.error.log;
    location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; try_files $uri =404; }
    location / { try_files $uri $uri/ /index.html; }
}
```

`/etc/nginx/sites-available/xmusic-api.datameld.org.conf`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name xmusic-api.datameld.org;
    client_max_body_size 100M;
    access_log /var/log/nginx/xmusic-api.access.log;
    error_log  /var/log/nginx/xmusic-api.error.log;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 3600s;
        proxy_send_timeout 300s;
        proxy_request_buffering off;
    }
}
```

Enable both sites, then test the config before reloading:

```bash
sudo ln -s /etc/nginx/sites-available/xmusic.datameld.org.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/xmusic-api.datameld.org.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 8. HTTPS

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d xmusic.datameld.org -d xmusic-api.datameld.org --redirect
sudo certbot renew --dry-run
```

### 9. Google sign-in (optional)

In Google Cloud Console → Credentials → your OAuth client, add `https://xmusic.datameld.org` under **Authorized JavaScript origins**. If it's missing, Google shows `Error 400: origin_mismatch`.

### 10. ChatGPT (MCP)

In ChatGPT (Developer mode), add a connector with the URL `https://xmusic-api.datameld.org/mcp` and OAuth authentication, then approve it on the XMusic `/connect` page. Keep an XMusic tab open, because the tools control the player in that tab.

---

## Checks

```bash
pm2 status && pm2 logs xmusic-api --lines 20 --nostream
curl -s -o /dev/null -w "%{http_code}\n" https://xmusic.datameld.org/                        # 200
curl -s "https://xmusic-api.datameld.org/socket.io/?EIO=4&transport=polling" | head -c 30    # 0{"sid":...
curl -s https://xmusic-api.datameld.org/.well-known/oauth-protected-resource                 # JSON metadata
curl -s -i -X POST https://xmusic-api.datameld.org/mcp -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}' \
  | grep -iE '^HTTP|www-authenticate'                                                       # 401 + WWW-Authenticate
```

## Backups

- Database: `mongodump --host 127.0.0.1 --username mongoAdmin --authenticationDatabase admin --password --db xmusic --out /var/www/shared/backups/mongo-$(date +%F)`
- Uploads: `tar czf /var/www/shared/backups/xmusic-uploads-$(date +%F).tar.gz -C /var/www/shared/data/xmusic uploads`

## Troubleshooting

| Symptom                               | Cause / fix                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `mongosh ... --password xmusic` fails | A word right after `--password` is taken as the password. Leave the value off so mongosh prompts. |
| `/mcp` returns 403                    | `PUBLIC_URL` is empty or doesn't match the API domain.                                            |
| Google `origin_mismatch`              | The frontend origin isn't listed in the Google OAuth client.                                      |
| Upload fails with 413                 | The file is larger than Nginx's `client_max_body_size` (100M).                                    |
| API returns 502                       | The API isn't running. Check `pm2 status` and `/var/www/logs/xmusic/error.log`.                   |
