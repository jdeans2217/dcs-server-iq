#!/usr/bin/env python3
"""
Standalone backup script for DCS server data.
Fetches server data and stores locally without touching PostgreSQL.

Usage:
    python backup_fetch.py --loop              # Run continuously (prompts for interval)
    python backup_fetch.py --loop --interval 30  # Run every 30 minutes
    python backup_fetch.py                     # Single fetch
    python backup_fetch.py --restore FILE      # Restore a backup file to PostgreSQL
    python backup_fetch.py --restore-all DIR   # Restore all backups from directory
    python backup_fetch.py --stats             # Show backup statistics

Requirements:
    pip install playwright
    playwright install chromium

Environment variables (or .env file):
    DCS_USERNAME=your_username
    DCS_PASSWORD=your_password
"""

import argparse
import json
import os
import gzip
import uuid
import re
import unicodedata
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Backup directory
BACKUP_DIR = Path(__file__).parent / "backups"

# Namespace UUID for generating deterministic server IDs
SERVER_UUID_NAMESPACE = uuid.UUID('a1b2c3d4-e5f6-7890-abcd-ef1234567890')

# DCS server list URL
URL = "https://www.digitalcombatsimulator.com/en/personal/server/#allservers"


def generate_server_id(ip: str, port: int) -> str:
    """Generate a deterministic UUID for a server based on IP:port."""
    key = f"{ip}:{port}"
    return str(uuid.uuid5(SERVER_UUID_NAMESPACE, key))


# ============================================================================
# Text cleaning and parsing utilities
# ============================================================================

def _clean(text: str) -> str:
    if text is None:
        return ""
    text = text.replace("\u00a0", " ")
    text = "".join(ch for ch in text if unicodedata.category(ch)[0] != "C")
    return " ".join(text.split()).strip()


def _load_env(path: str = ".env") -> Tuple[bool, List[str]]:
    if not os.path.exists(path):
        return False, []
    try:
        loaded: List[str] = []
        with open(path, "r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip("'").strip('"')
                if key and key not in os.environ:
                    os.environ[key] = value
                    loaded.append(key)
        return True, loaded
    except OSError:
        return False, []


def _parse_players(value: str) -> Tuple[Optional[int], Optional[int]]:
    if not value:
        return None, None
    value = _clean(value)
    match = re.search(r"(\d+)\s*/\s*(\d+)", value)
    if match:
        return int(match.group(1)), int(match.group(2))
    nums = re.findall(r"\d+", value)
    if len(nums) == 1:
        return int(nums[0]), None
    if len(nums) >= 2:
        return int(nums[0]), int(nums[1])
    return None, None


def _parse_hms(value: str) -> Optional[int]:
    if not value:
        return None
    cleaned = _clean(value)
    days = 0
    match = re.search(r"(\d+)\s*d", cleaned, re.IGNORECASE)
    if match:
        days = int(match.group(1))
        cleaned = cleaned.replace(match.group(0), "").strip()
    if not cleaned:
        return days * 86400 if days else None
    parts = cleaned.split(":")
    if not all(p.isdigit() for p in parts):
        return None
    nums = [int(p) for p in parts]
    if len(nums) == 3:
        return days * 86400 + nums[0] * 3600 + nums[1] * 60 + nums[2]
    if len(nums) == 2:
        return days * 86400 + nums[0] * 60 + nums[1]
    if len(nums) == 1:
        return days * 86400 + nums[0]
    return None


def _row_has_data(row: Dict[str, Any]) -> bool:
    return any(_clean(str(v)) for v in row.values() if v is not None)


def _normalized_has_core_fields(row: Dict[str, Any]) -> bool:
    return bool(row.get("server_name") or row.get("ip_address") or row.get("port"))


def _normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    lower = {_clean(str(k)).lower(): v for k, v in row.items()}

    def pick(*names: str) -> str:
        for name in names:
            key = name.strip().lower()
            if key in lower:
                val = lower[key]
                return _clean(str(val)) if val is not None else ""
        return ""

    server_name = pick("server name", "server_name", "servername", "name")
    ip_address = pick("ip address", "ip", "address", "host", "server ip")
    port_raw = pick("port", "server port")
    players_raw = pick("players", "slots")
    pass_raw = pick("pass.", "pass", "password", "password required", "locked")
    mission = pick("mission", "current mission", "scenario")
    mission_time = pick("mission time", "time", "uptime")
    description = pick("description", "desc")
    dcs_version = pick("dcs version", "version")

    if not server_name:
        server_name = pick("col1")
    if not description:
        description = pick("col2")
    if not dcs_version:
        dcs_version = pick("col3")
    if not ip_address:
        ip_address = pick("col4")
    if not port_raw:
        port_raw = pick("col5")
    if not players_raw:
        players_raw = pick("col6")
    if not pass_raw:
        pass_raw = pick("col7")
    if not mission:
        mission = pick("col8")
    if not mission_time:
        mission_time = pick("col9")

    try:
        port = int(port_raw) if port_raw else None
    except ValueError:
        port = None

    players_current, players_max = _parse_players(players_raw)

    pass_norm = pass_raw.strip().lower()
    if pass_norm in {"yes", "y", "true", "1"}:
        password_required = True
    elif pass_norm in {"no", "n", "false", "0", ""}:
        password_required = False
    else:
        password_required = None

    return {
        "server_name": server_name or None,
        "ip_address": ip_address or None,
        "port": port,
        "players_current": players_current,
        "players_max": players_max,
        "password_required": password_required,
        "description": description or None,
        "dcs_version": dcs_version or None,
        "mission": mission or None,
        "mission_time": mission_time or None,
        "mission_time_seconds": _parse_hms(mission_time),
    }


# ============================================================================
# Playwright browser automation
# ============================================================================

def _login_form_is_visible(page) -> bool:
    return bool(
        page.evaluate(
            """
            () => {
                const forms = Array.from(
                    document.querySelectorAll('form.bx_auth_form, form[name="system_auth_form"], form[action*="/personal/server/"]')
                );
                for (const form of forms) {
                    const user = form.querySelector('#USER_LOGIN, input[name="USER_LOGIN"]');
                    const passw = form.querySelector('#USER_PASSWORD, input[name="USER_PASSWORD"]');
                    if (!user || !passw) continue;
                    const style = window.getComputedStyle(form);
                    const visible = style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                    const userVisible = user.offsetParent !== null;
                    if (visible && userVisible) return true;
                }
                return false;
            }
            """
        )
    )


def _submit_login_form(page, user: str, password: str) -> bool:
    forms = page.query_selector_all(
        'form.bx_auth_form, form[name="system_auth_form"], form[action*="/personal/server/"]'
    )
    best = None
    for form in forms:
        has_user = form.query_selector('#USER_LOGIN, input[name="USER_LOGIN"]') is not None
        has_pass = form.query_selector('#USER_PASSWORD, input[name="USER_PASSWORD"]') is not None
        if not (has_user and has_pass):
            continue
        if form.is_visible():
            best = form
            break
        if best is None:
            best = form

    if best is None:
        return False

    best.evaluate(
        """
        (form, creds) => {
            const user = form.querySelector('#USER_LOGIN, input[name="USER_LOGIN"]');
            const passw = form.querySelector('#USER_PASSWORD, input[name="USER_PASSWORD"]');
            const sess = form.querySelector('input[name="sessid"]');
            if (sess && window.BX && typeof BX.bitrix_sessid === 'function') {
                sess.value = BX.bitrix_sessid();
            }
            if (user) user.value = creds.user;
            if (passw) passw.value = creds.password;
            const submit = form.querySelector(
                'input[type="submit"][name="Login"], button[type="submit"][name="Login"], button[type="submit"], input[type="submit"]'
            );
            if (submit) submit.click();
            else form.submit();
        }
        """,
        {"user": user, "password": password},
    )
    return True


def _wait_for_rows(page, timeout_ms: int) -> None:
    page.wait_for_function(
        """
        () => {
            const root = document.querySelector('#allservers') || document.body;
            const table = root.querySelector('#servers') || root.querySelector('table') || document.querySelector('#servers') || document.querySelector('table');
            if (!table) return false;
                const rows = Array.from(table.querySelectorAll('tbody tr'));
                if (!rows.length) return false;
                return rows.some(r => {
                    const cell = r.querySelector('td');
                    if (!cell) return false;
                    let text = (cell.innerText || cell.textContent || '').trim();
                    text = text.replace(/[\\x00-\\x1f\\x7f\\u200b-\\u200f\\ufeff]/g, '').trim();
                    return text.length > 0;
                });
            }
            """,
        timeout=timeout_ms,
    )


def _page_signature(page) -> str:
    return page.evaluate(
        """
        () => {
            const info = document.querySelector('#servers_info');
            const infoText = info ? info.innerText.trim() : '';
            const root = document.querySelector('#allservers') || document.body;
            const table = root.querySelector('#servers') || root.querySelector('table');
            const cell = table ? table.querySelector('tbody tr td') : null;
            let cellText = cell ? (cell.innerText || cell.textContent || '') : '';
            cellText = cellText.replace(/[\\x00-\\x1f\\x7f\\u200b-\\u200f\\ufeff]/g, '').trim();
            return `${infoText}|${cellText}`;
        }
        """
    )


def _set_page_length(page) -> Optional[int]:
    value = page.evaluate(
        """
        () => {
            const sel = document.querySelector('#servers_length select, select[name="servers_length"]');
            if (!sel) return null;
            const vals = Array.from(sel.options)
                .map(o => parseInt(o.value, 10))
                .filter(v => Number.isFinite(v));
            if (!vals.length) return null;
            const max = Math.max(...vals);
            if (sel.value !== String(max)) {
                sel.value = String(max);
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return max;
        }
        """
    )
    return value


def _has_next_page(page) -> bool:
    return bool(
        page.evaluate(
            """
            () => {
                const li = document.querySelector('#servers_next');
                if (!li) return false;
                return !li.classList.contains('disabled');
            }
            """
        )
    )


def _go_next_page(page) -> bool:
    return bool(
        page.evaluate(
            """
            () => {
                if (window.jQuery && window.jQuery.fn && window.jQuery.fn.dataTable) {
                    const table = window.jQuery('#servers').DataTable();
                    table.page('next').draw('page');
                    return true;
                }
                const a = document.querySelector('#servers_next a');
                if (!a) return false;
                a.click();
                return true;
            }
            """
        )
    )


def _extract_table_data(page) -> Optional[List[Dict[str, str]]]:
    """Extract server data from the visible table."""
    return page.evaluate(
        """
        () => {
            const root = document.querySelector('#allservers') || document.body;
            const table = root.querySelector('#servers') || root.querySelector('table') || document.querySelector('#servers') || document.querySelector('table');
            if (!table) return null;

            const headers = Array.from(table.querySelectorAll('thead th, thead td')).map(th =>
                (th.innerText || th.textContent || '').trim()
            );
            const clean = (value) => {
                if (!value) return '';
                return String(value)
                    .replace(/[\\x00-\\x1f\\x7f\\u200b-\\u200f\\ufeff]/g, '')
                    .replace(/\\u00a0/g, ' ')
                    .trim();
            };
            const cellText = (td) => {
                const text = (td.innerText || '').trim()
                    || (td.textContent || '').trim()
                    || (td.getAttribute('data-value') || '').trim()
                    || (td.getAttribute('title') || '').trim();
                return clean(text);
            };

            const rows = [];
            const trs = Array.from(table.querySelectorAll('tbody tr'));
            for (const tr of trs) {
                if (tr.classList.contains('child')) {
                    const prev = rows[rows.length - 1];
                    if (!prev) continue;
                    const items = tr.querySelectorAll('li');
                    items.forEach(li => {
                        const title = clean(li.querySelector('.dtr-title')?.innerText || '');
                        const data = clean(li.querySelector('.dtr-data')?.innerText || '');
                        if (!title) return;
                        if (!prev[title] || !String(prev[title]).trim()) {
                            prev[title] = data;
                        }
                    });
                    continue;
                }

                const cells = Array.from(tr.querySelectorAll('td'));
                if (!cells.length) continue;
                const obj = {};
                cells.forEach((td, idx) => {
                    const key = headers[idx] || `col${idx + 1}`;
                    obj[key] = cellText(td);
                });
                rows.push(obj);
            }

            if (!rows.length) return null;
            return rows;
        }
        """
    )


def _extract_all_pages(page, timeout_ms: int) -> Optional[List[Dict[str, str]]]:
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

    all_rows: List[Dict[str, str]] = []
    seen = set()

    try:
        _wait_for_rows(page, timeout_ms)
    except PlaywrightTimeoutError:
        return None

    signature = _page_signature(page)
    if _set_page_length(page):
        try:
            page.wait_for_function(
                "(prev) => {"
                "const info = document.querySelector('#servers_info');"
                "const infoText = info ? info.innerText.trim() : '';"
                "const root = document.querySelector('#allservers') || document.body;"
                "const table = root.querySelector('#servers') || root.querySelector('table');"
                "const cell = table ? table.querySelector('tbody tr td') : null;"
                "let cellText = cell ? (cell.innerText || cell.textContent || '') : '';"
                "cellText = cellText.replace(/[\\x00-\\x1f\\x7f\\u200b-\\u200f\\ufeff]/g, '').trim();"
                "const sig = `${infoText}|${cellText}`;"
                "return sig !== prev;"
                "}",
                arg=signature,
                timeout=timeout_ms,
            )
        except PlaywrightTimeoutError:
            pass
        signature = _page_signature(page)

    while True:
        rows = _extract_table_data(page) or []
        rows = [row for row in rows if _row_has_data(row)]
        for row in rows:
            key = json.dumps(row, sort_keys=True, ensure_ascii=True)
            if key not in seen:
                seen.add(key)
                all_rows.append(row)

        if not _has_next_page(page):
            break

        before = signature
        if not _go_next_page(page):
            break
        try:
            page.wait_for_load_state("networkidle", timeout=timeout_ms)
        except PlaywrightTimeoutError:
            pass
        try:
            page.wait_for_function(
                "(prev) => {"
                "const info = document.querySelector('#servers_info');"
                "const infoText = info ? info.innerText.trim() : '';"
                "const root = document.querySelector('#allservers') || document.body;"
                "const table = root.querySelector('#servers') || root.querySelector('table');"
                "const cell = table ? table.querySelector('tbody tr td') : null;"
                "let cellText = cell ? (cell.innerText || cell.textContent || '') : '';"
                "cellText = cellText.replace(/[\\x00-\\x1f\\x7f\\u200b-\\u200f\\ufeff]/g, '').trim();"
                "const sig = `${infoText}|${cellText}`;"
                "return sig !== prev;"
                "}",
                arg=before,
                timeout=timeout_ms,
            )
        except PlaywrightTimeoutError:
            break
        signature = _page_signature(page)

    return all_rows or None


def _extract_json_rows(candidate: Any) -> Optional[List[Dict[str, Any]]]:
    if isinstance(candidate, list) and candidate and isinstance(candidate[0], dict):
        return candidate
    if isinstance(candidate, dict):
        for val in candidate.values():
            if isinstance(val, list) and val and isinstance(val[0], dict):
                return val
    return None


def _maybe_pick_json(candidate: Any, best: Tuple[int, Optional[Any]]) -> Tuple[int, Optional[Any]]:
    score, best_data = best
    if isinstance(candidate, list) and candidate and isinstance(candidate[0], dict):
        if len(candidate) > score:
            return len(candidate), candidate
    if isinstance(candidate, dict):
        for key, val in candidate.items():
            if isinstance(val, list) and val and isinstance(val[0], dict):
                if len(val) > score:
                    return len(val), val
    return best


# ============================================================================
# Main fetch function
# ============================================================================

def fetch_servers_data() -> List[Dict[str, Any]]:
    """Fetch server data from DCS website using Playwright."""
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

    # Load credentials
    _load_env()
    user = os.getenv("DCS_USERNAME")
    password = os.getenv("DCS_PASSWORD")

    if not user or not password:
        raise ValueError("Missing credentials. Set DCS_USERNAME and DCS_PASSWORD in environment or .env file")

    print(f"[{datetime.now()}] Fetching server data...")

    timeout_ms = 30000
    best_json: Tuple[int, Optional[Any]] = (-1, None)
    json_rows: List[Dict[str, Any]] = []
    json_seen = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        def _add_json_rows(rows: List[Dict[str, Any]]) -> None:
            for row in rows:
                key = json.dumps(row, sort_keys=True, ensure_ascii=True)
                if key in json_seen:
                    continue
                json_seen.add(key)
                json_rows.append(row)

        def on_response(resp):
            nonlocal best_json
            try:
                ct = resp.headers.get("content-type", "")
                if "application/json" not in ct:
                    return
                data = resp.json()
                best_json = _maybe_pick_json(data, best_json)
                rows = _extract_json_rows(data)
                if rows:
                    _add_json_rows(rows)
            except Exception:
                return

        page.on("response", on_response)

        page.goto(URL, wait_until="domcontentloaded", timeout=timeout_ms)
        try:
            page.wait_for_function("window.BX && typeof BX.bitrix_sessid === 'function'", timeout=5000)
        except PlaywrightTimeoutError:
            pass

        submitted = _submit_login_form(page, user, password)

        try:
            page.wait_for_load_state("networkidle", timeout=timeout_ms)
        except PlaywrightTimeoutError:
            pass

        if "personal/server" not in page.url:
            page.goto(URL, wait_until="domcontentloaded", timeout=timeout_ms)

        try:
            page.wait_for_selector("#allservers", timeout=timeout_ms)
        except PlaywrightTimeoutError:
            pass

        data = _extract_all_pages(page, timeout_ms)

        if data is None and json_rows:
            data = json_rows

        if data is None:
            data = best_json[1]
        elif json_rows and len(json_rows) > len(data):
            merged_seen = set()
            merged: List[Dict[str, Any]] = []
            for row in data + json_rows:
                key = json.dumps(row, sort_keys=True, ensure_ascii=True)
                if key in merged_seen:
                    continue
                merged_seen.add(key)
                merged.append(row)
            data = merged

        if data is None:
            if _login_form_is_visible(page):
                browser.close()
                raise Exception("Login failed - check credentials")
            browser.close()
            raise Exception("Could not extract server data")

        if isinstance(data, dict):
            data_list: List[Dict[str, Any]] = [data]
        else:
            data_list = list(data)

        # Normalize rows
        data_list = [_normalize_row(row) for row in data_list]
        data_list = [row for row in data_list if _normalized_has_core_fields(row)]

        browser.close()

    return data_list


# ============================================================================
# Backup storage functions
# ============================================================================

def save_backup(servers: list, backup_dir: Path = BACKUP_DIR) -> Path:
    """Save server data to a timestamped backup file."""
    now = datetime.now(timezone.utc)

    # Create directory structure: backups/YYYY/MM/DD/
    date_dir = backup_dir / now.strftime("%Y") / now.strftime("%m") / now.strftime("%d")
    date_dir.mkdir(parents=True, exist_ok=True)

    # Filename: HH-MM-SS.json.gz
    filename = now.strftime("%H-%M-%S") + ".json.gz"
    filepath = date_dir / filename

    # Generate deterministic IDs and prepare snapshots
    snapshots = []
    for server in servers:
        ip = server.get("ip_address", "")
        port = server.get("port", 0)
        server_id = generate_server_id(ip, port)
        server["id"] = server_id

        snapshot = {
            "server_id": server_id,
            "captured_at": now.isoformat(),
            "players_current": server.get("players_current", 0),
            "players_max": server.get("players_max"),
            "mission": server.get("mission"),
            "mission_time_secs": server.get("mission_time_seconds"),
            "is_online": True,
        }
        snapshots.append(snapshot)

    backup_data = {
        "metadata": {
            "captured_at": now.isoformat(),
            "captured_at_unix": int(now.timestamp()),
            "server_count": len(servers),
            "total_players": sum(s.get("players_current", 0) or 0 for s in servers),
            "version": "1.0",
        },
        "servers": servers,
        "snapshots": snapshots,
    }

    with gzip.open(filepath, 'wt', encoding='utf-8') as f:
        json.dump(backup_data, f, indent=None, separators=(',', ':'))

    # Update latest.json.gz symlink
    latest_path = backup_dir / "latest.json.gz"
    if latest_path.exists():
        latest_path.unlink()
    try:
        rel_path = filepath.relative_to(backup_dir)
        latest_path.symlink_to(rel_path)
    except OSError:
        import shutil
        shutil.copy(filepath, latest_path)

    return filepath


def load_backup(filepath: Path) -> dict:
    """Load a backup file."""
    if str(filepath).endswith('.gz'):
        with gzip.open(filepath, 'rt', encoding='utf-8') as f:
            return json.load(f)
    else:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)


def restore_to_postgres(backup_data: dict, dry_run: bool = False):
    """Restore backup data to PostgreSQL (ADDITIVE ONLY)."""
    import psycopg2
    from psycopg2.extras import execute_values

    DB_CONFIG = {
        "host": os.getenv("PGHOST", "localhost"),
        "port": int(os.getenv("PGPORT", "5432")),
        "database": os.getenv("PGDATABASE", "dcs"),
        "user": os.getenv("PGUSER", "postgres"),
        "password": os.getenv("PGPASSWORD"),
    }

    servers = backup_data.get("servers", [])
    snapshots = backup_data.get("snapshots", [])
    metadata = backup_data.get("metadata", {})

    print(f"Restoring backup from {metadata.get('captured_at', 'unknown')}")
    print(f"  Servers: {len(servers)}")
    print(f"  Snapshots: {len(snapshots)}")
    print(f"  Mode: ADDITIVE ONLY (won't overwrite newer data)")

    if dry_run:
        print("  [DRY RUN] Would restore to database")
        return

    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cur:
            if servers:
                server_cols = [
                    'id', 'server_name', 'ip_address', 'port', 'players_current', 'players_max',
                    'password_required', 'terrain', 'era', 'game_mode', 'framework',
                    'discord_url', 'srs_address', 'mission', 'dcs_version', 'description',
                    'mission_time_secs', 'language', 'website_url', 'tacview_address',
                    'gci_url', 'qq_group', 'teamspeak_address', 'last_seen'
                ]

                server_values = []
                for s in servers:
                    row = tuple(s.get(col) for col in server_cols)
                    server_values.append(row)

                upsert_sql = f"""
                    INSERT INTO servers ({', '.join(server_cols)})
                    VALUES %s
                    ON CONFLICT (id) DO UPDATE SET
                        server_name = EXCLUDED.server_name,
                        players_current = EXCLUDED.players_current,
                        players_max = EXCLUDED.players_max,
                        mission = EXCLUDED.mission,
                        mission_time_secs = EXCLUDED.mission_time_secs,
                        last_seen = EXCLUDED.last_seen
                    WHERE servers.last_seen IS NULL
                       OR EXCLUDED.last_seen > servers.last_seen
                """

                execute_values(cur, upsert_sql, server_values, page_size=500)
                print(f"  Servers: inserted new / updated only if newer")

            if snapshots:
                snapshot_cols = ['server_id', 'captured_at', 'players_current', 'players_max',
                                 'mission', 'mission_time_secs', 'is_online']

                snapshot_values = []
                for s in snapshots:
                    row = (
                        s.get('server_id'),
                        s.get('captured_at'),
                        s.get('players_current', 0),
                        s.get('players_max'),
                        s.get('mission'),
                        s.get('mission_time_secs'),
                        s.get('is_online', True),
                    )
                    snapshot_values.append(row)

                insert_sql = f"""
                    INSERT INTO server_snapshots ({', '.join(snapshot_cols)})
                    VALUES %s
                    ON CONFLICT DO NOTHING
                """

                execute_values(cur, insert_sql, snapshot_values, page_size=500)
                print(f"  Snapshots: inserted new only (duplicates skipped)")

        conn.commit()
        print("  Restore complete!")

    finally:
        conn.close()


def restore_directory(dir_path: Path, dry_run: bool = False):
    """Restore all backup files from a directory."""
    backup_files = sorted(dir_path.rglob("*.json.gz"))

    print(f"Found {len(backup_files)} backup files in {dir_path}")

    for i, filepath in enumerate(backup_files, 1):
        print(f"\n[{i}/{len(backup_files)}] {filepath}")
        try:
            backup_data = load_backup(filepath)
            restore_to_postgres(backup_data, dry_run=dry_run)
        except Exception as e:
            print(f"  ERROR: {e}")


def get_backup_stats(backup_dir: Path = BACKUP_DIR):
    """Get statistics about stored backups."""
    if not backup_dir.exists():
        return {"exists": False}

    backup_files = list(backup_dir.rglob("*.json.gz"))

    if not backup_files:
        return {"exists": True, "count": 0}

    dates = []
    total_size = 0
    for f in backup_files:
        total_size += f.stat().st_size
        try:
            parts = f.relative_to(backup_dir).parts
            if len(parts) >= 4:
                date_str = f"{parts[0]}-{parts[1]}-{parts[2]} {parts[3].replace('.json.gz', '').replace('-', ':')}"
                dates.append(date_str)
        except:
            pass

    return {
        "exists": True,
        "count": len(backup_files),
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "earliest": min(dates) if dates else None,
        "latest": max(dates) if dates else None,
        "backup_dir": str(backup_dir),
    }


# ============================================================================
# Main execution
# ============================================================================

def run_once():
    """Run a single backup fetch."""
    try:
        servers = fetch_servers_data()
        if servers:
            filepath = save_backup(servers)
            print(f"[{datetime.now()}] Backup saved: {filepath}")
            print(f"  Servers: {len(servers)}")
            print(f"  Size: {filepath.stat().st_size / 1024:.1f} KB")
            return True
        else:
            print(f"[{datetime.now()}] ERROR: No server data fetched")
            return False
    except Exception as e:
        print(f"[{datetime.now()}] ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_loop(interval_minutes: int):
    """Run backup fetches in a continuous loop."""
    import time
    import signal

    running = True

    def handle_signal(signum, frame):
        nonlocal running
        print(f"\n[{datetime.now()}] Received signal {signum}, shutting down...")
        running = False

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    print(f"[{datetime.now()}] Starting backup loop (every {interval_minutes} minutes)")
    print(f"  Backup directory: {BACKUP_DIR}")
    print(f"  Press Ctrl+C to stop\n")

    fetch_count = 0
    error_count = 0

    while running:
        fetch_count += 1
        print(f"--- Fetch #{fetch_count} ---")

        if run_once():
            pass
        else:
            error_count += 1

        if not running:
            break

        next_run = datetime.now().replace(microsecond=0) + timedelta(minutes=interval_minutes)
        print(f"  Next fetch at: {next_run.strftime('%H:%M:%S')}\n")

        sleep_seconds = interval_minutes * 60
        for _ in range(sleep_seconds):
            if not running:
                break
            time.sleep(1)

    print(f"\n[{datetime.now()}] Shutdown complete")
    print(f"  Total fetches: {fetch_count}")
    print(f"  Errors: {error_count}")


def main():
    parser = argparse.ArgumentParser(description="DCS Server Data Backup Tool (Standalone)")
    parser.add_argument("--restore", type=Path, help="Restore a backup file to PostgreSQL")
    parser.add_argument("--restore-all", type=Path, help="Restore all backups from directory")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually write to database")
    parser.add_argument("--stats", action="store_true", help="Show backup statistics")
    parser.add_argument("--loop", action="store_true", help="Run continuously in a loop")
    parser.add_argument("--interval", type=int, help="Minutes between fetches (for --loop mode)")

    args = parser.parse_args()

    if args.stats:
        stats = get_backup_stats()
        print(json.dumps(stats, indent=2))
        return

    if args.restore:
        backup_data = load_backup(args.restore)
        restore_to_postgres(backup_data, dry_run=args.dry_run)
        return

    if args.restore_all:
        restore_directory(args.restore_all, dry_run=args.dry_run)
        return

    if args.loop:
        if args.interval:
            interval = args.interval
        else:
            while True:
                try:
                    user_input = input("How many minutes between fetches? [default: 60]: ").strip()
                    if not user_input:
                        interval = 60
                    else:
                        interval = int(user_input)
                    if interval < 1:
                        print("Interval must be at least 1 minute")
                        continue
                    break
                except ValueError:
                    print("Please enter a valid number")

        run_loop(interval)
        return

    # Default: single fetch
    if not run_once():
        return 1

    return 0


if __name__ == "__main__":
    exit(main() or 0)
