# LogGuard - AI-Powered Security Log Analyzer

LogGuard is a full-stack cybersecurity web application that allows security analysts to upload Zscaler-style web proxy log files, automatically parses them, and leverages AI to detect security anomalies. It provides a rich dashboard with charts, tables, and AI-generated security narratives.

![Tech Stack](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![Tech Stack](https://img.shields.io/badge/Flask-3.1-green?style=flat-square&logo=flask)
![Tech Stack](https://img.shields.io/badge/PostgreSQL-15-blue?style=flat-square&logo=postgresql)
![Tech Stack](https://img.shields.io/badge/Groq_AI-llama--3.3--70b-orange?style=flat-square)
![Tech Stack](https://img.shields.io/badge/Docker-Compose-blue?style=flat-square&logo=docker)

---

##  Quick Start (Docker)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- A free [Groq API key](https://console.groq.com/keys) (optional — the app works without it, but AI analysis will be skipped)

### Step-by-Step Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd logguard
   ```

2. **Create your environment file**
   ```bash
   cp backend/.env.example backend/.env
   ```

3. **Add your Groq API key** (optional but recommended)
   
   Open `.env` and replace `your_groq_api_key_here` with your actual Groq API key:
   ```
   GROQ_API_KEY=gsk_your_actual_key_here
   ```
   
   > Get a free key at: https://console.groq.com/keys

4. **Start the entire application**
   ```bash
   docker-compose up --build
   ```
   
   This single command starts:
   - PostgreSQL database (port 5432)
   - Express backend API (port 4000)
   - Next.js frontend (port 3000)

5. **Open the app**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

6. **Log in with default credentials**
   ```
   Username: admin
   Password: admin123
   ```

7. **Test with sample logs**
   
   Upload any of the files from the following:
   - `normal.log` — Normal browsing traffic (no anomalies expected)
   - `attack.log` — High-volume scanning attack from a single IP
   - `malware.log` — Repeated attempts to access blocked malicious URLs


---

## How AI Is Used

### Model
LogGuard uses **Groq's `llama-3.3-70b-versatile`** model via the Groq API for AI-powered anomaly detection. Groq provides a free API tier with fast inference. The integration is in `backend/app.py` — functions `analyze_with_ai()` and the recommendations route at `POST /api/recommendations`.

### Where AI Is Invoked

| Location in code | Triggered by | What it does |
|---|---|---|
| `analyze_with_ai()` in `app.py` | `POST /api/upload` | Detects anomalous IPs and behaviors from log data |
| `POST /api/recommendations` route | Frontend recommendations panel | Generates actionable SOC remediation steps per anomaly |

### How Anomaly Detection Works

1. **Log Parsing** — `parse_log_file()` in `app.py` parses each line into structured entries: `timestamp`, `ip_address`, `username`, `url`, `status` (ALLOWED/BLOCKED), `bytes`.

2. **Data Aggregation** — `_aggregate_summary()` in `app.py` pre-processes the entries before sending to the LLM. Instead of forwarding raw log lines (which would exceed token limits), the function:
   - Groups entries by IP address
   - Computes per-IP stats: total requests, blocked count, unique URLs visited, timestamps, total bytes
   - Computes hourly request distribution across all IPs

3. **AI Prompt** — The aggregated summary is sent to `llama-3.3-70b-versatile` via Groq with a structured prompt asking the model to identify:
   - Unusually high request volume from a single IP in a short window
   - Repeated attempts to access BLOCKED or malicious URLs
   - Access at unusual hours (2 AM – 5 AM)
   - Large data transfers (possible exfiltration)
   - Unknown/new IPs accessing sensitive resources

4. **Structured JSON Output** — The model is instructed to return **only** a JSON array with no markdown. Each element contains:
   - `ip` — The flagged IP address
   - `reason` — Plain-English explanation of why it's suspicious
   - `confidence` — Score from 0–100 indicating certainty

5. **Response Handling** — The backend strips any accidental markdown fences from the response and wraps parsing in a try/except. If the AI call fails or returns malformed JSON, the upload still completes successfully using the rule-based fallback below.

### Rule-Based Fallback

If no `GROQ_API_KEY` is set, `_get_local_anomalies()` runs instead. It flags any IP with more than 30 requests as a high-volume anomaly. This ensures the app is fully functional without an API key.

### Where to Put the API Key

Add your Groq API key to `backend/.env`:
```
GROQ_API_KEY=gsk_your_key_here
```

The key is loaded via `python-dotenv` and accessed through `os.environ.get("GROQ_API_KEY")`.

---

## Project Structure

```
logguard/
├── frontend/                # Next.js 14 (App Router) + TailwindCSS
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/       # Login page
│   │   │   ├── upload/      # File upload page
│   │   │   └── results/     # Results dashboard
│   │   └── components/      # Reusable components (Navbar, Globe, etc.)
│   ├── Dockerfile
│   └── package.json
│
├── backend/                 # Flask (Python) API
│   ├── app.py               # Entire backend: routes, AI, parsing, DB
│   ├── requirements.txt
|   |── .env.example
│   └── Dockerfile
│
|
├── normal.log           # Normal traffic
├── attack.log           # High-volume IP scanning attack
|── malware.log          # Blocked malicious URL attempts
│
├── docker-compose.yml       # Runs all three services with one command
└── README.md                # This file
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Create a new account |
| POST | `/api/auth/login` | ❌ | Authenticate and receive JWT |
| POST | `/api/upload` | ✅ | Upload and analyze a log file |
| GET | `/api/uploads` | ✅ | List past uploads for current user |
| GET | `/api/results/:uploadId` | ✅ | Get parsed entries + anomalies |
| POST | `/api/recommendations` | ✅ | Get AI-generated SOC remediation steps |
| GET | `/api/health` | ❌ | Health check |

---

## Dashboard Features

- **Security Summary** — Total entries, anomalies, blocked requests, top IPs
- **Charts** (Recharts):
  - Requests per hour (bar chart)
  - Top 10 visited domains (bar chart)
  - ALLOWED vs BLOCKED ratio (pie chart)
- **Log Table** — All entries with anomalous rows highlighted in red
- **Anomaly Details** — Expandable panels showing AI reasoning and confidence scores
- **SOC Timeline** — AI-summarized narrative of key security events

---

## Database Schema

```sql
-- User accounts
users (id, username, password_hash, created_at)

-- File upload records
uploads (id, user_id, filename, uploaded_at, status)

-- Parsed log entries
log_entries (id, upload_id, timestamp, ip_address, username, url, status, bytes)

-- AI-detected anomalies
anomalies (id, log_entry_id, reason, confidence_score)
```

---

## Stopping the Application

```bash
docker-compose down
```

To also remove the database data:
```bash
docker-compose down -v
```

---

## Log Format Supported

ZScaler-style web proxy logs:
```
2024-01-15 08:23:11 | IP: 192.168.1.5 | User: john.doe | URL: google.com | Status: ALLOWED | Bytes: 1200
```

Fields: `timestamp`, `IP address`, `username`, `URL`, `status` (ALLOWED/BLOCKED), `bytes`

---

## Notes

- The Groq free tier has rate limits. If you get rate-limited, wait a minute and try again.
- The app gracefully handles missing API keys, invalid log lines, and AI failures.
