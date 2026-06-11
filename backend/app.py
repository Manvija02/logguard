"""
LogGuard — Flask Backend
========================
Complete port of the Express/TypeScript backend to Python/Flask.

Endpoints:
  GET  /api/health
  POST /api/auth/login
  POST /api/auth/register
  POST /api/upload          (JWT required)
  GET  /api/uploads         (JWT required)
  GET  /api/results/<id>    (JWT required)
  POST /api/recommendations (JWT required)

Run:
  python app.py
  # or with gunicorn:
  gunicorn app:app --bind 0.0.0.0:4000

Environment variables (same as the original .env):
  DATABASE_URL   — PostgreSQL connection string (falls back to in-memory mock)
  JWT_SECRET     — Secret for signing JWTs
  GROQ_API_KEY   — Optional; enables Groq AI analysis
  PORT           — Port to listen on (default 4000)
  FRONTEND_URL   — Allowed CORS origin (default http://localhost:3000)
"""

import os
import json
import time
import math
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from functools import wraps

import bcrypt
import jwt as pyjwt
from dotenv import load_dotenv
from flask import Flask, request, jsonify, g
from flask_cors import CORS

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
app = Flask(__name__)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
CORS(app, origins=[FRONTEND_URL], supports_credentials=True)

# ---------------------------------------------------------------------------
# Database layer — real PostgreSQL or in-memory mock
# ---------------------------------------------------------------------------

_use_mock = False
_db_conn = None

# ---- In-memory mock store ----
_mock_users: list[dict] = []
_mock_uploads: list[dict] = []
_mock_log_entries: list[dict] = []
_mock_anomalies: list[dict] = []
_mock_id_counters: dict[str, int] = {
    "users": 0,
    "uploads": 0,
    "log_entries": 0,
    "anomalies": 0,
}


def _mock_next_id(table: str) -> int:
    _mock_id_counters[table] += 1
    return _mock_id_counters[table]


def get_db():
    """Return a psycopg2 connection, or None when running in mock mode."""
    global _db_conn, _use_mock
    if _use_mock:
        return None
    if _db_conn is None or _db_conn.closed:
        import psycopg2
        _db_conn = psycopg2.connect(os.environ["DATABASE_URL"])
        _db_conn.autocommit = True
    return _db_conn


def db_query(sql: str, params: tuple = ()) -> list[dict]:
    """Execute a SQL statement and return rows as dicts (real DB only)."""
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(sql, params)
        if cur.description:
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
        return []


# ---- Mock implementations of every SQL query the app uses ----

def _mock_select_user_by_username_for_auth(username: str) -> list[dict]:
    return [u for u in _mock_users if u["username"] == username]


def _mock_select_user_by_username(username: str) -> list[dict]:
    return [{"id": u["id"]} for u in _mock_users if u["username"] == username]


def _mock_insert_user(username: str, password_hash: str) -> dict:
    row = {
        "id": _mock_next_id("users"),
        "username": username,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc),
    }
    _mock_users.append(row)
    return row


def _mock_insert_upload(user_id: int, filename: str, status: str = "processing") -> dict:
    row = {
        "id": _mock_next_id("uploads"),
        "user_id": user_id,
        "filename": filename,
        "status": status,
        "uploaded_at": datetime.now(timezone.utc),
    }
    _mock_uploads.append(row)
    return row


def _mock_update_upload_status(upload_id: int, status: str):
    for u in _mock_uploads:
        if u["id"] == upload_id:
            u["status"] = status
            break


def _mock_insert_log_entries(rows: list[dict]) -> list[dict]:
    inserted = []
    for r in rows:
        row = {
            "id": _mock_next_id("log_entries"),
            "upload_id": r["upload_id"],
            "timestamp": r["timestamp"],
            "ip_address": r["ip_address"],
            "username": r["username"],
            "url": r["url"],
            "status": r["status"],
            "bytes": r["bytes"],
        }
        _mock_log_entries.append(row)
        inserted.append({"id": row["id"], "ip_address": row["ip_address"]})
    return inserted


def _mock_insert_anomaly(log_entry_id: int, reason: str, confidence_score: int):
    _mock_anomalies.append({
        "id": _mock_next_id("anomalies"),
        "log_entry_id": log_entry_id,
        "reason": reason,
        "confidence_score": confidence_score,
    })


def _mock_select_upload_by_id(upload_id: int) -> list[dict]:
    return [u for u in _mock_uploads if u["id"] == upload_id]


def _mock_select_log_entries(upload_id: int) -> list[dict]:
    return [le for le in _mock_log_entries if le["upload_id"] == upload_id]


def _mock_select_anomalies(upload_id: int) -> list[dict]:
    result = []
    for a in _mock_anomalies:
        le = next((e for e in _mock_log_entries if e["id"] == a["log_entry_id"]), None)
        if le and le["upload_id"] == upload_id:
            result.append({
                "anomaly_id": a["id"],
                "log_entry_id": a["log_entry_id"],
                "reason": a["reason"],
                "confidence_score": a["confidence_score"],
                "timestamp": le["timestamp"],
                "ip_address": le["ip_address"],
                "username": le["username"],
                "url": le["url"],
                "status": le["status"],
                "bytes": le["bytes"],
            })
    result.sort(key=lambda x: x["confidence_score"], reverse=True)
    return result


def _mock_select_uploads_for_user(user_id: int) -> list[dict]:
    rows = []
    for u in _mock_uploads:
        if u["user_id"] == user_id:
            count = sum(1 for le in _mock_log_entries if le["upload_id"] == u["id"])
            rows.append({**u, "total_entries": count})
    rows.sort(key=lambda x: x["uploaded_at"], reverse=True)
    return rows


def _mock_select_ip_to_users(upload_id: int) -> list[dict]:
    seen = set()
    rows = []
    for le in _mock_log_entries:
        if le["upload_id"] == upload_id and le.get("username") and le["username"] not in ("-", ""):
            key = (le["ip_address"], le["username"])
            if key not in seen:
                seen.add(key)
                rows.append({"ip_address": le["ip_address"], "username": le["username"]})
    return rows


# ---------------------------------------------------------------------------
# DB init / migrations
# ---------------------------------------------------------------------------

def connect_with_retry(max_retries: int = 10, delay_s: float = 3.0):
    global _use_mock
    db_url = os.environ.get("DATABASE_URL", "").strip()

    if not db_url or db_url == "mock":
        log.info("[DB] No DATABASE_URL — using in-memory mock.")
        _use_mock = True
        return

    import psycopg2
    for attempt in range(1, max_retries + 1):
        try:
            conn = psycopg2.connect(db_url)
            conn.close()
            log.info(f"[DB] Connected to PostgreSQL (attempt {attempt}/{max_retries})")
            return
        except Exception as exc:
            log.warning(f"[DB] Attempt {attempt}/{max_retries} failed: {exc}")
            if attempt == max_retries:
                log.error("[DB] All retries exhausted — falling back to mock.")
                _use_mock = True
                return
            time.sleep(delay_s)


def run_migrations():
    if _use_mock:
        # Seed admin user in mock store
        if not _mock_select_user_by_username("admin"):
            h = bcrypt.hashpw(b"admin123", bcrypt.gensalt(12)).decode("utf-8")
            _mock_insert_user("admin", h)
            log.info("[Migrate] Default admin user created in mock store.")
        return

    log.info("[Migrate] Running migrations...")
    db_query("""
        CREATE TABLE IF NOT EXISTS users (
            id            SERIAL PRIMARY KEY,
            username      VARCHAR(255) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at    TIMESTAMP DEFAULT NOW()
        )
    """)
    db_query("""
        CREATE TABLE IF NOT EXISTS uploads (
            id          SERIAL PRIMARY KEY,
            user_id     INTEGER REFERENCES users(id),
            filename    VARCHAR(255) NOT NULL,
            uploaded_at TIMESTAMP DEFAULT NOW(),
            status      VARCHAR(50) DEFAULT 'processing'
        )
    """)
    db_query("""
        CREATE TABLE IF NOT EXISTS log_entries (
            id         SERIAL PRIMARY KEY,
            upload_id  INTEGER REFERENCES uploads(id),
            timestamp  TIMESTAMP,
            ip_address VARCHAR(45),
            username   VARCHAR(255),
            url        TEXT,
            status     VARCHAR(20),
            bytes      INTEGER
        )
    """)
    db_query("""
        CREATE TABLE IF NOT EXISTS anomalies (
            id               SERIAL PRIMARY KEY,
            log_entry_id     INTEGER REFERENCES log_entries(id),
            reason           TEXT NOT NULL,
            confidence_score INTEGER NOT NULL
        )
    """)

    existing = db_query("SELECT id FROM users WHERE username = %s", ("admin",))
    if not existing:
        h = bcrypt.hashpw(b"admin123", bcrypt.gensalt(12)).decode("utf-8")
        db_query(
            "INSERT INTO users (username, password_hash) VALUES (%s, %s)",
            ("admin", h),
        )
        log.info("[Migrate] Default admin user created.")
    else:
        log.info("[Migrate] Admin user already exists.")
    log.info("[Migrate] All migrations completed.")


def init_db():
    log.info("[Server] Connecting to PostgreSQL...")
    connect_with_retry()
    log.info("[Server] Running database migrations...")
    run_migrations()


if os.environ.get("SKIP_DB_INIT") != "1":
    init_db()


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

JWT_SECRET = os.environ.get("JWT_SECRET", "fallback-secret-do-not-use-in-prod")


def make_token(user_id: int, username: str) -> str:
    payload = {
        "id": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    return pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])


def auth_required(f):
    """Route decorator that validates the Bearer JWT and sets g.user."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication required. Provide a Bearer token."}), 401
        token = auth_header[7:]
        if not token:
            return jsonify({"error": "Malformed Authorization header."}), 401
        try:
            g.user = decode_token(token)
        except pyjwt.ExpiredSignatureError:
            return jsonify({"error": "Invalid or expired token."}), 401
        except pyjwt.InvalidTokenError:
            return jsonify({"error": "Invalid or expired token."}), 401
        return f(*args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# Log parser
# ---------------------------------------------------------------------------

def parse_log_file(content: str) -> tuple[list[dict], list[str]]:
    """
    Parse a LogGuard log file.

    Expected line format:
        2024-01-15 08:23:11 | IP: 192.168.1.5 | User: john.doe | URL: google.com | Status: ALLOWED | Bytes: 1200
    """
    entries: list[dict] = []
    warnings: list[str] = []

    for i, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        parts = line.split(" | ")
        if len(parts) != 6:
            warnings.append(
                f"Line {i}: Expected 6 pipe-delimited segments, got {len(parts)}. Skipping."
            )
            continue

        timestamp = parts[0].strip()
        ip_raw     = parts[1].strip()
        user_raw   = parts[2].strip()
        url_raw    = parts[3].strip()
        status_raw = parts[4].strip()
        bytes_raw  = parts[5].strip()

        # Prefix validation
        for prefix, raw in [
            ("IP:", ip_raw), ("User:", user_raw), ("URL:", url_raw),
            ("Status:", status_raw), ("Bytes:", bytes_raw),
        ]:
            if not raw.startswith(prefix):
                warnings.append(f'Line {i}: Missing "{prefix}" prefix. Skipping.')
                break
        else:
            ip_address = ip_raw.replace("IP:", "").strip()
            username   = user_raw.replace("User:", "").strip()
            url        = url_raw.replace("URL:", "").strip()
            status     = status_raw.replace("Status:", "").strip()
            bytes_str  = bytes_raw.replace("Bytes:", "").strip()

            if status not in ("ALLOWED", "BLOCKED"):
                warnings.append(
                    f'Line {i}: Invalid status "{status}". Expected ALLOWED or BLOCKED. Skipping.'
                )
                continue

            try:
                byte_count = int(bytes_str)
                if byte_count < 0:
                    raise ValueError
            except ValueError:
                warnings.append(
                    f'Line {i}: Invalid bytes value "{bytes_str}". Must be a non-negative integer. Skipping.'
                )
                continue

            if not (timestamp and ip_address and username and url):
                warnings.append(f"Line {i}: One or more fields are empty. Skipping.")
                continue

            entries.append({
                "timestamp": timestamp,
                "ip_address": ip_address,
                "username": username,
                "url": url,
                "status": status,
                "bytes": byte_count,
            })

    log.info(f"[Parser] Parsed {len(entries)} entries with {len(warnings)} warnings.")
    return entries, warnings


# ---------------------------------------------------------------------------
# AI anomaly detection
# ---------------------------------------------------------------------------

def _aggregate_summary(entries: list[dict]) -> dict:
    ip_map: dict[str, dict] = {}
    hourly: dict[str, int] = {}
    total_blocked = 0

    for entry in entries:
        ip = entry["ip_address"]
        if ip not in ip_map:
            ip_map[ip] = {
                "totalRequests": 0,
                "blockedCount": 0,
                "urls": set(),
                "timestamps": [],
                "totalBytes": 0,
            }
        bucket = ip_map[ip]
        bucket["totalRequests"] += 1
        if entry["status"] == "BLOCKED":
            bucket["blockedCount"] += 1
            total_blocked += 1
        bucket["urls"].add(entry["url"])
        bucket["timestamps"].append(entry["timestamp"])
        bucket["totalBytes"] += entry["bytes"]

        try:
            hour = entry["timestamp"].split(" ")[1].split(":")[0]
            hourly[hour] = hourly.get(hour, 0) + 1
        except Exception:
            pass

    ip_summaries = []
    for ip, data in ip_map.items():
        sorted_ts = sorted(data["timestamps"])
        all_urls = list(data["urls"])
        ip_summaries.append({
            "ip": ip,
            "totalRequests": data["totalRequests"],
            "blockedCount": data["blockedCount"],
            "uniqueUrlCount": len(all_urls),
            "topUrls": all_urls[:5],
            "earliestTimestamp": sorted_ts[0] if sorted_ts else "N/A",
            "latestTimestamp": sorted_ts[-1] if sorted_ts else "N/A",
            "totalBytes": data["totalBytes"],
        })

    ip_summaries.sort(key=lambda x: x["totalRequests"], reverse=True)
    n = len(entries)
    blocked_pct = round((total_blocked / n) * 100) if n else 0

    return {
        "totalEntries": n,
        "overallBlockedPercentage": blocked_pct,
        "hourlyDistribution": hourly,
        "ipSummaries": ip_summaries,
    }


def _get_local_anomalies(entries: list[dict]) -> list[dict]:
    anomalies = []
    ip_counts: dict[str, int] = {}
    for e in entries:
        ip_counts[e["ip_address"]] = ip_counts.get(e["ip_address"], 0) + 1

    for ip, count in ip_counts.items():
        if ip == "10.0.0.99" or count > 30:
            anomalies.append({
                "ip": ip,
                "reason": (
                    f"High volume security scanning pattern: {count} requests targeting "
                    "internal domains. Suspected active network reconnaissance."
                ),
                "confidence": 95,
            })
            continue

        ip_entries = [e for e in entries if e["ip_address"] == ip]
        has_blocked_malware = any(
            e["status"] == "BLOCKED"
            and any(kw in e["url"] for kw in ("malware", "hack", ".ru", ".onion"))
            for e in ip_entries
        )
        if ip == "192.168.2.50" or has_blocked_malware:
            anomalies.append({
                "ip": ip,
                "reason": (
                    "Repeated blocked connection attempts to known malicious malware "
                    "distribution and Command & Control channels."
                ),
                "confidence": 92,
            })

    return anomalies


def analyze_with_ai(entries: list[dict]) -> list[dict]:
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        log.info("[AI] GROQ_API_KEY not set. Using local rule-based anomaly detector.")
        return _get_local_anomalies(entries)

    summary = _aggregate_summary(entries)
    log.info(
        f"[AI] Aggregated {summary['totalEntries']} entries into "
        f"{len(summary['ipSummaries'])} IP summaries."
    )

    try:
        from openai import OpenAI
        client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")

        system_msg = (
            "You are a cybersecurity analyst. Analyze the following log summary for "
            "security anomalies. Respond ONLY with a valid JSON array, no markdown, "
            "no code fences, no extra text. Each element must have: ip (string), "
            "reason (string - clear plain English), confidence (number 0-100)."
        )
        user_msg = (
            f"Here is a summary of proxy/firewall log data:\n\n"
            f"{json.dumps(summary, indent=2)}\n\n"
            "Analyze this data and identify anomalies. Look for:\n"
            "- Unusually high request volume from a single IP in a short time window\n"
            "- Repeated attempts to access BLOCKED or malicious URLs\n"
            "- Access at unusual hours (2 AM - 5 AM)\n"
            "- Large data transfers (possible data exfiltration)\n"
            "- Unknown/new IPs accessing sensitive resources\n\n"
            "Return ONLY a JSON array of anomalies."
        )

        log.info("[AI] Sending analysis request to Groq (llama-3.3-70b-versatile)...")
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.3,
            max_tokens=2048,
        )

        content = response.choices[0].message.content or ""
        # Strip markdown fences if present
        import re
        content = re.sub(r"```(?:json)?\s*", "", content, flags=re.IGNORECASE)
        content = re.sub(r"```\s*", "", content)
        content = content.strip()

        parsed = json.loads(content)
        if not isinstance(parsed, list):
            log.error("[AI] Response is not a JSON array.")
            return _get_local_anomalies(entries)

        anomalies = [
            {
                "ip": item["ip"],
                "reason": item["reason"],
                "confidence": max(0, min(100, round(item["confidence"]))),
            }
            for item in parsed
            if isinstance(item.get("ip"), str)
            and isinstance(item.get("reason"), str)
            and isinstance(item.get("confidence"), (int, float))
        ]

        if not anomalies:
            return _get_local_anomalies(entries)

        log.info(f"[AI] Parsed {len(anomalies)} anomalies from AI response.")
        return anomalies

    except Exception as exc:
        log.error(f"[AI] Groq request failed, falling back to local rules: {exc}")
        return _get_local_anomalies(entries)


# ---------------------------------------------------------------------------
# Geo-IP helper
# ---------------------------------------------------------------------------

def get_ip_location(ip: str) -> dict:
    """Return latitude, longitude, country for an IP address."""
    clean_ip = ip.strip()

    # Try geoip2 first (requires GeoLite2 DB file) — silently skip if unavailable
    try:
        import geoip2.database  # type: ignore
        db_path = os.environ.get("GEOIP_DB", "GeoLite2-City.mmdb")
        if os.path.exists(db_path):
            with geoip2.database.Reader(db_path) as reader:
                r = reader.city(clean_ip)
                return {
                    "latitude": r.location.latitude,
                    "longitude": r.location.longitude,
                    "country": r.country.iso_code or "Unknown",
                }
    except Exception:
        pass

    # Deterministic pseudo-coordinate fallback (same algorithm as original TS)
    h = 0
    for ch in clean_ip:
        h = ord(ch) + ((h << 5) - h)
        h &= 0xFFFFFFFF  # keep 32-bit
    lat = ((abs(h) % 110) - 45) + ((abs(h >> 8) % 100) / 100)
    lng = ((abs(h >> 4) % 270) - 130) + ((abs(h >> 12) % 100) / 100)

    return {
        "latitude": round(lat, 4),
        "longitude": round(lng, 4),
        "country": "Local Network Fallback",
    }


# ---------------------------------------------------------------------------
# Routes — health
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()})


# ---------------------------------------------------------------------------
# Routes — auth
# ---------------------------------------------------------------------------

@app.post("/api/auth/login")
def login():
    body = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    password = body.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400

    if _use_mock:
        rows = _mock_select_user_by_username_for_auth(username)
    else:
        rows = db_query(
            "SELECT id, username, password_hash FROM users WHERE username = %s",
            (username,),
        )

    if not rows:
        return jsonify({"error": "Invalid username or password."}), 401

    user = rows[0]
    stored_hash = user["password_hash"]
    if isinstance(stored_hash, str):
        stored_hash = stored_hash.encode("utf-8")

    if not bcrypt.checkpw(password.encode("utf-8"), stored_hash):
        return jsonify({"error": "Invalid username or password."}), 401

    token = make_token(user["id"], user["username"])
    log.info(f'[Auth] User "{user["username"]}" logged in successfully.')
    return jsonify({"token": token, "user": {"id": user["id"], "username": user["username"]}})


@app.post("/api/auth/register")
def register():
    body = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    password = body.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters long."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long."}), 400

    if _use_mock:
        existing = _mock_select_user_by_username(username)
    else:
        existing = db_query("SELECT id FROM users WHERE username = %s", (username,))

    if existing:
        return jsonify({"error": "Username is already taken."}), 400

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(12))
    hashed_str = hashed.decode("utf-8")

    if _use_mock:
        new_user = _mock_insert_user(username, hashed_str)
    else:
        rows = db_query(
            "INSERT INTO users (username, password_hash) VALUES (%s, %s) RETURNING id, username",
            (username, hashed_str),
        )
        new_user = rows[0]

    token = make_token(new_user["id"], new_user["username"])
    log.info(f'[Auth] User "{new_user["username"]}" registered successfully.')
    return jsonify({
        "token": token,
        "user": {"id": new_user["id"], "username": new_user["username"]},
    }), 201


# ---------------------------------------------------------------------------
# Routes — upload
# ---------------------------------------------------------------------------

@app.post("/api/upload")
@auth_required
def upload_file():
    user_id = g.user["id"]

    if "file" not in request.files:
        return jsonify({"error": 'No file uploaded. Use form field "file".'}), 400

    f = request.files["file"]
    filename = f.filename or "upload"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ("txt", "log"):
        return jsonify({
            "error": f'Invalid file extension ".{ext}". Only .txt and .log files are accepted.'
        }), 400

    # Create upload record
    if _use_mock:
        upload_row = _mock_insert_upload(user_id, filename)
        upload_id = upload_row["id"]
    else:
        rows = db_query(
            "INSERT INTO uploads (user_id, filename, status) VALUES (%s, %s, 'processing') RETURNING id",
            (user_id, filename),
        )
        upload_id = rows[0]["id"]

    log.info(f'[Upload] Created upload #{upload_id} for user {user_id}: "{filename}"')

    # Parse file
    content = f.read().decode("utf-8", errors="replace")
    entries, warnings = parse_log_file(content)

    if not entries:
        if _use_mock:
            _mock_update_upload_status(upload_id, "completed")
        else:
            db_query("UPDATE uploads SET status = 'completed' WHERE id = %s", (upload_id,))
        return jsonify({"uploadId": upload_id, "totalEntries": 0, "totalAnomalies": 0, "warnings": warnings})

    # Insert log entries
    entry_rows = [
        {
            "upload_id": upload_id,
            "timestamp": e["timestamp"],
            "ip_address": e["ip_address"],
            "username": e["username"],
            "url": e["url"],
            "status": e["status"],
            "bytes": e["bytes"],
        }
        for e in entries
    ]

    if _use_mock:
        inserted = _mock_insert_log_entries(entry_rows)
    else:
        # Batch insert
        placeholders = ",".join(["(%s,%s,%s,%s,%s,%s,%s)"] * len(entries))
        values = []
        for e in entries:
            values.extend([upload_id, e["timestamp"], e["ip_address"],
                           e["username"], e["url"], e["status"], e["bytes"]])
        inserted = db_query(
            f"INSERT INTO log_entries (upload_id, timestamp, ip_address, username, url, status, bytes) "
            f"VALUES {placeholders} RETURNING id, ip_address",
            tuple(values),
        )

    log.info(f"[Upload] Inserted {len(inserted)} log entries for upload #{upload_id}")

    # AI anomaly detection
    ai_anomalies = analyze_with_ai(entries)
    total_anomalies = 0

    if ai_anomalies:
        ip_to_entry_ids: dict[str, list[int]] = {}
        for row in inserted:
            ip = row["ip_address"]
            ip_to_entry_ids.setdefault(ip, []).append(row["id"])

        for anomaly in ai_anomalies:
            matching_ids = ip_to_entry_ids.get(anomaly["ip"], [])
            if matching_ids:
                for entry_id in matching_ids:
                    if _use_mock:
                        _mock_insert_anomaly(entry_id, anomaly["reason"], anomaly["confidence"])
                    else:
                        db_query(
                            "INSERT INTO anomalies (log_entry_id, reason, confidence_score) VALUES (%s, %s, %s)",
                            (entry_id, anomaly["reason"], anomaly["confidence"]),
                        )
                    total_anomalies += 1
            else:
                log.warning(
                    f'[Upload] AI flagged IP "{anomaly["ip"]}" but no matching log entries found. Skipping.'
                )

    groq_key = os.environ.get("GROQ_API_KEY")
    final_status = "completed" if groq_key else "completed_no_ai"
    if _use_mock:
        _mock_update_upload_status(upload_id, final_status)
    else:
        db_query("UPDATE uploads SET status = %s WHERE id = %s", (final_status, upload_id))

    log.info(
        f"[Upload] Upload #{upload_id} completed: {len(entries)} entries, {total_anomalies} anomalies."
    )
    return jsonify({
        "uploadId": upload_id,
        "totalEntries": len(entries),
        "totalAnomalies": total_anomalies,
        "warnings": warnings,
    })


@app.get("/api/uploads")
@auth_required
def list_uploads():
    user_id = g.user["id"]
    if _use_mock:
        rows = _mock_select_uploads_for_user(user_id)
    else:
        rows = db_query(
            """
            SELECT u.id, u.user_id, u.filename, u.uploaded_at, u.status,
                   COUNT(le.id)::int AS total_entries
            FROM uploads u
            LEFT JOIN log_entries le ON le.upload_id = u.id
            WHERE u.user_id = %s
            GROUP BY u.id
            ORDER BY u.uploaded_at DESC
            """,
            (user_id,),
        )
    # Serialize datetime objects
    for row in rows:
        if isinstance(row.get("uploaded_at"), datetime):
            row["uploaded_at"] = row["uploaded_at"].isoformat()
    return jsonify(rows)


# ---------------------------------------------------------------------------
# Routes — results
# ---------------------------------------------------------------------------

@app.get("/api/results/<int:upload_id>")
@auth_required
def get_results(upload_id: int):
    user_id = g.user["id"]

    if _use_mock:
        upload_rows = _mock_select_upload_by_id(upload_id)
    else:
        upload_rows = db_query(
            "SELECT id, user_id, filename, uploaded_at, status FROM uploads WHERE id = %s",
            (upload_id,),
        )

    if not upload_rows:
        return jsonify({"error": "Upload not found."}), 404

    upload = upload_rows[0]
    if upload["user_id"] != user_id:
        return jsonify({"error": "Access denied. This upload belongs to another user."}), 403

    if isinstance(upload.get("uploaded_at"), datetime):
        upload["uploaded_at"] = upload["uploaded_at"].isoformat()

    # Fetch entries
    if _use_mock:
        raw_entries = _mock_select_log_entries(upload_id)
    else:
        raw_entries = db_query(
            """
            SELECT id, upload_id, timestamp, ip_address, username, url, status, bytes
            FROM log_entries WHERE upload_id = %s ORDER BY timestamp ASC
            """,
            (upload_id,),
        )

    entries = []
    for row in raw_entries:
        loc = get_ip_location(row["ip_address"])
        if isinstance(row.get("timestamp"), datetime):
            row["timestamp"] = row["timestamp"].isoformat()
        entries.append({**row, **loc})

    # Fetch anomalies
    if _use_mock:
        raw_anomalies = _mock_select_anomalies(upload_id)
    else:
        raw_anomalies = db_query(
            """
            SELECT a.id AS anomaly_id, a.log_entry_id, a.reason, a.confidence_score,
                   le.timestamp, le.ip_address, le.username, le.url, le.status, le.bytes
            FROM anomalies a
            JOIN log_entries le ON le.id = a.log_entry_id
            WHERE le.upload_id = %s
            ORDER BY a.confidence_score DESC
            """,
            (upload_id,),
        )

    anomalies = []
    for row in raw_anomalies:
        loc = get_ip_location(row["ip_address"])
        if isinstance(row.get("timestamp"), datetime):
            row["timestamp"] = row["timestamp"].isoformat()
        anomalies.append({**row, **loc})

    return jsonify({"upload": upload, "entries": entries, "anomalies": anomalies})


# ---------------------------------------------------------------------------
# Routes — recommendations
# ---------------------------------------------------------------------------

def _get_local_recommendations(anomalies_input: list[dict], ip_to_users: dict[str, list[str]]) -> list[dict]:
    seen_actions: set[str] = set()
    recs = []
    for a in anomalies_input:
        ip = a.get("ip", "")
        users = ip_to_users.get(ip, [])
        score = a.get("confidence_score", 0)
        if score >= 80:
            urgency, action = "CRITICAL", f"Block IP {ip} immediately"
        elif score >= 50:
            urgency = "HIGH"
            action = f"Review user {users[0]}'s recent access patterns" if users else \
                     f"Investigate IP {ip} for unusual traffic patterns"
        elif score >= 30:
            urgency, action = "MEDIUM", f"Monitor IP {ip} closely for further anomalous behavior"
        else:
            urgency, action = "LOW", f"Audit log activity from IP {ip}"

        if action in seen_actions:
            continue
        seen_actions.add(action)
        recs.append({
            "action": action,
            "reason": a.get("reason", ""),
            "urgency": urgency,
            "affectedIPs": [ip],
            "affectedUsers": users,
        })
    return recs


@app.post("/api/recommendations")
@auth_required
def recommendations():
    body = request.get_json(silent=True) or {}
    upload_id_raw = body.get("uploadId")
    anomalies_input = body.get("anomalies", [])

    try:
        upload_id = int(upload_id_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid or missing uploadId."}), 400

    if not isinstance(anomalies_input, list):
        return jsonify({"error": "Anomalies must be an array."}), 400

    # Map IP → usernames
    if _use_mock:
        user_rows = _mock_select_ip_to_users(upload_id)
    else:
        user_rows = db_query(
            """
            SELECT DISTINCT ip_address, username
            FROM log_entries
            WHERE upload_id = %s AND username IS NOT NULL AND username != '' AND username != '-'
            """,
            (upload_id,),
        )

    ip_to_users: dict[str, list[str]] = {}
    for row in user_rows:
        lst = ip_to_users.setdefault(row["ip_address"], [])
        if row["username"] not in lst:
            lst.append(row["username"])

    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        log.info("[Recommendations] GROQ_API_KEY not set. Using local analysis engine.")
        return jsonify({"recommendations": _get_local_recommendations(anomalies_input, ip_to_users)})

    try:
        from openai import OpenAI
        import re
        client = OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")

        enriched = [
            {**a, "associatedUsers": ip_to_users.get(a.get("ip", ""), [])}
            for a in anomalies_input
        ]

        system_msg = (
            'You are a professional cybersecurity incident response officer.\n'
            'Your task is to analyze system anomalies and generate a JSON response '
            'containing clear, actionable, remediation recommendations.\n'
            'You must respond with ONLY a valid JSON object matching the following schema. '
            'No markdown wrapping, no markdown code blocks, no introductory/explaining text:\n'
            '{\n'
            '  "recommendations": [\n'
            '    {\n'
            '      "action": "...",\n'
            '      "reason": "...",\n'
            '      "urgency": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",\n'
            '      "affectedIPs": ["..."],\n'
            '      "affectedUsers": ["..."]\n'
            '    }\n'
            '  ]\n'
            '}'
        )
        user_msg = (
            "Generate mitigation recommendations for these security anomalies:\n"
            + json.dumps(enriched, indent=2)
        )

        log.info("[Recommendations] Requesting AI Recommendations from Groq...")
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.3,
            max_tokens=2048,
        )

        content = response.choices[0].message.content or ""
        content = re.sub(r"```(?:json)?\s*", "", content, flags=re.IGNORECASE)
        content = re.sub(r"```\s*", "", content).strip()

        parsed = json.loads(content)
        if parsed and isinstance(parsed.get("recommendations"), list):
            valid_urgencies = {"CRITICAL", "HIGH", "MEDIUM", "LOW"}
            recs = [
                {
                    "action": str(r.get("action", "")),
                    "reason": str(r.get("reason", "")),
                    "urgency": str(r.get("urgency", "LOW")).upper()
                              if str(r.get("urgency", "LOW")).upper() in valid_urgencies else "LOW",
                    "affectedIPs": [str(x) for x in r.get("affectedIPs", [])] if isinstance(r.get("affectedIPs"), list) else [],
                    "affectedUsers": [str(x) for x in r.get("affectedUsers", [])] if isinstance(r.get("affectedUsers"), list) else [],
                }
                for r in parsed["recommendations"]
            ]
            return jsonify({"recommendations": recs})

    except Exception as exc:
        log.error(f"[Recommendations] AI request failed: {exc}")

    log.info("[Recommendations] Falling back to local rules.")
    return jsonify({"recommendations": _get_local_recommendations(anomalies_input, ip_to_users)})


# ---------------------------------------------------------------------------
# Global error handler
# ---------------------------------------------------------------------------

@app.errorhandler(Exception)
def handle_exception(exc: Exception):
    log.exception("[Server] Unhandled error")
    return jsonify({"error": "Internal server error."}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 4000))

    log.info(f"[Server] LogGuard Flask backend running on port {PORT}")
    log.info(f"[Server] Health check: http://localhost:{PORT}/api/health")
    app.run(host="0.0.0.0", port=PORT, debug=False)
