CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS host_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL UNIQUE,
    server_count INTEGER NOT NULL DEFAULT 0,
    organization_name TEXT,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint TEXT,
    server_name TEXT NOT NULL,
    ip_address INET NOT NULL,
    port INTEGER NOT NULL,
    players_current INTEGER NOT NULL DEFAULT 0,
    players_max INTEGER,
    password_required BOOLEAN NOT NULL DEFAULT FALSE,
    dcs_version TEXT,
    mission TEXT,
    mission_time_secs INTEGER,
    description TEXT,
    ping_ms NUMERIC,

    terrain TEXT,
    era TEXT,
    game_mode TEXT,
    framework TEXT,
    language TEXT,

    discord_url TEXT,
    srs_address TEXT,
    qq_group TEXT,
    website_url TEXT,
    tacview_address TEXT,
    teamspeak_address TEXT,
    gci_url TEXT,

    trend_7d NUMERIC,
    health_score NUMERIC,
    cgi NUMERIC,
    stickiness NUMERIC,
    uptime_7d NUMERIC,
    avg_players_7d NUMERIC,
    avg_players_30d NUMERIC,
    peak_players INTEGER,
    peak_time_utc TIMESTAMPTZ,
    rank INTEGER,
    rank_change INTEGER,
    tags TEXT[],

    host_cluster_id UUID REFERENCES host_clusters(id) ON DELETE SET NULL,

    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    last_enriched TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_servers_ip_port UNIQUE (ip_address, port)
);

CREATE TABLE IF NOT EXISTS server_snapshots (
    id BIGSERIAL PRIMARY KEY,
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ NOT NULL,
    server_name TEXT,
    players_current INTEGER NOT NULL DEFAULT 0,
    players_max INTEGER,
    mission TEXT,
    mission_time_secs INTEGER,
    dcs_version TEXT,
    is_online BOOLEAN NOT NULL DEFAULT TRUE,
    ping_ms NUMERIC,
    content_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_server_snapshots_server_time UNIQUE (server_id, captured_at)
);

CREATE TABLE IF NOT EXISTS ecosystem_stats (
    id BIGSERIAL PRIMARY KEY,
    captured_at TIMESTAMPTZ NOT NULL,
    stat_date DATE NOT NULL UNIQUE,
    total_servers INTEGER NOT NULL DEFAULT 0,
    active_servers INTEGER NOT NULL DEFAULT 0,
    total_players INTEGER NOT NULL DEFAULT 0,
    peak_concurrent INTEGER,
    solo_sessions INTEGER NOT NULL DEFAULT 0,
    multiplayer_sessions INTEGER NOT NULL DEFAULT 0,
    unique_hosts INTEGER NOT NULL DEFAULT 0,
    discord_linked INTEGER NOT NULL DEFAULT 0,
    srs_enabled INTEGER NOT NULL DEFAULT 0,
    password_protected INTEGER NOT NULL DEFAULT 0,
    framework_counts JSONB,
    terrain_counts JSONB
);

CREATE TABLE IF NOT EXISTS server_lineage (
    id BIGSERIAL PRIMARY KEY,
    current_server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    previous_server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    match_type TEXT NOT NULL,
    similarity_score NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (status IN ('confirmed', 'pending_review', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    notes TEXT,
    CONSTRAINT uq_server_lineage_pair UNIQUE (current_server_id, previous_server_id)
);

CREATE INDEX IF NOT EXISTS idx_servers_players_current ON servers(players_current DESC);
CREATE INDEX IF NOT EXISTS idx_servers_last_seen ON servers(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_servers_framework ON servers(framework);
CREATE INDEX IF NOT EXISTS idx_servers_terrain ON servers(terrain);
CREATE INDEX IF NOT EXISTS idx_servers_game_mode ON servers(game_mode);
CREATE INDEX IF NOT EXISTS idx_servers_era ON servers(era);
CREATE INDEX IF NOT EXISTS idx_servers_host_cluster_id ON servers(host_cluster_id);
CREATE INDEX IF NOT EXISTS idx_servers_server_name_trgm ON servers USING gin (server_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_servers_description_trgm ON servers USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_servers_search_tsv ON servers USING gin (to_tsvector('english', server_name || ' ' || COALESCE(description, '')));

CREATE INDEX IF NOT EXISTS idx_server_snapshots_server_time ON server_snapshots(server_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_snapshots_captured_at ON server_snapshots(captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_host_clusters_server_count ON host_clusters(server_count DESC);

CREATE INDEX IF NOT EXISTS idx_server_lineage_current ON server_lineage(current_server_id);
CREATE INDEX IF NOT EXISTS idx_server_lineage_previous ON server_lineage(previous_server_id);
CREATE INDEX IF NOT EXISTS idx_server_lineage_status ON server_lineage(status);
