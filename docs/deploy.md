# Deploying

Steps for the owner, in order. Agents can help once the owner has authorized the Vercel and Neon connectors, but real sign-in and real calls need the owner's OK.

Never put a secret in the repo, since it's public. Secrets go only in Vercel and GitHub.

## 1. Vercel project

- Import `bernardosevero/scroll-spark`, with **Root Directory** `apps/web`.
- Use Node 24. If the install uses the wrong pnpm version, set `ENABLE_EXPERIMENTAL_COREPACK=1`, since `package.json` pins it.
- `apps/web/vercel.json` runs `build:deploy`, which migrates the database on production builds only, then builds. A failed migration fails the build, so the running deployment stays up.

## 2. Production variables

Set these for **Production** only:

| Variable                                   | Value                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `APP_URL`                                  | `https://<production-domain>`, with no trailing slash                      |
| `BUFFER_CLIENT_ID`, `BUFFER_CLIENT_SECRET` | The **production** Buffer client, never the dev one                        |
| `DATABASE_URL`                             | The Neon `main` branch                                                     |
| `SECRET_KEY`                               | `openssl rand -base64 32`. Changing it signs everyone out.                 |
| `ANTHROPIC_API_KEY`                        | The key with a spend limit, funded through Dec 7                           |
| `EXTENSION_ORIGIN`                         | `chrome-extension://<id>`, once the store upload gives the extension an ID |

The first five are required: production refuses to start without them.

OAuth works on production and localhost only, because redirect URIs must match exactly. Previews can't sign in.

## 3. First deploy

- [ ] The build log shows migrations applied
- [ ] `https://<production-domain>/api/health` answers `{"status":"ok","database":"ok"}`. This is the first run of the Neon driver.
- [ ] Sign in with a real account
- [ ] On the dev client first, with a throwaway channel: try an example, analyze, save an idea, then save as draft, and check in Buffer that it **is a draft and not queued**
- [ ] A fresh Buffer account can do the same

## 4. Daily health check

It makes one tiny Claude call and one Buffer call each day, plus a database check. **This needs the owner's OK once**, then it runs on its own.

1. Find your user ID, from the Neon console: `select id, created_at from users;`.
2. In Vercel, set `HEALTH_SECRET` (`openssl rand -base64 32`) and `HEALTH_BUFFER_USER_ID`, then redeploy.
3. In GitHub, under Settings, Secrets and variables, Actions:
   - Secret `HEALTH_SECRET`, the same value
   - Variable `HEALTH_URL`, `https://<production-domain>/api/health/deep`
4. Run **Daily health check** by hand from the Actions tab. It should pass and show `"status":"ok"`.
5. **Test the warning:** change the GitHub secret to a wrong value, run it again, confirm the failure email arrives, then put the right value back. GitHub emails the person who last changed the workflow's schedule, so check your notification settings if nothing arrives.

The job does nothing until `HEALTH_URL` exists.

## 5. Extension

1. Build the zip with the production origin:
   ```bash
   WXT_API_ORIGIN=https://<production-domain> pnpm --filter @scroll-spark/extension exec wxt zip
   ```
2. Upload it to the Chrome Web Store, using [launch/store-listing.md](launch/store-listing.md).
3. Copy the listing's public key into `WXT_EXTENSION_KEY`, and rebuild, so unpacked and store versions share one ID.
4. Set `EXTENSION_ORIGIN` in Vercel and redeploy.
5. Attach the zip to a GitHub release, as the fallback.

## 6. After submitting

**Deploy freeze:** deploy only to fix something broken, so the app keeps matching the demo video. Keep testing on the dev client, since the production quota is shared with judges.
