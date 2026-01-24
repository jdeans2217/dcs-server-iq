#!/usr/bin/env python3
"""Ingest server data from JSON into PostgreSQL with enrichment.

Usage:
    python ingest_servers.py --input servers.json
    python ingest_servers.py --input servers.json --snapshot  # Also create snapshot records
"""

import argparse
import hashlib
import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import psycopg2
from psycopg2.extras import execute_values, Json


# Database connection settings
DB_CONFIG = {
    "host": os.getenv("PGHOST", "localhost"),
    "port": int(os.getenv("PGPORT", "5432")),
    "database": os.getenv("PGDATABASE", "dcs"),
    "user": os.getenv("PGUSER", "postgres"),
    "password": os.getenv("PGPASSWORD"),
}


# =============================================================================
# Enrichment Patterns
# =============================================================================

# Terrain detection (multilingual)
TERRAIN_PATTERNS = {
    "caucasus": [
        r"\bcaucasus\b", r"\bкавказ\b", r"\b高加索\b", r"\bgeorgia\b",
        r"\bbatumi\b", r"\bkutaisi\b", r"\btbilisi\b", r"\bsenaki\b",
        r"\bblack\s*sea\b", r"\b黑海\b"
    ],
    "syria": [
        r"\bsyria\b", r"\bсирия\b", r"\b叙利亚\b", r"\bdamascus\b",
        r"\blatakia\b", r"\bramat\b", r"\bincirlik\b"
    ],
    "persian_gulf": [
        r"\bpersian\s*gulf\b", r"\bpg\b", r"\bpersian\b", r"\b波斯湾\b",
        r"\bdubai\b", r"\bstraight?\s*of\s*hormuz\b", r"\bbandar\b", r"\bal.dhafra\b"
    ],
    "marianas": [
        r"\bmarianas?\b", r"\bguam\b", r"\bsaipan\b", r"\b马里亚纳\b"
    ],
    "nevada": [
        r"\bnevada\b", r"\bnttr\b", r"\bnellis\b", r"\blas\s*vegas\b", r"\b内华达\b"
    ],
    "kola": [
        r"\bkola\b", r"\bкола\b", r"\bmurmansk\b"
    ],
    "sinai": [
        r"\bsinai\b", r"\b西奈\b", r"\begypt\b"
    ],
    "channel": [
        r"\bchannel\b", r"\bnormandy\b", r"\b英吉利\b"
    ],
    "falklands": [
        r"\bfalklands?\b", r"\bsouth\s*atlantic\b", r"\bmalvinas\b"
    ],
    "afghanistan": [
        r"\bafghanistan\b", r"\b阿富汗\b"
    ],
}

# Framework detection
FRAMEWORK_PATTERNS = {
    "foothold": [r"\bfoothold\b"],
    "pretense": [r"\bpretense\b"],
    "tti": [r"\btti\b", r"\bthrough\s*the\s*inferno\b"],
    "grayflag": [r"\bgray\s*flag\b", r"\bgrayflag\b"],
    "blueflag": [r"\bblue\s*flag\b", r"\bblueflag\b"],
    "liberation": [r"\bliberation\b"],
    "rotorheads": [r"\brotor\s*heads?\b"],
    "persian_war": [r"\bpersian\s*war\b"],
}

# Era detection
ERA_PATTERNS = {
    "wwii": [
        r"\bwwii\b", r"\bww2\b", r"\bworld\s*war\s*(ii|2)\b", r"\b1940s?\b",
        r"\bp-51\b", r"\bp-47\b", r"\bbf-?109\b", r"\bfw-?190\b", r"\bspitfire\b",
        r"\b二战\b"
    ],
    "cold_war": [
        r"\bcold\s*war\b", r"\b80s?\b", r"\b1980s?\b", r"\b70s\b",
        r"\bmig-?21\b", r"\bmig-?23\b", r"\bf-?5\b", r"\bf-?4\b", r"\bphantom\b",
        r"\b冷战\b"
    ],
    "modern": [
        r"\bmodern\b", r"\bf-?16\b", r"\bf-?18\b", r"\bf-?15\b", r"\bsu-?27\b",
        r"\bsu-?33\b", r"\bfa-?18\b", r"\bf/a-?18\b", r"\bhornet\b", r"\bviper\b",
        r"\b现代\b"
    ],
}

# Game mode detection
MODE_PATTERNS = {
    "pvp": [r"\bpvp\b", r"\bversus\b", r"\b对抗\b", r"\bcompetitive\b", r"\bdogfight\b"],
    "pve": [r"\bpve\b", r"\bcoop\b", r"\bco-op\b", r"\b合作\b"],
    "training": [r"\btraining\b", r"\btrain\b", r"\b训练\b", r"\bpractice\b", r"\b萌新\b"],
}

# Community link extraction
DISCORD_PATTERN = re.compile(r"discord(?:\.gg|app\.com/invite)[/:\s]+([a-zA-Z0-9\-_]+)", re.IGNORECASE)
SRS_PATTERN = re.compile(r"srs[:\s]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}[:\d]*)", re.IGNORECASE)
SRS_PATTERN_ALT = re.compile(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{4,5}).*srs", re.IGNORECASE)
QQ_PATTERN = re.compile(r"(?:qq群?|QQ群?)[：:\s]*(\d{6,12})", re.IGNORECASE)
WEBSITE_PATTERN = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)
TACVIEW_PATTERN = re.compile(r"tacview[:\s]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}[:\d]*)", re.IGNORECASE)
TEAMSPEAK_PATTERN = re.compile(r"(?:ts|teamspeak)[:\s]+([a-zA-Z0-9\.\-]+(?::\d+)?)", re.IGNORECASE)


def normalize_text(text: str) -> str:
    """Normalize text for consistent matching."""
    if not text:
        return ""
    text = text.replace("\u00a0", " ")
    text = "".join(ch for ch in text if unicodedata.category(ch)[0] != "C" or ch in "\n\t")
    return " ".join(text.split()).strip().lower()


def generate_fingerprint(ip: str, port: int, name: str) -> str:
    """Generate unique fingerprint for server identity."""
    normalized_name = normalize_text(name)[:100]  # Truncate for consistency
    data = f"{ip}:{port}:{normalized_name}"
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def detect_pattern(text: str, patterns: Dict[str, List[str]]) -> Optional[str]:
    """Detect first matching pattern category."""
    text_lower = normalize_text(text)
    for category, regexes in patterns.items():
        for pattern in regexes:
            if re.search(pattern, text_lower):
                return category
    return None


def extract_discord(text: str) -> Optional[str]:
    """Extract Discord invite URL."""
    if not text:
        return None
    match = DISCORD_PATTERN.search(text)
    if match:
        return f"discord.gg/{match.group(1)}"
    return None


def extract_srs(text: str, ip: str) -> Optional[str]:
    """Extract SRS address."""
    if not text:
        return None
    match = SRS_PATTERN.search(text)
    if match:
        return match.group(1)
    match = SRS_PATTERN_ALT.search(text)
    if match:
        return f"{match.group(1)}:{match.group(2)}"
    # Common pattern: SRS on same IP, port 5002
    if re.search(r"\bsrs\b", text, re.IGNORECASE):
        return f"{ip}:5002"
    return None


def extract_qq_group(text: str) -> Optional[str]:
    """Extract QQ group number."""
    if not text:
        return None
    match = QQ_PATTERN.search(text)
    return match.group(1) if match else None


def extract_website(text: str) -> Optional[str]:
    """Extract website URL (excluding Discord)."""
    if not text:
        return None
    for match in WEBSITE_PATTERN.finditer(text):
        url = match.group(0).rstrip(".,;:)")
        if "discord" not in url.lower():
            return url
    return None


def extract_tacview(text: str, ip: str) -> Optional[str]:
    """Extract Tacview address."""
    if not text:
        return None
    match = TACVIEW_PATTERN.search(text)
    if match:
        return match.group(1)
    if re.search(r"\btacview\b", text, re.IGNORECASE):
        return f"{ip}:42674"  # Default tacview port
    return None


def extract_teamspeak(text: str) -> Optional[str]:
    """Extract TeamSpeak address."""
    if not text:
        return None
    match = TEAMSPEAK_PATTERN.search(text)
    return match.group(1) if match else None


def detect_language(text: str) -> Optional[str]:
    """Detect primary language from text."""
    if not text:
        return None

    # Count character types
    chinese = len(re.findall(r"[\u4e00-\u9fff]", text))
    russian = len(re.findall(r"[\u0400-\u04ff]", text))
    korean = len(re.findall(r"[\uac00-\ud7af]", text))
    japanese = len(re.findall(r"[\u3040-\u309f\u30a0-\u30ff]", text))

    if chinese > 5:
        return "chinese"
    if russian > 5:
        return "russian"
    if korean > 5:
        return "korean"
    if japanese > 5:
        return "japanese"
    return "english"


def enrich_server(server: Dict[str, Any]) -> Dict[str, Any]:
    """Apply all enrichment to a server record."""
    name = server.get("server_name", "") or ""
    desc = server.get("description", "") or ""
    mission = server.get("mission", "") or ""
    ip = server.get("ip_address", "") or ""

    # Combine text for pattern matching
    combined = f"{name} {desc} {mission}"

    return {
        "terrain": detect_pattern(combined, TERRAIN_PATTERNS),
        "era": detect_pattern(combined, ERA_PATTERNS),
        "game_mode": detect_pattern(combined, MODE_PATTERNS),
        "framework": detect_pattern(combined, FRAMEWORK_PATTERNS),
        "language": detect_language(combined),
        "discord_url": extract_discord(combined),
        "srs_address": extract_srs(combined, ip),
        "qq_group": extract_qq_group(combined),
        "website_url": extract_website(combined),
        "tacview_address": extract_tacview(combined, ip),
        "teamspeak_address": extract_teamspeak(combined),
    }


def load_servers(path: str) -> List[Dict[str, Any]]:
    """Load servers from JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def detect_server_migration(cur, server_id: str, server_name: str, ip: str, similarity_threshold: float = 0.7) -> Optional[Tuple[str, str, float]]:
    """Detect if a new server might be a migration from a different IP.

    Returns (previous_server_id, match_type, similarity_score) or None.
    """
    # Look for servers with similar names on different IPs that haven't been seen recently
    cur.execute("""
        SELECT id, server_name, similarity(server_name, %s) AS sim
        FROM servers
        WHERE ip_address != %s::inet
          AND id != %s
          AND last_seen < NOW() - INTERVAL '24 hours'
          AND similarity(server_name, %s) > %s
        ORDER BY sim DESC
        LIMIT 1
    """, (server_name, ip, server_id, server_name, similarity_threshold))

    result = cur.fetchone()
    if result:
        prev_id, prev_name, similarity = result
        match_type = 'exact_name' if similarity > 0.99 else 'fuzzy_name'
        return (str(prev_id), match_type, float(similarity))

    return None


def create_lineage_record(cur, current_id: str, previous_id: str, match_type: str, similarity: float) -> Optional[str]:
    """Create a server lineage record if it doesn't already exist.

    Returns the status ('confirmed' or 'pending_review') if created, None if already exists or rejected.
    """
    # Check if this pair was previously rejected
    cur.execute("""
        SELECT status FROM server_lineage
        WHERE current_server_id = %s AND previous_server_id = %s
    """, (current_id, previous_id))
    existing = cur.fetchone()
    if existing:
        return None  # Already exists (confirmed, pending, or rejected)

    # High confidence = auto-confirm, lower confidence = flag for review
    status = 'confirmed' if similarity >= 0.9 else 'pending_review'

    cur.execute("""
        INSERT INTO server_lineage (current_server_id, previous_server_id, match_type, similarity_score, status)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING status
    """, (current_id, previous_id, match_type, similarity, status))
    result = cur.fetchone()
    return result[0] if result else None


def upsert_servers(conn, servers: List[Dict[str, Any]], create_snapshots: bool = False) -> Tuple[int, int, int, int]:
    """Upsert servers into database. Returns (inserted, updated, snapshots, migrations)."""
    inserted = 0
    updated = 0
    snapshot_count = 0
    migrations_detected = 0
    now = datetime.now(timezone.utc)

    with conn.cursor() as cur:
        for server in servers:
            ip = server.get("ip_address")
            port = server.get("port") or 10308
            name = server.get("server_name")

            if not ip or not name:
                continue

            fingerprint = generate_fingerprint(ip, port, name)
            enrichment = enrich_server(server)

            # Check if server exists by IP+port (the stable identifier)
            cur.execute("SELECT id FROM servers WHERE ip_address = %s::inet AND port = %s", (ip, port))
            existing = cur.fetchone()

            if existing:
                # Update existing server
                server_id = existing[0]
                cur.execute("""
                    UPDATE servers SET
                        fingerprint = %s,
                        server_name = %s,
                        players_current = %s,
                        players_max = %s,
                        password_required = %s,
                        dcs_version = %s,
                        mission = %s,
                        mission_time_secs = %s,
                        description = %s,
                        terrain = COALESCE(%s, terrain),
                        era = COALESCE(%s, era),
                        game_mode = COALESCE(%s, game_mode),
                        framework = COALESCE(%s, framework),
                        language = COALESCE(%s, language),
                        discord_url = COALESCE(%s, discord_url),
                        srs_address = COALESCE(%s, srs_address),
                        qq_group = COALESCE(%s, qq_group),
                        website_url = COALESCE(%s, website_url),
                        tacview_address = COALESCE(%s, tacview_address),
                        teamspeak_address = COALESCE(%s, teamspeak_address),
                        last_seen = %s,
                        last_enriched = %s
                    WHERE id = %s
                """, (
                    fingerprint,
                    name,
                    server.get("players_current"),
                    server.get("players_max"),
                    server.get("password_required"),
                    server.get("dcs_version"),
                    server.get("mission"),
                    server.get("mission_time_seconds"),
                    server.get("description"),
                    enrichment["terrain"],
                    enrichment["era"],
                    enrichment["game_mode"],
                    enrichment["framework"],
                    enrichment["language"],
                    enrichment["discord_url"],
                    enrichment["srs_address"],
                    enrichment["qq_group"],
                    enrichment["website_url"],
                    enrichment["tacview_address"],
                    enrichment["teamspeak_address"],
                    now,
                    now,
                    server_id,
                ))
                updated += 1
            else:
                # Insert new server (or update if ip/port exists with different fingerprint)
                cur.execute("""
                    INSERT INTO servers (
                        fingerprint, server_name, ip_address, port,
                        players_current, players_max, password_required,
                        dcs_version, mission, mission_time_secs, description,
                        terrain, era, game_mode, framework, language,
                        discord_url, srs_address, qq_group, website_url,
                        tacview_address, teamspeak_address,
                        first_seen, last_seen, last_enriched
                    ) VALUES (
                        %s, %s, %s::inet, %s,
                        %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s,
                        %s, %s, %s
                    )
                    ON CONFLICT (ip_address, port) DO UPDATE SET
                        fingerprint = EXCLUDED.fingerprint,
                        server_name = EXCLUDED.server_name,
                        players_current = EXCLUDED.players_current,
                        players_max = EXCLUDED.players_max,
                        password_required = EXCLUDED.password_required,
                        dcs_version = EXCLUDED.dcs_version,
                        mission = EXCLUDED.mission,
                        mission_time_secs = EXCLUDED.mission_time_secs,
                        description = EXCLUDED.description,
                        terrain = COALESCE(EXCLUDED.terrain, servers.terrain),
                        era = COALESCE(EXCLUDED.era, servers.era),
                        game_mode = COALESCE(EXCLUDED.game_mode, servers.game_mode),
                        framework = COALESCE(EXCLUDED.framework, servers.framework),
                        language = COALESCE(EXCLUDED.language, servers.language),
                        discord_url = COALESCE(EXCLUDED.discord_url, servers.discord_url),
                        srs_address = COALESCE(EXCLUDED.srs_address, servers.srs_address),
                        qq_group = COALESCE(EXCLUDED.qq_group, servers.qq_group),
                        website_url = COALESCE(EXCLUDED.website_url, servers.website_url),
                        tacview_address = COALESCE(EXCLUDED.tacview_address, servers.tacview_address),
                        teamspeak_address = COALESCE(EXCLUDED.teamspeak_address, servers.teamspeak_address),
                        last_seen = EXCLUDED.last_seen,
                        last_enriched = EXCLUDED.last_enriched
                    RETURNING id, (xmax = 0) AS inserted
                """, (
                    fingerprint, name, ip, port,
                    server.get("players_current"), server.get("players_max"), server.get("password_required"),
                    server.get("dcs_version"), server.get("mission"), server.get("mission_time_seconds"), server.get("description"),
                    enrichment["terrain"], enrichment["era"], enrichment["game_mode"], enrichment["framework"], enrichment["language"],
                    enrichment["discord_url"], enrichment["srs_address"], enrichment["qq_group"], enrichment["website_url"],
                    enrichment["tacview_address"], enrichment["teamspeak_address"],
                    now, now, now,
                ))
                result = cur.fetchone()
                server_id = result[0]
                if result[1]:  # was actually inserted
                    inserted += 1
                    # Check for potential migration from another IP
                    migration = detect_server_migration(cur, server_id, name, ip)
                    if migration:
                        prev_id, match_type, similarity = migration
                        status = create_lineage_record(cur, server_id, prev_id, match_type, similarity)
                        if status:
                            migrations_detected += 1
                else:  # was updated due to conflict
                    updated += 1

            # Create snapshot if requested
            if create_snapshots:
                content = f"{server.get('players_current')}|{server.get('mission')}|{server.get('dcs_version')}"
                content_hash = hashlib.md5(content.encode()).hexdigest()

                cur.execute("""
                    INSERT INTO server_snapshots (
                        server_id, captured_at, server_name, players_current, players_max,
                        mission, mission_time_secs, dcs_version, is_online, content_hash
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    server_id, now, name,
                    server.get("players_current"), server.get("players_max"),
                    server.get("mission"), server.get("mission_time_seconds"),
                    server.get("dcs_version"), True, content_hash,
                ))
                snapshot_count += 1

        conn.commit()

    return inserted, updated, snapshot_count, migrations_detected


def update_host_clusters(conn) -> int:
    """Update host_clusters table based on current servers."""
    with conn.cursor() as cur:
        # Find all IPs with multiple servers
        cur.execute("""
            INSERT INTO host_clusters (ip_address, server_count, first_seen, last_seen)
            SELECT ip_address, COUNT(*) as server_count, MIN(first_seen), MAX(last_seen)
            FROM servers
            GROUP BY ip_address
            HAVING COUNT(*) > 1
            ON CONFLICT (ip_address) DO UPDATE SET
                server_count = EXCLUDED.server_count,
                last_seen = EXCLUDED.last_seen
            RETURNING id
        """)
        cluster_ids = cur.fetchall()

        # Update server references to clusters
        cur.execute("""
            UPDATE servers s
            SET host_cluster_id = hc.id
            FROM host_clusters hc
            WHERE s.ip_address = hc.ip_address
        """)

        conn.commit()
        return len(cluster_ids)


def update_ecosystem_stats(conn) -> None:
    """Calculate and store ecosystem-wide statistics."""
    now = datetime.now(timezone.utc)
    today = now.date()

    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO ecosystem_stats (
                captured_at, stat_date,
                total_servers, active_servers, total_players,
                solo_sessions, multiplayer_sessions,
                unique_hosts, discord_linked, srs_enabled, password_protected,
                framework_counts, terrain_counts
            )
            SELECT
                %s as captured_at,
                %s as stat_date,
                COUNT(*) as total_servers,
                COUNT(*) FILTER (WHERE players_current > 0) as active_servers,
                COALESCE(SUM(players_current), 0) as total_players,
                COUNT(*) FILTER (WHERE players_current = 1) as solo_sessions,
                COUNT(*) FILTER (WHERE players_current > 1) as multiplayer_sessions,
                COUNT(DISTINCT ip_address) as unique_hosts,
                COUNT(*) FILTER (WHERE discord_url IS NOT NULL) as discord_linked,
                COUNT(*) FILTER (WHERE srs_address IS NOT NULL) as srs_enabled,
                COUNT(*) FILTER (WHERE password_required = true) as password_protected,
                (SELECT jsonb_object_agg(framework, cnt) FROM (
                    SELECT framework, COUNT(*) as cnt FROM servers
                    WHERE framework IS NOT NULL GROUP BY framework
                ) f) as framework_counts,
                (SELECT jsonb_object_agg(terrain, cnt) FROM (
                    SELECT terrain, COUNT(*) as cnt FROM servers
                    WHERE terrain IS NOT NULL GROUP BY terrain
                ) t) as terrain_counts
            FROM servers
            ON CONFLICT (stat_date) DO UPDATE SET
                captured_at = EXCLUDED.captured_at,
                total_servers = EXCLUDED.total_servers,
                active_servers = EXCLUDED.active_servers,
                total_players = EXCLUDED.total_players,
                solo_sessions = EXCLUDED.solo_sessions,
                multiplayer_sessions = EXCLUDED.multiplayer_sessions,
                unique_hosts = EXCLUDED.unique_hosts,
                discord_linked = EXCLUDED.discord_linked,
                srs_enabled = EXCLUDED.srs_enabled,
                password_protected = EXCLUDED.password_protected,
                framework_counts = EXCLUDED.framework_counts,
                terrain_counts = EXCLUDED.terrain_counts
        """, (now, today))

        conn.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest DCS server data into PostgreSQL")
    parser.add_argument("--input", "-i", default="servers.json", help="Input JSON file")
    parser.add_argument("--snapshot", "-s", action="store_true", help="Create snapshot records")
    parser.add_argument("--stats", action="store_true", help="Update ecosystem stats")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    # Load servers
    print(f"Loading servers from {args.input}...")
    servers = load_servers(args.input)
    print(f"Loaded {len(servers)} servers")

    # Connect to database
    print(f"Connecting to PostgreSQL ({DB_CONFIG['host']}/{DB_CONFIG['database']})...")
    conn = psycopg2.connect(**DB_CONFIG)

    try:
        # Upsert servers
        print("Upserting servers with enrichment...")
        inserted, updated, snapshots, migrations = upsert_servers(conn, servers, create_snapshots=args.snapshot)
        print(f"  Inserted: {inserted}, Updated: {updated}, Snapshots: {snapshots}, Migrations: {migrations}")

        # Update host clusters
        print("Updating host clusters...")
        clusters = update_host_clusters(conn)
        print(f"  Host clusters: {clusters}")

        # Update ecosystem stats
        if args.stats or args.snapshot:
            print("Updating ecosystem stats...")
            update_ecosystem_stats(conn)
            print("  Done")

        # Summary
        if args.verbose:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE terrain IS NOT NULL) as with_terrain,
                        COUNT(*) FILTER (WHERE framework IS NOT NULL) as with_framework,
                        COUNT(*) FILTER (WHERE discord_url IS NOT NULL) as with_discord,
                        COUNT(*) FILTER (WHERE qq_group IS NOT NULL) as with_qq
                    FROM servers
                """)
                row = cur.fetchone()
                print(f"\nEnrichment summary:")
                print(f"  Total servers: {row[0]}")
                print(f"  With terrain: {row[1]}")
                print(f"  With framework: {row[2]}")
                print(f"  With Discord: {row[3]}")
                print(f"  With QQ group: {row[4]}")

        print("\nDone!")
        return 0

    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
