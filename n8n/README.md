# Quick Tender Automation & n8n Deployment Guide

This guide details how to host, run, and scale **n8n** alongside Quick Tender on an affordable Kenyan or international VPS (Truehost vs. HostAfrica), and how the automated multi-source pipeline functions.

---

## 1. Hosting n8n: Truehost vs. HostAfrica

Self-hosting n8n saves you the \$20/month (\$240/yr) n8n Cloud fee while giving you unlimited workflow executions, custom webhooks, and local database access.

### Comparison Table

| Metric | **Truehost Kenya** | **HostAfrica** |
|---|---|---|
| **Entry VPS Plan** | Silver VPS / Kenya VPS | Cloud VPS 1 |
| **Approx Cost** | KES 650 – KES 1,199 / mo | KES 1,200 – KES 1,800 / mo |
| **RAM** | 2GB – 4GB | 2GB – 4GB |
| **CPU Cores** | 1 – 2 vCPU | 1 – 2 vCPU |
| **Storage** | 30GB – 50GB NVMe / SSD | 30GB – 40GB SSD |
| **Data Center Location** | Nairobi (Local) or Europe | South Africa / Kenya / Germany |
| **Local Payment Methods** | M-Pesa, Card, Bank | M-Pesa, Card, PayPal |
| **Recommended For** | **Best Value for Budget & Local M-Pesa payments** | **High stability & enterprise-grade uptime** |

### Recommendation
- **Go with Truehost (Silver or Gold VPS with Ubuntu 22.04/24.04)** if you want direct M-Pesa billing, local server latency, and the lowest monthly cost. Note: Truehost even has a dedicated *"n8n self hosting"* template in their store catalog.
- Minimum recommended specs for running n8n reliably with PostgreSQL background queue: **2 GB RAM and 1-2 vCPUs**.

---

## 2. Fast 5-Minute Setup: n8n with Docker Compose on Ubuntu VPS

### Step 1: Connect to your VPS
```bash
ssh root@your-vps-ip
```

### Step 2: Install Docker & Docker Compose
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt install -y docker-compose-plugin
```

### Step 3: Create directory and `docker-compose.yml`
```bash
mkdir -p /opt/n8n && cd /opt/n8n
nano docker-compose.yml
```

Paste the following production-ready configuration:

```yaml
version: '3.8'

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=n8n.yourdomain.co.ke
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      - WEBHOOK_URL=https://n8n.yourdomain.co.ke/
      - GENERIC_TIMEZONE=Africa/Nairobi
      # Security & Secret tokens
      - QUICK_TENDER_API_URL=https://quicktender.co.ke
      - CRON_SECRET=your_configured_cron_secret
      - AFRICASTALKING_USERNAME=your_at_username
      - AFRICASTALKING_API_KEY=your_at_api_key
      - ADMIN_PHONE_NUMBER=+2547XXXXXXXX
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

### Step 4: Start n8n
```bash
docker compose up -d
```

### Step 5: (Optional) Expose via Caddy / Nginx with Free SSL
```bash
sudo apt install -y caddy
# In /etc/caddy/Caddyfile:
# n8n.yourdomain.co.ke {
#     reverse_proxy localhost:5678
# }
sudo systemctl restart caddy
```

---

## 3. Importing the Quick Tender Workflow into n8n

1. Open your n8n dashboard (`http://your-vps-ip:5678` or `https://n8n.yourdomain.co.ke`).
2. Go to **Workflows** → Click **Add Workflow** (top right) → Click the **`...`** (Options menu) → **Import from File**.
3. Select `n8n/quick-tender-discovery.json`.
4. Set the environment variables in n8n or fill them directly in the HTTP Request nodes:
   - `QUICK_TENDER_API_URL`: Your deployment domain (e.g. `https://quicktender.co.ke`).
   - `CRON_SECRET`: Must match `CRON_SECRET` in your Next.js `.env.local`.
   - `ADMIN_PHONE_NUMBER`: Phone number for match alerts.
5. Click **Save** and toggle the workflow to **Active**.

---

## 4. Multi-Source Pipeline Status

| Source | ID | Mechanism | Status | Notes |
|---|---|---|---|---|
| **PPIP (tenders.go.ke)** | `ppip` | CSV Import | Available | Client-side SPA; uses CSV path or URL |
| **Government Advertising Agency** | `gaa` | Live HTML Scraper | **Active** | 99+ notices fetched per run with direct PDF URLs |
| **Tenders Kenya** | `tenders-kenya` | Live Card Scraper | **Active** | 15+ latest notices with categories & closing dates |
| **TendersInfo** | `tendersinfo` | Direct Search API | **Active** | 50+ tenders per run via unauthenticated search endpoint |
| **TendersOnTime** | `tendersontime` | Live HTML Parser | **Active** | 10+ public notices with structured deadlines |
| **Kenya Tenders** | `kenyatenders` | Paywall Protected | Stubbed | Requires paid subscription account for notices |
| **TenderSoko** | `tendersoko` | Policy Prohibited | Stubbed | Prohibits scraping in `robots.txt` per project policy |
| **Nakuru County** | `county-nakuru` | WordPress REST API | Configurable | Enable via `TENDER_SOURCE_COUNTY_NAKURU=true` |
| **Nairobi & Kiambu** | `county-*` | TLS/Auth Stubs | Stubbed | Awaiting certificate & auth clearance |

---

## 5. Inua360 / TenderMaster Inspiration Adopted

1. **Autonomous Scheduled Polling**: n8n runs headless every 6 hours without human intervention.
2. **Deduplication Safeguards**: Tenders are indexed by `source_url` preventing duplicate scoring writes to Supabase.
3. **SMS / WhatsApp Instant Delivery**: The n8n branch sends Africa's Talking / WhatsApp notifications whenever high-matching tenders are inserted.
