#!/usr/bin/env python3
"""FastAPI REST API for DCS Server Intelligence dashboard.

Usage:
    uvicorn api:app --reload --host 0.0.0.0 --port 8000
"""

import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# Database connection settings
DB_CONFIG = {
    "host": os.getenv("PGHOST", "localhost"),
    "port": int(os.getenv("PGPORT", "5432")),
    "database": os.getenv("PGDATABASE", "dcs"),
    "user": os.getenv("PGUSER", "postgres"),
    "password": os.getenv("PGPASSWORD"),
}


app = FastAPI(
    title="DCS Server Intelligence API",
    description="Real-time analytics and historical trends for DCS World multiplayer servers",
    version="1.0.0",
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    """Get database connection."""
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)


# =============================================================================
# Pydantic Models
# =============================================================================

class EcosystemStats(BaseModel):
    total_servers: int
    active_servers: int
    total_players: int
    peak_concurrent: Optional[int]
    solo_sessions: int
    multiplayer_sessions: int
    unique_hosts: int
    discord_linked: int
    srs_enabled: int
    password_protected: int
    framework_counts: Optional[Dict[str, int]]
    terrain_counts: Optional[Dict[str, int]]
    captured_at: Optional[datetime]


class ServerSummary(BaseModel):
    id: str
    server_name: str
    ip_address: str
    port: int
    players_current: int
    players_max: int
    password_required: bool
    terrain: Optional[str]
    era: Optional[str]
    game_mode: Optional[str]
    framework: Optional[str]
    discord_url: Optional[str]
    srs_address: Optional[str]
    mission: Optional[str]
    dcs_version: Optional[str]
    trend_7d: Optional[float]
    health_score: Optional[float]
    last_seen: Optional[datetime]


class ServerDetail(ServerSummary):
    description: Optional[str]
    mission_time_secs: Optional[int]
    language: Optional[str]
    website_url: Optional[str]
    tacview_address: Optional[str]
    gci_url: Optional[str]
    qq_group: Optional[str]
    teamspeak_address: Optional[str]
    cgi: Optional[float]
    stickiness: Optional[float]
    uptime_7d: Optional[float]
    avg_players_7d: Optional[float]
    avg_players_30d: Optional[float]
    peak_players: Optional[int]
    peak_time_utc: Optional[str]
    first_seen: Optional[datetime]
    rank: Optional[int]
    rank_change: Optional[int]
    tags: Optional[List[str]]
    host_cluster_id: Optional[str]


class ServerSnapshot(BaseModel):
    captured_at: datetime
    players_current: int
    players_max: Optional[int]
    mission: Optional[str]
    is_online: bool


class HostCluster(BaseModel):
    id: str
    ip_address: str
    server_count: int
    organization_name: Optional[str]
    servers: Optional[List[ServerSummary]]


class FrameworkStat(BaseModel):
    name: str
    count: int
    total_players: int
    avg_players: float


class TerrainStat(BaseModel):
    name: str
    count: int
    total_players: int


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/api/stats", response_model=EcosystemStats, tags=["Overview"])
def get_ecosystem_stats():
    """Get current ecosystem-wide statistics."""
    with get_db() as conn:
        with conn.cursor() as cur:
            # Try to get from ecosystem_stats table first
            cur.execute("""
                SELECT * FROM ecosystem_stats
                ORDER BY captured_at DESC
                LIMIT 1
            """)
            row = cur.fetchone()

            if row:
                return EcosystemStats(
                    total_servers=row["total_servers"] or 0,
                    active_servers=row["active_servers"] or 0,
                    total_players=row["total_players"] or 0,
                    peak_concurrent=row["peak_concurrent"],
                    solo_sessions=row["solo_sessions"] or 0,
                    multiplayer_sessions=row["multiplayer_sessions"] or 0,
                    unique_hosts=row["unique_hosts"] or 0,
                    discord_linked=row["discord_linked"] or 0,
                    srs_enabled=row["srs_enabled"] or 0,
                    password_protected=row["password_protected"] or 0,
                    framework_counts=row["framework_counts"],
                    terrain_counts=row["terrain_counts"],
                    captured_at=row["captured_at"],
                )

            # Fallback: compute from servers table
            cur.execute("""
                SELECT
                    COUNT(*) as total_servers,
                    COUNT(*) FILTER (WHERE players_current > 0) as active_servers,
                    COALESCE(SUM(players_current), 0) as total_players,
                    COUNT(*) FILTER (WHERE players_current = 1) as solo_sessions,
                    COUNT(*) FILTER (WHERE players_current > 1) as multiplayer_sessions,
                    COUNT(DISTINCT ip_address) as unique_hosts,
                    COUNT(*) FILTER (WHERE discord_url IS NOT NULL) as discord_linked,
                    COUNT(*) FILTER (WHERE srs_address IS NOT NULL) as srs_enabled,
                    COUNT(*) FILTER (WHERE password_required = true) as password_protected
                FROM servers
            """)
            row = cur.fetchone()

            return EcosystemStats(
                total_servers=row["total_servers"],
                active_servers=row["active_servers"],
                total_players=row["total_players"],
                peak_concurrent=None,
                solo_sessions=row["solo_sessions"],
                multiplayer_sessions=row["multiplayer_sessions"],
                unique_hosts=row["unique_hosts"],
                discord_linked=row["discord_linked"],
                srs_enabled=row["srs_enabled"],
                password_protected=row["password_protected"],
                framework_counts=None,
                terrain_counts=None,
                captured_at=datetime.utcnow(),
            )


@app.get("/api/servers", response_model=List[ServerSummary], tags=["Servers"])
def get_servers(
    terrain: Optional[str] = Query(None, description="Filter by terrain"),
    framework: Optional[str] = Query(None, description="Filter by framework"),
    game_mode: Optional[str] = Query(None, description="Filter by game mode (pvp, pve, training)"),
    era: Optional[str] = Query(None, description="Filter by era (modern, cold_war, wwii)"),
    search: Optional[str] = Query(None, description="Search server name/description"),
    min_players: Optional[int] = Query(None, description="Minimum current players"),
    has_discord: Optional[bool] = Query(None, description="Has Discord link"),
    has_srs: Optional[bool] = Query(None, description="Has SRS address"),
    has_password: Optional[bool] = Query(None, description="Password required"),
    sort: str = Query("players", description="Sort by: players, name, trend, health"),
    order: str = Query("desc", description="Order: asc, desc"),
    limit: int = Query(100, ge=1, le=500, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
):
    """Get list of servers with filtering and sorting."""
    conditions = []
    params = []

    if terrain:
        conditions.append("terrain = %s")
        params.append(terrain)
    if framework:
        conditions.append("framework = %s")
        params.append(framework)
    if game_mode:
        conditions.append("game_mode = %s")
        params.append(game_mode)
    if era:
        conditions.append("era = %s")
        params.append(era)
    if search:
        conditions.append("(server_name ILIKE %s OR description ILIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])
    if min_players is not None:
        conditions.append("players_current >= %s")
        params.append(min_players)
    if has_discord is not None:
        conditions.append("discord_url IS NOT NULL" if has_discord else "discord_url IS NULL")
    if has_srs is not None:
        conditions.append("srs_address IS NOT NULL" if has_srs else "srs_address IS NULL")
    if has_password is not None:
        conditions.append("password_required = %s")
        params.append(has_password)

    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

    sort_map = {
        "players": "players_current",
        "name": "server_name",
        "trend": "trend_7d",
        "health": "health_score",
        "last_seen": "last_seen",
    }
    sort_col = sort_map.get(sort, "players_current")
    order_dir = "DESC" if order.lower() == "desc" else "ASC"

    # Handle NULLs in sorting
    null_order = "NULLS LAST" if order.lower() == "desc" else "NULLS FIRST"

    query = f"""
        SELECT
            id::text, server_name, ip_address::text, port,
            players_current, players_max, password_required,
            terrain, era, game_mode, framework,
            discord_url, srs_address, mission, dcs_version,
            trend_7d, health_score, last_seen
        FROM servers
        {where_clause}
        ORDER BY {sort_col} {order_dir} {null_order}
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()

    return [ServerSummary(**row) for row in rows]


@app.get("/api/servers/{server_id}", response_model=ServerDetail, tags=["Servers"])
def get_server(server_id: str):
    """Get detailed information for a specific server."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    id::text, server_name, ip_address::text, port,
                    players_current, players_max, password_required,
                    terrain, era, game_mode, framework,
                    discord_url, srs_address, mission, dcs_version,
                    trend_7d, health_score, last_seen,
                    description, mission_time_secs, language,
                    website_url, tacview_address, gci_url,
                    qq_group, teamspeak_address,
                    cgi, stickiness, uptime_7d,
                    avg_players_7d, avg_players_30d,
                    peak_players, peak_time_utc::text,
                    first_seen, rank, rank_change, tags,
                    host_cluster_id::text
                FROM servers
                WHERE id = %s::uuid
            """, (server_id,))
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Server not found")

            return ServerDetail(**row)


@app.get("/api/servers/{server_id}/history", response_model=List[ServerSnapshot], tags=["Servers"])
def get_server_history(
    server_id: str,
    hours: int = Query(24, ge=1, le=168, description="Hours of history (max 168 = 7 days)"),
):
    """Get player count history for a server."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT captured_at, players_current, players_max, mission, is_online
                FROM server_snapshots
                WHERE server_id = %s::uuid
                  AND captured_at > NOW() - INTERVAL '%s hours'
                ORDER BY captured_at ASC
            """, (server_id, hours))
            rows = cur.fetchall()

    return [ServerSnapshot(**row) for row in rows]


@app.get("/api/frameworks", response_model=List[FrameworkStat], tags=["Analytics"])
def get_framework_stats():
    """Get framework distribution with player counts."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    framework as name,
                    COUNT(*) as count,
                    COALESCE(SUM(players_current), 0) as total_players,
                    ROUND(AVG(players_current)::numeric, 2) as avg_players
                FROM servers
                WHERE framework IS NOT NULL
                GROUP BY framework
                ORDER BY count DESC
            """)
            rows = cur.fetchall()

    return [FrameworkStat(**row) for row in rows]


@app.get("/api/terrains", response_model=List[TerrainStat], tags=["Analytics"])
def get_terrain_stats():
    """Get terrain distribution with player counts."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    terrain as name,
                    COUNT(*) as count,
                    COALESCE(SUM(players_current), 0) as total_players
                FROM servers
                WHERE terrain IS NOT NULL
                GROUP BY terrain
                ORDER BY count DESC
            """)
            rows = cur.fetchall()

    return [TerrainStat(**row) for row in rows]


@app.get("/api/clusters", response_model=List[HostCluster], tags=["Analytics"])
def get_host_clusters(
    min_servers: int = Query(2, ge=2, description="Minimum servers per cluster"),
    include_servers: bool = Query(False, description="Include server list"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
):
    """Get host clusters (IPs running multiple servers)."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id::text, ip_address::text, server_count, organization_name
                FROM host_clusters
                WHERE server_count >= %s
                ORDER BY server_count DESC
                LIMIT %s
            """, (min_servers, limit))
            clusters = cur.fetchall()

            result = []
            for cluster in clusters:
                cluster_data = dict(cluster)
                cluster_data["servers"] = None

                if include_servers:
                    cur.execute("""
                        SELECT
                            id::text, server_name, ip_address::text, port,
                            players_current, players_max, password_required,
                            terrain, era, game_mode, framework,
                            discord_url, srs_address, mission, dcs_version,
                            trend_7d, health_score, last_seen
                        FROM servers
                        WHERE host_cluster_id = %s::uuid
                        ORDER BY players_current DESC
                    """, (cluster["id"],))
                    cluster_data["servers"] = [ServerSummary(**s) for s in cur.fetchall()]

                result.append(HostCluster(**cluster_data))

    return result


@app.get("/api/trends/ecosystem", tags=["Trends"])
def get_ecosystem_trends(
    days: int = Query(7, ge=1, le=30, description="Days of history"),
):
    """Get ecosystem trends over time using actual concurrent player data."""
    with get_db() as conn:
        with conn.cursor() as cur:
            # Get actual concurrent players from server_snapshots, aggregated by day
            cur.execute("""
                WITH daily_snapshots AS (
                    SELECT
                        DATE(captured_at) as stat_date,
                        captured_at,
                        SUM(players_current) as total_players,
                        COUNT(*) as server_count,
                        COUNT(*) FILTER (WHERE players_current > 0) as active_servers,
                        COUNT(*) FILTER (WHERE players_current > 1) as multiplayer_sessions
                    FROM server_snapshots
                    WHERE captured_at > NOW() - INTERVAL '%s days'
                    GROUP BY DATE(captured_at), captured_at
                ),
                daily_stats AS (
                    SELECT
                        stat_date,
                        ROUND(AVG(total_players)) as avg_players,
                        MAX(total_players) as peak_players,
                        ROUND(AVG(active_servers)) as avg_active_servers,
                        ROUND(AVG(multiplayer_sessions)) as avg_multiplayer
                    FROM daily_snapshots
                    GROUP BY stat_date
                )
                SELECT
                    stat_date,
                    avg_players as total_players,
                    peak_players as peak_concurrent,
                    avg_active_servers as active_servers,
                    avg_multiplayer as multiplayer_sessions
                FROM daily_stats
                ORDER BY stat_date ASC
            """, (days,))
            rows = cur.fetchall()

    return [dict(row) for row in rows]


@app.get("/api/leaderboard", response_model=List[ServerSummary], tags=["Analytics"])
def get_leaderboard(
    metric: str = Query("players", description="Metric: players, trend, health"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
):
    """Get top servers by various metrics."""
    metric_map = {
        "players": "players_current",
        "trend": "trend_7d",
        "health": "health_score",
        "avg_players": "avg_players_7d",
    }

    if metric not in metric_map:
        raise HTTPException(status_code=400, detail=f"Invalid metric. Use: {list(metric_map.keys())}")

    sort_col = metric_map[metric]

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT
                    id::text, server_name, ip_address::text, port,
                    players_current, players_max, password_required,
                    terrain, era, game_mode, framework,
                    discord_url, srs_address, mission, dcs_version,
                    trend_7d, health_score, last_seen
                FROM servers
                WHERE {sort_col} IS NOT NULL
                ORDER BY {sort_col} DESC NULLS LAST
                LIMIT %s
            """, (limit,))
            rows = cur.fetchall()

    return [ServerSummary(**row) for row in rows]


@app.get("/api/search", response_model=List[ServerSummary], tags=["Servers"])
def search_servers(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
):
    """Full-text search across server names and descriptions."""
    with get_db() as conn:
        with conn.cursor() as cur:
            # Use PostgreSQL full-text search with fallback to ILIKE
            cur.execute("""
                SELECT
                    id::text, server_name, ip_address::text, port,
                    players_current, players_max, password_required,
                    terrain, era, game_mode, framework,
                    discord_url, srs_address, mission, dcs_version,
                    trend_7d, health_score, last_seen,
                    ts_rank(
                        to_tsvector('english', server_name || ' ' || COALESCE(description, '')),
                        plainto_tsquery('english', %s)
                    ) as rank
                FROM servers
                WHERE
                    to_tsvector('english', server_name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', %s)
                    OR server_name ILIKE %s
                    OR description ILIKE %s
                ORDER BY rank DESC, players_current DESC
                LIMIT %s
            """, (q, q, f"%{q}%", f"%{q}%", limit))
            rows = cur.fetchall()

    # Remove rank from results
    return [ServerSummary(**{k: v for k, v in row.items() if k != "rank"}) for row in rows]


class ActivityPattern(BaseModel):
    server_id: str
    server_name: str
    password_required: bool
    day_of_week: int  # 0=Monday, 6=Sunday
    hour: int  # 0-23 in ET
    avg_players: float
    max_players: int
    sample_count: int


class ServerActivitySummary(BaseModel):
    server_id: str
    server_name: str
    password_required: bool
    terrain: Optional[str]
    framework: Optional[str]
    peak_day: int  # 0=Monday, 6=Sunday
    peak_hour: int  # 0-23 in ET
    peak_avg_players: float
    total_samples: int
    active_hours: int  # Number of hour slots with activity
    activity_score: float  # How concentrated activity is (higher = more scheduled)
    off_peak_avg: float  # Average players outside peak times
    training_score: float  # peak_avg / off_peak_avg - high score with low off_peak = training server


@app.get("/api/activity-patterns", response_model=List[ServerActivitySummary], tags=["Analytics"])
def get_activity_patterns(
    min_samples: int = Query(5, ge=1, description="Minimum snapshots required"),
    password_only: bool = Query(False, description="Only password-protected servers"),
    peak_day: Optional[int] = Query(None, ge=0, le=6, description="Filter by peak day (0=Mon, 6=Sun)"),
    peak_hour_start: Optional[int] = Query(None, ge=0, le=23, description="Peak hour range start (ET)"),
    peak_hour_end: Optional[int] = Query(None, ge=0, le=23, description="Peak hour range end (ET)"),
    max_active_hours: Optional[int] = Query(None, ge=1, description="Max active hour slots (lower = more scheduled)"),
    training_mode: bool = Query(False, description="Filter for training servers (baseline ≤1, ratio ≥3x)"),
    max_baseline: Optional[float] = Query(None, ge=0, description="Max baseline (25th percentile) - 0-1 = dead/bot only"),
    min_training_ratio: Optional[float] = Query(None, ge=1, description="Min training ratio (peak_window/baseline)"),
    limit: int = Query(100, ge=1, le=500, description="Max results"),
):
    """
    Analyze server activity patterns to identify scheduled usage.

    Use this to find servers that are only active during specific time windows,
    like squad training servers that only run Tue/Thu 8-10pm.

    - peak_day: 0=Monday through 6=Sunday
    - Hours are in Eastern Time (ET)
    - activity_score: Higher means more concentrated/scheduled activity
    - training_mode: Find servers with low baseline (≤1, dead/bot) that spike during training
    - baseline: 25th percentile of hourly averages (server's "normal" state)
    - peak_window_avg: Average during peak hour ±2 hours (captures full training session)
    - training_ratio: peak_window_avg / baseline (relative spike, works for any squad size)
    - hot_slots: Hours where avg > baseline × 3 (concentrated activity)
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            # Get activity patterns aggregated by server, day of week, and hour
            # Convert to Eastern Time for analysis
            cur.execute("""
                WITH hourly_activity AS (
                    SELECT
                        ss.server_id,
                        s.server_name,
                        s.password_required,
                        s.terrain,
                        s.framework,
                        EXTRACT(DOW FROM ss.captured_at AT TIME ZONE 'America/New_York')::int as dow,
                        EXTRACT(HOUR FROM ss.captured_at AT TIME ZONE 'America/New_York')::int as hour_et,
                        AVG(ss.players_current) as avg_players,
                        MAX(ss.players_current) as max_players,
                        COUNT(*) as samples
                    FROM server_snapshots ss
                    JOIN servers s ON s.id = ss.server_id
                    WHERE ss.players_current >= 0
                    GROUP BY ss.server_id, s.server_name, s.password_required, s.terrain, s.framework,
                             EXTRACT(DOW FROM ss.captured_at AT TIME ZONE 'America/New_York'),
                             EXTRACT(HOUR FROM ss.captured_at AT TIME ZONE 'America/New_York')
                    HAVING COUNT(*) >= 1
                ),
                server_stats AS (
                    SELECT
                        server_id,
                        server_name,
                        password_required,
                        terrain,
                        framework,
                        SUM(samples) as total_samples,
                        COUNT(DISTINCT (dow, hour_et)) as active_hours,
                        -- Find peak hour
                        (ARRAY_AGG(dow ORDER BY avg_players DESC))[1] as peak_day,
                        (ARRAY_AGG(hour_et ORDER BY avg_players DESC))[1] as peak_hour,
                        MAX(avg_players) as peak_avg_players,
                        AVG(avg_players) as overall_avg,
                        -- Baseline: 25th percentile (server's "normal" state - dead/bot)
                        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY avg_players) as baseline,
                        -- Collect all hourly data for peak window calculation
                        ARRAY_AGG(ROW(dow, hour_et, avg_players)) as hourly_data
                    FROM hourly_activity
                    GROUP BY server_id, server_name, password_required, terrain, framework
                    HAVING SUM(samples) >= %s
                ),
                server_summary AS (
                    SELECT
                        ss.server_id,
                        ss.server_name,
                        ss.password_required,
                        ss.terrain,
                        ss.framework,
                        ss.total_samples,
                        ss.active_hours,
                        ss.peak_day,
                        ss.peak_hour,
                        ss.peak_avg_players,
                        ss.overall_avg,
                        ss.baseline,
                        -- Activity concentration score
                        ss.peak_avg_players / NULLIF(ss.overall_avg, 0) as activity_score,
                        -- Peak window average: peak hour ±2 hours on peak day
                        COALESCE(
                            (SELECT AVG(ha.avg_players)
                             FROM hourly_activity ha
                             WHERE ha.server_id = ss.server_id
                               AND ha.dow = ss.peak_day
                               AND ha.hour_et BETWEEN ss.peak_hour - 2 AND ss.peak_hour + 2),
                            ss.peak_avg_players
                        ) as peak_window_avg,
                        -- Hot slots: hours where avg > baseline × 3 (relative threshold)
                        (SELECT COUNT(*)
                         FROM hourly_activity ha
                         WHERE ha.server_id = ss.server_id
                           AND ha.avg_players > GREATEST(ss.baseline * 3, 2)
                        ) as hot_slots
                    FROM server_stats ss
                )
                SELECT
                    *,
                    -- Training ratio: peak window vs baseline (relative, works for any squad size)
                    peak_window_avg / NULLIF(GREATEST(baseline, 0.5), 0) as training_ratio
                FROM server_summary
                WHERE 1=1
                  AND (%s = false OR password_required = true)
                  AND (%s IS NULL OR peak_day = %s)
                  AND (%s IS NULL OR %s IS NULL OR peak_hour BETWEEN %s AND %s)
                  AND (%s IS NULL OR active_hours <= %s)
                  AND (%s = false OR (baseline <= 1 AND peak_window_avg / NULLIF(GREATEST(baseline, 0.5), 0) >= 3))
                  AND (%s IS NULL OR baseline <= %s)
                  AND (%s IS NULL OR peak_window_avg / NULLIF(GREATEST(baseline, 0.5), 0) >= %s)
                ORDER BY
                    CASE WHEN %s THEN peak_window_avg / NULLIF(GREATEST(baseline, 0.5), 0) ELSE 0 END DESC,
                    activity_score DESC NULLS LAST,
                    peak_avg_players DESC
                LIMIT %s
            """, (
                min_samples,
                password_only,
                peak_day, peak_day,
                peak_hour_start, peak_hour_end, peak_hour_start, peak_hour_end,
                max_active_hours, max_active_hours,
                training_mode,
                max_baseline, max_baseline,
                min_training_ratio, min_training_ratio,
                training_mode,
                limit
            ))
            rows = cur.fetchall()

    # Convert DOW from PostgreSQL (0=Sun) to ISO (0=Mon)
    def convert_dow(pg_dow):
        # PostgreSQL: 0=Sunday, 1=Monday, ..., 6=Saturday
        # We want: 0=Monday, ..., 6=Sunday
        return (pg_dow - 1) % 7 if pg_dow > 0 else 6

    return [
        ServerActivitySummary(
            server_id=str(row["server_id"]),
            server_name=row["server_name"],
            password_required=row["password_required"] or False,
            terrain=row["terrain"],
            framework=row["framework"],
            peak_day=convert_dow(row["peak_day"]),
            peak_hour=row["peak_hour"],
            peak_avg_players=round(float(row["peak_avg_players"]), 1),
            total_samples=row["total_samples"],
            active_hours=row["active_hours"],
            activity_score=round(float(row["activity_score"] or 0), 2),
            off_peak_avg=round(float(row["baseline"] or 0), 1),  # Now using baseline (25th percentile)
            training_score=round(float(row["training_ratio"] or 0), 1),  # Now using training_ratio
        )
        for row in rows
    ]


@app.get("/api/servers/{server_id}/activity-heatmap", tags=["Analytics"])
def get_server_activity_heatmap(server_id: str):
    """
    Get detailed activity heatmap for a specific server.
    Returns average player counts for each day/hour combination.
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    EXTRACT(DOW FROM captured_at AT TIME ZONE 'America/New_York')::int as dow,
                    EXTRACT(HOUR FROM captured_at AT TIME ZONE 'America/New_York')::int as hour_et,
                    AVG(players_current) as avg_players,
                    MAX(players_current) as max_players,
                    COUNT(*) as samples
                FROM server_snapshots
                WHERE server_id = %s::uuid
                GROUP BY
                    EXTRACT(DOW FROM captured_at AT TIME ZONE 'America/New_York'),
                    EXTRACT(HOUR FROM captured_at AT TIME ZONE 'America/New_York')
                ORDER BY dow, hour_et
            """, (server_id,))
            rows = cur.fetchall()

    # Convert to ISO day of week (0=Mon)
    def convert_dow(pg_dow):
        return (pg_dow - 1) % 7 if pg_dow > 0 else 6

    return [
        {
            "day": convert_dow(row["dow"]),
            "hour": row["hour_et"],
            "avg_players": round(float(row["avg_players"]), 1),
            "max_players": row["max_players"],
            "samples": row["samples"],
        }
        for row in rows
    ]


@app.get("/api/health", tags=["System"])
def health_check():
    """API health check."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
