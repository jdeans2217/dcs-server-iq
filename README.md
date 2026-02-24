# DCS Server Intelligence

Real-time analytics and historical trends for DCS World multiplayer servers.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![React](https://img.shields.io/badge/react-19-blue.svg)

## Overview

DCS Server Intelligence is a comprehensive monitoring and analytics platform for DCS World multiplayer servers. It tracks 1000+ servers in real-time, providing insights into player activity, server trends, and community patterns.

### Key Features

- **Real-time Dashboard** - Live player counts, server status, and ecosystem metrics
- **Server Discovery** - Search and filter servers by terrain, framework, game mode, and more
- **Player History** - Historical player count charts (6h to 7 days)
- **Activity Patterns** - Detect scheduled events like squad training nights
- **Trend Analysis** - Track server growth, player trends, and ecosystem health
- **Watchlist** - Bookmark favorite servers with persistent storage
- **Compare Mode** - Side-by-side comparison of up to 3 servers

## Screenshots

*Coming soon*

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DCS Website                                  │
│              (digitalcombatsimulator.com)                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Playwright scraping (hourly)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  fetch_servers.py                                │
│              Extracts server list → servers.json                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ingest_servers.py                               │
│    • Enrichment (terrain, framework, community links)            │
│    • Time-series snapshots                                       │
│    • Daily aggregations                                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL                                    │
│    servers │ server_snapshots │ ecosystem_stats │ host_clusters  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FastAPI (api.py)                                │
│                   REST API on :8000                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                React Frontend (Vite)                             │
│                Dashboard on :5173                                │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Python 3.10+, FastAPI, Uvicorn |
| Frontend | React 19, Vite, Recharts |
| Database | PostgreSQL 14+ |
| Scraping | Playwright |
| Styling | CSS (custom dark theme) |

## Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- DCS World account (for server list access)

### 1. Clone the Repository

```bash
git clone https://github.com/jdeans2217/dcs-server-iq.git
cd dcs-server-iq
```

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
playwright install chromium
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Configure Environment

Create a `.env` file in the project root:

```env
# DCS Website Credentials
DCS_USERNAME=your_dcs_username
DCS_PASSWORD=your_dcs_password

# PostgreSQL Connection
PGHOST=localhost
PGPORT=5432
PGDATABASE=dcs
PGUSER=your_db_user
PGPASSWORD=your_db_password
```

### 5. Initialize Database

This repository now includes a schema and init script:

```bash
./scripts/init_db.sh
```

By default, the script uses:

- `PGHOST=127.0.0.1`
- `PGPORT=55432`
- `PGDATABASE=dcs_server_iq`
- `PGUSER=walter`

Override these in `.env` if your local PostgreSQL settings differ.

### 6. Start the Application

```bash
./start.sh
```

Or manually:

```bash
# Terminal 1: API Server
uvicorn api:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend
cd frontend && npm run dev
```

Access the dashboard at `http://localhost:5173`

## Usage

### Data Collection

Fetch and ingest server data:

```bash
# Fetch from DCS website
python fetch_servers.py --out servers.json

# Ingest into database with snapshots
python ingest_servers.py --input servers.json --snapshot --stats

# One-time latency capture while ingesting
python ingest_servers.py --input servers.json --snapshot --stats --ping --ping-timeout 2
```

### Automated Refresh

Set up hourly cron job:

```bash
# Edit crontab
crontab -e

# Add this line (adjust path)
0 * * * * cd /path/to/dcs-server-iq && ./refresh.sh >> refresh.log 2>&1
```

### Backup System

Standalone backup without database:

```bash
# Single backup
python backup_fetch.py

# Continuous backup loop
python backup_fetch.py --loop --interval 30

# Restore from backup
python backup_fetch.py --restore backups/servers_20260123_120000.json.gz
```

## API Reference

Base URL: `http://localhost:8000`

Interactive docs: `http://localhost:8000/docs`

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Ecosystem-wide statistics |
| GET | `/api/servers` | List servers with filtering |
| GET | `/api/servers/{id}` | Server details |
| GET | `/api/servers/{id}/history` | Player count history |
| GET | `/api/servers/{id}/activity-heatmap` | Activity heatmap data |
| GET | `/api/frameworks` | Framework distribution |
| GET | `/api/terrains` | Terrain distribution |
| GET | `/api/trends/ecosystem` | Historical ecosystem trends |
| GET | `/api/activity-patterns` | Server activity pattern analysis |
| GET | `/api/clusters` | Host cluster analysis |
| GET | `/api/search` | Full-text server search |
| GET | `/api/leaderboard` | Top servers by metric |
| GET | `/api/health` | Health check |

### Query Parameters

**GET /api/servers**

| Parameter | Type | Description |
|-----------|------|-------------|
| `terrain` | string | Filter by terrain (caucasus, syria, etc.) |
| `framework` | string | Filter by framework (foothold, pretense, etc.) |
| `game_mode` | string | Filter by mode (pvp, pve, training) |
| `era` | string | Filter by era (modern, cold_war, wwii) |
| `search` | string | Full-text search |
| `min_players` | int | Minimum current players |
| `has_discord` | bool | Has Discord link |
| `has_srs` | bool | Has SRS address |
| `has_password` | bool | Password required |
| `sort` | string | Sort by: players, name, trend, health |
| `order` | string | Sort order: asc, desc |
| `limit` | int | Max results (1-500) |
| `offset` | int | Pagination offset |

**GET /api/activity-patterns**

| Parameter | Type | Description |
|-----------|------|-------------|
| `min_samples` | int | Minimum data points required |
| `password_only` | bool | Only password-protected servers |
| `peak_day` | int | Filter by peak day (0=Mon, 6=Sun) |
| `peak_hour_start` | int | Peak hour range start (0-23 ET) |
| `peak_hour_end` | int | Peak hour range end (0-23 ET) |
| `training_mode` | bool | Filter for training servers |
| `max_active_hours` | int | Max active hour slots |

## Database Schema

### Core Tables

- **servers** - Main server data with enriched metadata
- **server_snapshots** - Time-series player count data (partitioned by month)
- **server_daily_stats** - Aggregated daily metrics
- **ecosystem_stats** - Daily ecosystem-wide statistics
- **host_clusters** - Servers grouped by IP address
- **server_lineage** - Server identity migration tracking
- **server_events** - Change tracking and audit log

### Key Fields

| Field | Description |
|-------|-------------|
| `fingerprint` | SHA256(IP:port:name) for identity |
| `terrain` | Detected map (10 types) |
| `framework` | Detected framework (7 types) |
| `game_mode` | PvP, PvE, or Training |
| `trend_7d` | 7-day growth trend |
| `health_score` | Composite server health metric |

## Features In-Depth

### Activity Pattern Detection

The system analyzes server activity to identify scheduled events:

- **Baseline**: 25th percentile of hourly averages (server's "normal" state)
- **Peak Window**: Average players during peak hour ±2 hours
- **Training Ratio**: Peak ÷ baseline (identifies training servers)
- **Active Hours**: Number of hour slots with significant activity

Use this to find servers with scheduled training nights, events, or regular play times.

### Enrichment System

Automatic detection from server descriptions:

| Category | Detected Values |
|----------|----------------|
| **Terrains** | Caucasus, Syria, Persian Gulf, Marianas, Nevada, Kola, Sinai, Channel, Falklands, Afghanistan |
| **Frameworks** | Foothold, Pretense, TTI, Gray Flag, Blue Flag, Liberation, Rotor Heads |
| **Eras** | WWII, Cold War, Modern |
| **Community** | Discord, SRS, TeamSpeak, QQ Groups, Tacview, Websites |

### Server Identity Tracking

- Fingerprint-based deduplication
- Migration detection when servers move IPs
- Host clustering for multi-server operators
- Historical lineage tracking

## Configuration

### Frontend Environment

Optional `frontend/.env`:

```env
VITE_API_URL=http://your-api-host:8000
```

Defaults to `http://[current-hostname]:8000` for LAN access.

### Vite Config

LAN access is enabled by default in `vite.config.js`:

```javascript
server: {
  host: true,  // Expose on LAN
}
```

## Development

### Project Structure

```
dcs-server-iq/
├── api.py                 # FastAPI REST API
├── fetch_servers.py       # Web scraper (Playwright)
├── ingest_servers.py      # Data enrichment & DB ingestion
├── backup_fetch.py        # Standalone backup system
├── start.sh               # Development startup script
├── refresh.sh             # Cron job for hourly refresh
├── requirements.txt       # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main React application
│   │   ├── App.css        # Styling
│   │   └── main.jsx       # Entry point
│   ├── package.json
│   └── vite.config.js
└── backups/               # Backup storage (gitignored)
```

### Running Tests

*Coming soon*

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] User authentication
- [ ] Email/Discord notifications for watchlist
- [ ] Server uptime monitoring alerts
- [ ] Historical framework/terrain trends
- [ ] Player name tracking (opt-in)
- [ ] Mobile-responsive improvements
- [ ] Docker deployment
- [ ] Public API rate limiting

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [DCS World](https://www.digitalcombatsimulator.com/) by Eagle Dynamics
- [Recharts](https://recharts.org/) for React charting
- [FastAPI](https://fastapi.tiangolo.com/) for the API framework
- [Playwright](https://playwright.dev/) for web scraping

## Support

- **Issues**: [GitHub Issues](https://github.com/jdeans2217/dcs-server-iq/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jdeans2217/dcs-server-iq/discussions)

---

Made with enthusiasm for the DCS community.
