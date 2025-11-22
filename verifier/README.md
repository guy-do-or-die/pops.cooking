# Pops Verifier

FastAPI-based verifier for Pops recordings (audio chirps + video strobes), packaged as a Docker image and deployable into an Oasis ROFL TEE.

This README covers:

- Running the verifier locally with `uvicorn`.
- Building and running the Docker image.
- How it is wired into the web app in dev.
- A high-level overview of ROFL deployment and where to find the public proxy URL.

---

## 1. Run verifier locally (uvicorn)

This is the easiest way to debug and iterate on the verifier logic.

### Prerequisites

- Python 3.11+
- `ffmpeg` installed and available on `PATH`.

### Steps

From the `verifier/` directory:

```bash
cd verifier

python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Check that the server is up:

```bash
curl http://localhost:8000/health
# -> {"status": "ok", "tee_mode": true}
```

You can now hit `/verify` directly (see the web app section below for how it calls the API).

---

## 2. Build and run the Docker image locally

The verifier is normally run via the Docker image defined in `Dockerfile`.

### Build

From `verifier/`:

```bash
cd verifier

docker build -t pops-verifier:latest .
```

### Run

```bash
docker run --rm -p 8000:8000 pops-verifier:latest
```

Verify the container is responding:

```bash
curl http://localhost:8000/health
# -> {"status": "ok", "tee_mode": true}
```

If port `8000` is already in use, pick another host port, e.g.:

```bash
docker run --rm -p 8001:8000 pops-verifier:latest
curl http://localhost:8001/health
```

---

## 3. Using the verifier from the web app (dev)

The web frontend talks to the verifier via a `/api` proxy.

In `web/vite.config.ts`:

```ts
proxy: {
  '/api': {
    target: process.env.VITE_VERIFIER_URL || 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
},
```

So, to run the web app against a **local** verifier on port 8000:

```bash
cd web
VITE_VERIFIER_URL=http://localhost:8000 npm run dev
```

The frontend will then:

- Call `POST /api/verify` → `http://localhost:8000/verify`.
- Call `GET /api/health` → `http://localhost:8000/health`.

This setup is ideal for debugging `audio.py`, `video.py`, and `server.py` while watching `uvicorn` logs.

---

## 4. ROFL TEE deployment (overview)

The verifier can be deployed into an Oasis ROFL TEE using the `rofl.yaml` manifest and the `compose.yaml` Docker Compose file.

Key files:

- `rofl.yaml` – ROFL app manifest (resources, artifacts, network, etc.).
- `compose.yaml` – defines the `pops-verifier` service and exposes port `8000`.
- `verifier.*.orc` – ORC bundle artifacts used by ROFL.

### High-level flow

1. **Build/push Docker image** (for TEE):

   ```bash
   cd verifier
   docker build -t docker.io/<your-docker-username>/pops .
   docker push docker.io/<your-docker-username>/pops
   ```

   Make sure `compose.yaml` references the same image.

2. **Prepare/verify `rofl.yaml`:**

   - Check resources (memory, vCPUs, storage) fit the target machine.
   - Ensure the `artifacts` section points to the correct ORC and compose file.

3. **Use the `oasis rofl` CLI** to build and deploy (consult `oasis rofl --help` for exact flags and workflows):

   - Build and update the app from `rofl.yaml`.
   - Create a deployment (e.g. named `test`).
   - Provision a machine for that deployment.

4. **Inspect the running machine:**

   ```bash
   oasis rofl machine show --deployment <DEPLOYMENT_NAME>
   ```

   This prints, among other details, a `Proxy` section similar to:

   ```text
   Proxy:
     Domain: m1098.opf-testnet-rofl-25.rofl.app
     Ports from compose file:
       8000 (pops-verifier): https://p8000.m1098.opf-testnet-rofl-25.rofl.app
   ```

   The public HTTPS URL for the verifier is then:

   - `https://p8000.<MACHINE_DOMAIN>.opf-testnet-rofl-25.rofl.app`
   - e.g. `https://p8000.m1098.opf-testnet-rofl-25.rofl.app`

5. **Test the TEE verifier:**

   ```bash
   curl https://p8000.<MACHINE_DOMAIN>.opf-testnet-rofl-25.rofl.app/health
   # -> {"status":"ok","tee_mode":true}
   ```

### Frontend → ROFL wiring (prod)

In production, the web app should proxy `/api/*` to the ROFL verifier URL. This is handled via the deployment configuration (e.g. `web/vercel.json`), which rewrites:

- `/api/:path*` → `https://p8000.<MACHINE_DOMAIN>.opf-testnet-rofl-25.rofl.app/:path*`

so the frontend can keep calling `/api/verify`, independent of whether the verifier is local, behind ngrok, or in the ROFL TEE.

---

This file is meant as a quick reference so you don't have to reconstruct the steps for local debugging, Docker, and ROFL deployment each time.