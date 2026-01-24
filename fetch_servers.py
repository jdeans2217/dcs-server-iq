#!/usr/bin/env python3
"""Log in to digitalcombatsimulator.com and export the server list.

Usage:
  DCS_USERNAME=you DCS_PASSWORD=secret python fetch_servers.py --out servers.json
"""

import argparse
import json
import os
import re
import sys
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

URL = "https://www.digitalcombatsimulator.com/en/personal/server/#allservers"
def _clean(text: str) -> str:
    if text is None:
        return ""
    text = text.replace("\u00a0", " ")
    text = "".join(ch for ch in text if unicodedata.category(ch)[0] != "C")
    return " ".join(text.split()).strip()


def _debug(enabled: bool, message: str) -> None:
    if enabled:
        print(message, file=sys.stderr)


def _info(message: str) -> None:
    print(message, file=sys.stderr)


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


def _set_page_length(page, debug: bool) -> Optional[int]:
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
    if value:
        _debug(debug, f"Set page length to {value}")
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


def _extract_all_pages(page, timeout_ms: int, debug: bool) -> Optional[List[Dict[str, str]]]:
    all_rows: List[Dict[str, str]] = []
    seen = set()
    page_count = 0

    try:
        _wait_for_rows(page, timeout_ms)
    except PlaywrightTimeoutError:
        _debug(debug, "Timed out waiting for initial rows")
        return None

    signature = _page_signature(page)
    if _set_page_length(page, debug):
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
            _debug(debug, "Page length change did not update table")
        signature = _page_signature(page)

    while True:
        page_count += 1
        rows = _extract_table_data(page) or []
        rows = [row for row in rows if _row_has_data(row)]
        _debug(debug, f"Page {page_count}: {len(rows)} rows")
        for row in rows:
            key = json.dumps(row, sort_keys=True, ensure_ascii=True)
            if key not in seen:
                seen.add(key)
                all_rows.append(row)

        if not _has_next_page(page):
            break

        before = signature
        if not _go_next_page(page):
            _debug(debug, "Next page control not found")
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
            _debug(debug, "Pagination click did not change first row")
            break
        signature = _page_signature(page)

    _debug(debug, f"Pagination complete: pages={page_count}, rows={len(all_rows)}")
    return all_rows or None


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


def _extract_table_data(page) -> Optional[List[Dict[str, str]]]:
    """Extract server data from the visible table in the #allservers section."""
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


def _extract_json_rows(candidate: Any) -> Optional[List[Dict[str, Any]]]:
    if isinstance(candidate, list) and candidate and isinstance(candidate[0], dict):
        return candidate
    if isinstance(candidate, dict):
        for val in candidate.values():
            if isinstance(val, list) and val and isinstance(val[0], dict):
                return val
    return None


def _maybe_pick_json(candidate: Any, best: Tuple[int, Optional[Any]]) -> Tuple[int, Optional[Any]]:
    """Score JSON candidates, preferring the largest list of dicts."""
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch DCS server list after logging in.")
    parser.add_argument("--user", default=os.getenv("DCS_USERNAME"), help="DCS username (or set DCS_USERNAME)")
    parser.add_argument("--password", default=os.getenv("DCS_PASSWORD"), help="DCS password (or set DCS_PASSWORD)")
    parser.add_argument("--out", default="servers.json", help="Output JSON path")
    parser.add_argument("--raw", action="store_true", help="Write raw table data without normalization")
    parser.add_argument("--debug", action="store_true", help="Print debug information to stderr")
    parser.add_argument("--headful", action="store_true", help="Run with a visible browser window")
    parser.add_argument("--timeout", type=int, default=30000, help="Timeout in ms")
    parser.add_argument("--debug-html", action="store_true", help="Save HTML if extraction fails")

    args = parser.parse_args()

    debug = args.debug
    env_found, env_keys = _load_env()
    if debug:
        if env_found:
            keys = ", ".join(env_keys) if env_keys else "none"
            _debug(True, f"Loaded .env (new keys: {keys})")
        else:
            _debug(True, "No .env file found")

    if not args.user:
        args.user = os.getenv("DCS_USERNAME")
    if not args.password:
        args.password = os.getenv("DCS_PASSWORD")

    _info(f"Credentials present: user={'yes' if args.user else 'no'}, password={'yes' if args.password else 'no'}")

    if not args.user or not args.password:
        print("Missing credentials. Provide --user/--password or set DCS_USERNAME/DCS_PASSWORD.")
        return 2

    best_json: Tuple[int, Optional[Any]] = (-1, None)
    json_rows: List[Dict[str, Any]] = []
    json_seen = set()

    with sync_playwright() as p:
        _info(f"Launching Chromium (headless={not args.headful})")
        browser = p.chromium.launch(headless=not args.headful)
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
        _info(f"Navigating to {URL}")

        page.goto(URL, wait_until="domcontentloaded", timeout=args.timeout)
        try:
            page.wait_for_function("window.BX && typeof BX.bitrix_sessid === 'function'", timeout=5000)
        except PlaywrightTimeoutError:
            pass

        submitted = _submit_login_form(page, args.user, args.password)
        _info(f"Submitted login form: {submitted}")

        try:
            page.wait_for_load_state("networkidle", timeout=args.timeout)
        except PlaywrightTimeoutError:
            pass

        # Ensure we are on the server page after login.
        _info(f"Current URL after login: {page.url}")
        if "personal/server" not in page.url:
            page.goto(URL, wait_until="domcontentloaded", timeout=args.timeout)

        try:
            page.wait_for_selector("#allservers", timeout=args.timeout)
        except PlaywrightTimeoutError:
            pass

        data = _extract_all_pages(page, args.timeout, debug)
        _info(f"Table data extracted: {bool(data)}")

        if json_rows:
            _debug(debug, f"Captured JSON rows: {len(json_rows)}")

        if data is None and json_rows:
            data = json_rows
            _info("Using JSON rows captured from network responses")

        if data is None:
            # Fallback to the best JSON response we saw
            data = best_json[1]
            _info(f"Fallback JSON used: {bool(data)}")
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
            _info(f"Merged table rows with JSON rows: {len(data)} total")

        if data is None:
            if _login_form_is_visible(page):
                browser.close()
                print("Login appears to have failed (login form is visible). Check credentials.")
                return 3
            if args.debug_html:
                with open("servers_debug.html", "w", encoding="utf-8") as f:
                    f.write(page.content())
                print("Could not extract server data; saved servers_debug.html for inspection.")
            else:
                print("Could not extract server data. Try --debug-html to save the page.")
            browser.close()
            return 4

        if isinstance(data, dict):
            data_list: List[Dict[str, Any]] = [data]
        else:
            data_list = list(data)

        if not args.raw:
            data_list = [_normalize_row(row) for row in data_list]
            data_list = [row for row in data_list if _normalized_has_core_fields(row)]

        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(data_list, f, indent=2, ensure_ascii=False)

        browser.close()

    print(f"Wrote {args.out} ({len(data_list)} records)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
