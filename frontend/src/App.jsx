import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart, Legend } from 'recharts';
import './App.css';

// Use same host as frontend, but port 8000 for API
const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

const DCSServerIntelligence = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedServer, setSelectedServer] = useState(null);
  const [serverFilter, setServerFilter] = useState('all');
  const [frameworkFilter, setFrameworkFilter] = useState(null);
  const [terrainFilter, setTerrainFilter] = useState(null);
  const [filterSourceTab, setFilterSourceTab] = useState(null);  // Track where user came from
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('7d');
  const [compareServers, setCompareServers] = useState([]);
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem('dcs-watchlist');
    return saved ? JSON.parse(saved) : [];
  });

  // API data state
  const [stats, setStats] = useState(null);
  const [allServers, setAllServers] = useState([]);  // Full list for charts
  const [servers, setServers] = useState([]);        // Filtered list for Servers tab
  const [watchlistServers, setWatchlistServers] = useState([]);  // Fetched watchlist servers
  const [frameworks, setFrameworks] = useState([]);
  const [terrains, setTerrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [serverHistory, setServerHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyHours, setHistoryHours] = useState(24);

  // Ecosystem trends state
  const [ecosystemTrends, setEcosystemTrends] = useState([]);
  const [trendsDays, setTrendsDays] = useState(14);

  // Activity patterns state
  const [activityPatterns, setActivityPatterns] = useState([]);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [patternFilters, setPatternFilters] = useState({
    passwordOnly: true,
    peakDay: null,
    peakHourStart: null,
    peakHourEnd: null,
    maxActiveHours: null,
    trainingMode: false,
  });
  const [savedPresets, setSavedPresets] = useState(() => {
    const saved = localStorage.getItem('dcs-pattern-presets');
    return saved ? JSON.parse(saved) : [
      // Default presets
      { id: 'tue-evening', name: 'Tuesday Evening', filters: { passwordOnly: true, peakDay: 1, peakHourStart: 19, peakHourEnd: 22, maxActiveHours: null } },
      { id: 'thu-evening', name: 'Thursday Evening', filters: { passwordOnly: true, peakDay: 3, peakHourStart: 19, peakHourEnd: 22, maxActiveHours: null } },
      { id: 'weekend', name: 'Weekend Servers', filters: { passwordOnly: false, peakDay: 5, peakHourStart: null, peakHourEnd: null, maxActiveHours: null } },
    ];
  });
  const [activePreset, setActivePreset] = useState(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedPatternServer, setSelectedPatternServer] = useState(null);
  const [patternServerDetails, setPatternServerDetails] = useState(null);
  const [patternServerHeatmap, setPatternServerHeatmap] = useState([]);
  const [selectedTimeCells, setSelectedTimeCells] = useState(new Set()); // Set of "day-hour" strings

  // Fetch ecosystem stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Stats error:', err);
    }
  }, []);

  // Fetch all servers (for charts, unfiltered)
  const fetchAllServers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/servers?limit=500&sort=players&order=desc`);
      if (!res.ok) throw new Error('Failed to fetch all servers');
      const data = await res.json();
      setAllServers(data);
    } catch (err) {
      console.error('All servers error:', err);
    }
  }, []);

  // Fetch servers with filters (for Servers tab)
  const fetchServers = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '200', sort: 'players', order: 'desc' });

      if (serverFilter === 'multiplayer') params.set('min_players', '2');
      else if (serverFilter === 'pvp') params.set('game_mode', 'pvp');
      else if (serverFilter === 'pve') params.set('game_mode', 'pve');

      if (frameworkFilter) params.set('framework', frameworkFilter);
      if (terrainFilter) params.set('terrain', terrainFilter);
      if (debouncedSearchQuery) params.set('search', debouncedSearchQuery);

      const res = await fetch(`${API_BASE}/api/servers?${params}`);
      if (!res.ok) throw new Error('Failed to fetch servers');
      const data = await res.json();
      setServers(data);
    } catch (err) {
      console.error('Servers error:', err);
    }
  }, [serverFilter, frameworkFilter, terrainFilter, debouncedSearchQuery]);

  // Fetch framework stats
  const fetchFrameworks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/frameworks`);
      if (!res.ok) throw new Error('Failed to fetch frameworks');
      const data = await res.json();
      setFrameworks(data);
    } catch (err) {
      console.error('Frameworks error:', err);
    }
  }, []);

  // Fetch terrain stats
  const fetchTerrains = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/terrains`);
      if (!res.ok) throw new Error('Failed to fetch terrains');
      const data = await res.json();
      setTerrains(data);
    } catch (err) {
      console.error('Terrains error:', err);
    }
  }, []);

  // Fetch ecosystem trends
  const fetchEcosystemTrends = useCallback(async (days = 14) => {
    try {
      const res = await fetch(`${API_BASE}/api/trends/ecosystem?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch ecosystem trends');
      const data = await res.json();
      // Format for charts
      const formatted = data.map(row => ({
        date: new Date(row.stat_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        players: row.total_players,
        activeServers: row.active_servers,
        multiplayer: row.multiplayer_sessions,
        terrainCounts: row.terrain_counts,
      }));
      setEcosystemTrends(formatted);
    } catch (err) {
      console.error('Ecosystem trends error:', err);
    }
  }, []);

  // Fetch server history
  const fetchServerHistory = useCallback(async (serverId, hours = 24) => {
    if (!serverId) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/servers/${serverId}/history?hours=${hours}`);
      if (!res.ok) throw new Error('Failed to fetch server history');
      const data = await res.json();
      // Format data for chart - use appropriate labels based on time range
      const formatted = data.map((snap, index) => {
        const date = new Date(snap.captured_at);
        let label;
        if (hours <= 24) {
          // Short range: show time only
          label = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (hours <= 48) {
          // Medium range: show day + time
          label = date.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' +
                  date.toLocaleTimeString('en-US', { hour: 'numeric' });
        } else {
          // Long range (7d): show month/day + hour
          label = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) + ' ' +
                  date.toLocaleTimeString('en-US', { hour: 'numeric' });
        }
        const fullTime = date.toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        return {
          time: label,
          fullTime,
          timestamp: date,
          players: snap.players_current,
          max: snap.players_max,
          online: snap.is_online,
        };
      });
      setServerHistory(formatted);
    } catch (err) {
      console.error('Server history error:', err);
      setServerHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Fetch activity patterns
  const fetchActivityPatterns = useCallback(async (filters = {}, selectedCells = new Set()) => {
    setPatternsLoading(true);
    try {
      const params = new URLSearchParams({ min_samples: '1', limit: '200' });
      if (filters.passwordOnly) params.set('password_only', 'true');
      if (filters.peakDay !== null) params.set('peak_day', filters.peakDay);
      if (filters.peakHourStart !== null) params.set('peak_hour_start', filters.peakHourStart);
      if (filters.peakHourEnd !== null) params.set('peak_hour_end', filters.peakHourEnd);
      if (filters.maxActiveHours) params.set('max_active_hours', filters.maxActiveHours);
      if (filters.trainingMode) params.set('training_mode', 'true');

      const res = await fetch(`${API_BASE}/api/activity-patterns?${params}`);
      if (!res.ok) throw new Error('Failed to fetch activity patterns');
      let data = await res.json();

      // Client-side filter: if specific cells are selected, only show servers
      // whose peak day/hour matches one of the selected cells (true OR logic)
      if (selectedCells.size > 0) {
        data = data.filter(server => {
          const serverCell = `${server.peak_day}-${server.peak_hour}`;
          return selectedCells.has(serverCell);
        });
      }

      setActivityPatterns(data);
    } catch (err) {
      console.error('Activity patterns error:', err);
      setActivityPatterns([]);
    } finally {
      setPatternsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchStats(), fetchAllServers(), fetchServers(), fetchFrameworks(), fetchTerrains()]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchStats, fetchAllServers, fetchServers, fetchFrameworks, fetchTerrains]);

  // Debounce search query (wait 400ms after typing stops)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Refetch servers when filter/search changes
  useEffect(() => {
    fetchServers();
  }, [serverFilter, frameworkFilter, terrainFilter, debouncedSearchQuery, fetchServers]);

  // Save watchlist to localStorage
  useEffect(() => {
    localStorage.setItem('dcs-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // Fetch watchlist servers individually
  useEffect(() => {
    const fetchWatchlistServers = async () => {
      if (watchlist.length === 0) {
        setWatchlistServers([]);
        return;
      }
      const results = await Promise.all(
        watchlist.map(async (id) => {
          try {
            const res = await fetch(`${API_BASE}/api/servers/${id}`);
            if (res.ok) return await res.json();
            return null;
          } catch {
            return null;
          }
        })
      );
      setWatchlistServers(results.filter(Boolean));
    };
    fetchWatchlistServers();
  }, [watchlist]);

  // Fetch history when server is selected
  useEffect(() => {
    if (selectedServer) {
      fetchServerHistory(selectedServer.id, historyHours);
    } else {
      setServerHistory([]);
    }
  }, [selectedServer, historyHours, fetchServerHistory]);

  // Fetch activity patterns when tab is selected or filters change
  useEffect(() => {
    if (activeTab === 'patterns') {
      fetchActivityPatterns(patternFilters, selectedTimeCells);
    }
  }, [activeTab, patternFilters, selectedTimeCells, fetchActivityPatterns]);

  // Fetch ecosystem trends when trends tab is selected
  useEffect(() => {
    if (activeTab === 'trends') {
      fetchEcosystemTrends(trendsDays);
    }
  }, [activeTab, trendsDays, fetchEcosystemTrends]);

  // Save presets to localStorage
  useEffect(() => {
    localStorage.setItem('dcs-pattern-presets', JSON.stringify(savedPresets));
  }, [savedPresets]);

  // Preset management functions
  const loadPreset = (preset) => {
    setPatternFilters(preset.filters);
    setActivePreset(preset.id);
  };

  const saveCurrentAsPreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset = {
      id: `custom-${Date.now()}`,
      name: newPresetName.trim(),
      filters: { ...patternFilters },
    };
    setSavedPresets(prev => [...prev, newPreset]);
    setActivePreset(newPreset.id);
    setNewPresetName('');
  };

  const deletePreset = (presetId) => {
    setSavedPresets(prev => prev.filter(p => p.id !== presetId));
    if (activePreset === presetId) setActivePreset(null);
  };

  const clearFilters = () => {
    setPatternFilters({
      passwordOnly: false,
      peakDay: null,
      peakHourStart: null,
      peakHourEnd: null,
      maxActiveHours: null,
      trainingMode: false,
    });
    setSelectedTimeCells(new Set());
    setActivePreset(null);
  };

  // Toggle a time cell selection
  const toggleTimeCell = (day, hour) => {
    const cellKey = `${day}-${hour}`;
    setSelectedTimeCells(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cellKey)) {
        newSet.delete(cellKey);
      } else {
        newSet.add(cellKey);
      }
      return newSet;
    });
    setActivePreset(null);
  };

  // Sync selected time cells to pattern filters
  useEffect(() => {
    if (selectedTimeCells.size === 0) {
      // Clear time-related filters when no cells selected
      setPatternFilters(f => ({
        ...f,
        peakDay: null,
        peakHourStart: null,
        peakHourEnd: null,
      }));
      return;
    }

    // Parse selected cells
    const cells = Array.from(selectedTimeCells).map(key => {
      const [day, hour] = key.split('-').map(Number);
      return { day, hour };
    });

    // Get unique days and hour range
    const days = [...new Set(cells.map(c => c.day))];
    const hours = cells.map(c => c.hour);
    const minHour = Math.min(...hours);
    const maxHour = Math.max(...hours);

    // If all cells on same day, use that day; otherwise leave null (any day)
    const peakDay = days.length === 1 ? days[0] : null;

    setPatternFilters(f => ({
      ...f,
      peakDay,
      peakHourStart: minHour,
      peakHourEnd: maxHour,
    }));
  }, [selectedTimeCells]);

  // Clear time cells when preset is loaded
  const loadPresetWithClear = (preset) => {
    setSelectedTimeCells(new Set());
    loadPreset(preset);
  };

  // Fetch pattern server details and heatmap
  const fetchPatternServerDetails = useCallback(async (serverId) => {
    try {
      const [detailsRes, heatmapRes] = await Promise.all([
        fetch(`${API_BASE}/api/servers/${serverId}`),
        fetch(`${API_BASE}/api/servers/${serverId}/activity-heatmap`),
      ]);

      if (detailsRes.ok) {
        const details = await detailsRes.json();
        setPatternServerDetails(details);
      }

      if (heatmapRes.ok) {
        const heatmap = await heatmapRes.json();
        setPatternServerHeatmap(heatmap);
      }
    } catch (err) {
      console.error('Error fetching pattern server details:', err);
    }
  }, []);

  // Handle pattern server selection
  const selectPatternServer = (server) => {
    if (selectedPatternServer?.server_id === server.server_id) {
      setSelectedPatternServer(null);
      setPatternServerDetails(null);
      setPatternServerHeatmap([]);
    } else {
      setSelectedPatternServer(server);
      fetchPatternServerDetails(server.server_id);
    }
  };

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      fetchAllServers();
      fetchServers();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchAllServers, fetchServers]);

  // Framework colors
  const FRAMEWORK_COLORS = {
    foothold: '#3b82f6',
    pretense: '#10b981',
    tti: '#f59e0b',
    grayflag: '#8b5cf6',
    blueflag: '#06b6d4',
    liberation: '#ec4899',
    rotorheads: '#f97316',
  };

  // Terrain colors
  const TERRAIN_COLORS = {
    caucasus: '#3b82f6',
    syria: '#ef4444',
    persian_gulf: '#f59e0b',
    marianas: '#10b981',
    nevada: '#8b5cf6',
    kola: '#06b6d4',
    sinai: '#ec4899',
    channel: '#84cc16',
    falklands: '#6366f1',
    afghanistan: '#f97316',
  };

  // Derive data for charts
  const frameworkData = frameworks.map(f => ({
    name: f.name.charAt(0).toUpperCase() + f.name.slice(1),
    servers: f.count,
    players: f.total_players,
    fill: FRAMEWORK_COLORS[f.name] || '#64748b',
  }));

  const terrainData = terrains.map(t => ({
    name: t.name.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    rawName: t.name,
    value: t.count,
    players: t.total_players,
    fill: TERRAIN_COLORS[t.name] || '#64748b',
  }));

  // Top servers by player count (use allServers for charts)
  const topServers = allServers
    .filter(s => s.players_current >= 5)
    .sort((a, b) => b.players_current - a.players_current)
    .slice(0, 5);

  // Multiplayer distribution (use allServers for charts)
  const multiplayerDistribution = [
    { range: '2-5', count: allServers.filter(s => s.players_current >= 2 && s.players_current <= 5).length, fill: '#3b82f6' },
    { range: '6-10', count: allServers.filter(s => s.players_current >= 6 && s.players_current <= 10).length, fill: '#10b981' },
    { range: '11-20', count: allServers.filter(s => s.players_current >= 11 && s.players_current <= 20).length, fill: '#f59e0b' },
    { range: '21-40', count: allServers.filter(s => s.players_current >= 21 && s.players_current <= 40).length, fill: '#ef4444' },
    { range: '41+', count: allServers.filter(s => s.players_current >= 41).length, fill: '#8b5cf6' },
  ];

  // Filter servers for display
  const filteredServers = servers.filter(s => {
    if (serverFilter === 'rising') return s.players_current >= 10;
    if (serverFilter === 'frameworks') return s.framework;
    return true;
  });

  // Helper components
  const StatCard = ({ title, value, subtitle, icon }) => (
    <div className="stat-card">
      <div className="stat-card-header">
        <div>
          <p className="stat-title">{title}</p>
          <p className="stat-value">{value}</p>
          {subtitle && <p className="stat-subtitle">{subtitle}</p>}
        </div>
        <div className="stat-icon">{icon}</div>
      </div>
    </div>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Use fullTime from data if available (for history charts)
      const displayLabel = payload[0]?.payload?.fullTime || label;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{displayLabel}</p>
          {payload.map((p, i) => (
            <p key={i} className="tooltip-value">{p.name}: {p.value?.toLocaleString()}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  const toggleWatchlist = (id) => setWatchlist(prev =>
    prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
  );

  // Navigate to servers tab with a specific filter
  const goToFilteredServers = (type, value) => {
    setFilterSourceTab(activeTab);  // Remember where we came from
    setServerFilter('all');
    setSearchQuery('');
    if (type === 'framework') {
      setFrameworkFilter(value);
      setTerrainFilter(null);
    } else if (type === 'terrain') {
      setTerrainFilter(value);
      setFrameworkFilter(null);
    }
    setActiveTab('servers');
  };

  const clearCategoryFilters = () => {
    setFrameworkFilter(null);
    setTerrainFilter(null);
    setFilterSourceTab(null);
  };

  const goBackToSource = () => {
    const sourceTab = filterSourceTab;
    clearCategoryFilters();
    if (sourceTab) {
      setActiveTab(sourceTab);
    }
  };

  const toggleCompare = (server) => setCompareServers(prev => {
    if (prev.find(s => s.id === server.id)) return prev.filter(s => s.id !== server.id);
    if (prev.length >= 3) return prev;
    return [...prev, server];
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading DCS Server Intelligence...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Error: {error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="grid-overlay" />

      <div className="content-wrapper">
        {/* Header */}
        <header className="header">
          <div className="header-content">
            <div className="header-left">
              <div className="logo">✈</div>
              <div>
                <h1>DCS Server Intelligence</h1>
                <p className="header-subtitle">Real-time analytics & historical trends</p>
              </div>
            </div>
            <div className="header-right">
              <div className="last-updated">
                <p className="update-label">Last updated</p>
                <p className="update-time">{lastUpdated?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</p>
              </div>
              <div className="live-indicator" />
            </div>
          </div>

          <nav className="tab-nav">
            {['overview', 'servers', 'patterns', 'trends', 'compare', 'watchlist', 'terrains'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tab-button ${activeTab === tab ? 'active' : ''}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'watchlist' && watchlist.length > 0 && (
                  <span className="tab-badge yellow">{watchlist.length}</span>
                )}
                {tab === 'compare' && compareServers.length > 0 && (
                  <span className="tab-badge purple">{compareServers.length}</span>
                )}
              </button>
            ))}
          </nav>
        </header>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && stats && (
          <div className="tab-content">
            <div className="stats-grid">
              <StatCard
                title="Players Online"
                value={stats.total_players?.toLocaleString()}
                subtitle={`${stats.multiplayer_sessions} multiplayer sessions`}
                icon="👥"
              />
              <StatCard
                title="Active Servers"
                value={stats.active_servers?.toLocaleString()}
                subtitle={`of ${stats.total_servers} total`}
                icon="🖥️"
              />
              <StatCard
                title="Discord Linked"
                value={stats.discord_linked?.toLocaleString()}
                subtitle={`${((stats.discord_linked / stats.total_servers) * 100).toFixed(1)}% of servers`}
                icon="💬"
              />
              <StatCard
                title="Multiplayer"
                value={stats.multiplayer_sessions?.toLocaleString()}
                subtitle={`${((stats.multiplayer_sessions / stats.active_servers) * 100).toFixed(1)}% of active`}
                icon="🎮"
              />
            </div>

            <div className="main-grid">
              <div className="chart-panel wide">
                <div className="panel-header">
                  <h3>Framework Distribution</h3>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={frameworkData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} style={{ cursor: 'pointer' }}>
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="servers"
                      radius={[4, 4, 0, 0]}
                      name="Servers"
                      onClick={(data) => goToFilteredServers('framework', data.name.toLowerCase())}
                    >
                      {frameworkData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} style={{ cursor: 'pointer' }} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-panel">
                <h3 className="panel-title"><span className="fire-icon">🔥</span> Top Servers</h3>
                <div className="server-list-compact">
                  {topServers.map((server, i) => (
                    <div
                      key={server.id}
                      className="server-item-compact"
                      onClick={() => { setSelectedServer(server); setActiveTab('servers'); }}
                    >
                      <span className="server-rank">#{i + 1}</span>
                      <div className="server-info-compact">
                        <p className="server-name-compact">{server.server_name}</p>
                        <p className="server-meta-compact">{server.terrain || 'Unknown'} • {server.game_mode?.toUpperCase() || 'N/A'}</p>
                      </div>
                      <span className="server-players-compact">
                        {server.players_current}/{server.players_max}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="secondary-grid">
              <div className="chart-panel">
                <h3 className="panel-title">Framework Stats</h3>
                <div className="framework-list">
                  {frameworkData.slice(0, 5).map(f => (
                    <div
                      key={f.name}
                      className="framework-item clickable"
                      onClick={() => goToFilteredServers('framework', f.name.toLowerCase())}
                    >
                      <div className="framework-color" style={{ backgroundColor: f.fill }} />
                      <span className="framework-name">{f.name}</span>
                      <span className="framework-count">{f.servers} servers</span>
                      <span className="framework-players">{f.players} players</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="chart-panel">
                <h3 className="panel-title">Server Population</h3>
                <div className="population-grid">
                  <div className="population-stat solo">
                    <p className="population-label">Solo/Bot</p>
                    <p className="population-value">{stats.solo_sessions?.toLocaleString()}</p>
                  </div>
                  <div className="population-stat multi">
                    <p className="population-label">Multiplayer</p>
                    <p className="population-value">{stats.multiplayer_sessions?.toLocaleString()}</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={multiplayerDistribution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Servers">
                      {multiplayerDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-panel">
                <h3 className="panel-title">Infrastructure</h3>
                <div className="infra-stats">
                  <div className="infra-item">
                    <span className="infra-icon">🌐</span>
                    <span className="infra-value">{stats.unique_hosts}</span>
                    <span className="infra-label">Unique Hosts</span>
                  </div>
                  <div className="infra-item">
                    <span className="infra-icon">💬</span>
                    <span className="infra-value">{stats.discord_linked}</span>
                    <span className="infra-label">Discord</span>
                  </div>
                  <div className="infra-item">
                    <span className="infra-icon">🎧</span>
                    <span className="infra-value">{stats.srs_enabled}</span>
                    <span className="infra-label">SRS</span>
                  </div>
                  <div className="infra-item">
                    <span className="infra-icon">🔒</span>
                    <span className="infra-value">{stats.password_protected}</span>
                    <span className="infra-label">Password</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SERVERS TAB */}
        {activeTab === 'servers' && (
          <div className="tab-content">
            <div className="filter-bar">
              <input
                type="text"
                placeholder="Search servers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <div className="filter-buttons">
                {['all', 'multiplayer', 'pvp', 'pve', 'frameworks', 'rising'].map(f => (
                  <button
                    key={f}
                    onClick={() => { setServerFilter(f); clearCategoryFilters(); }}
                    className={`filter-button ${serverFilter === f && !frameworkFilter && !terrainFilter ? 'active' : ''}`}
                  >
                    {f === 'rising' ? '🔥 Rising' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {(frameworkFilter || terrainFilter) && (
              <div className="active-filter-banner">
                {filterSourceTab && (
                  <button onClick={goBackToSource} className="back-btn">
                    ← Back to {filterSourceTab.charAt(0).toUpperCase() + filterSourceTab.slice(1)}
                  </button>
                )}
                <span>
                  Showing: {frameworkFilter ? `Framework: ${frameworkFilter}` : `Terrain: ${terrainFilter?.replace('_', ' ')}`}
                </span>
                <button onClick={clearCategoryFilters} className="clear-filter-btn">✕ Clear filter</button>
              </div>
            )}

            <div className="server-list">
              {filteredServers.map(server => (
                <div
                  key={server.id}
                  className={`server-card ${selectedServer?.id === server.id ? 'selected' : ''}`}
                >
                  <div
                    className="server-card-header"
                    onClick={() => setSelectedServer(selectedServer?.id === server.id ? null : server)}
                  >
                    <div className="server-main-info">
                      <div className="server-title-row">
                        <span className="expand-icon">{selectedServer?.id === server.id ? '▼' : '▶'}</span>
                        <h4 className="server-name">{server.server_name}</h4>
                        {server.players_current >= 20 && <span className="hot-badge">🔥</span>}
                      </div>
                      <p className="server-mission">{server.mission}</p>
                    </div>
                    <div className="server-actions">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleWatchlist(server.id); }}
                        className={`watchlist-btn ${watchlist.includes(server.id) ? 'active' : ''}`}
                      >
                        {watchlist.includes(server.id) ? '★' : '☆'}
                      </button>
                      <div className="player-count">
                        <span className={`players ${server.players_current >= 20 ? 'high' : server.players_current >= 5 ? 'medium' : 'low'}`}>
                          {server.players_current}
                        </span>
                        <span className="max-players">/{server.players_max}</span>
                      </div>
                    </div>
                  </div>

                  <div className="server-tags">
                    {server.terrain && <span className="tag terrain">{server.terrain.replace('_', ' ')}</span>}
                    {server.game_mode && (
                      <span className={`tag mode ${server.game_mode}`}>{server.game_mode.toUpperCase()}</span>
                    )}
                    {server.framework && <span className="tag framework">{server.framework}</span>}
                    {server.discord_url && <span className="tag discord">Discord</span>}
                    {server.srs_address && <span className="tag srs">SRS</span>}
                  </div>

                  {selectedServer?.id === server.id && (
                    <div className="server-details">
                      <div className="details-grid">
                        <div className="detail-section">
                          <h5>Connection</h5>
                          <code className="connection-string">{server.ip_address?.replace('/32', '')}:{server.port}</code>
                          <div className="detail-row">
                            <span>Version:</span>
                            <span>{server.dcs_version}</span>
                          </div>
                          <div className="detail-row">
                            <span>Password:</span>
                            <span>{server.password_required ? '🔒 Required' : 'Open'}</span>
                          </div>
                        </div>

                        <div className="detail-section">
                          <h5>Community</h5>
                          {server.discord_url && (
                            <a href={`https://${server.discord_url}`} target="_blank" rel="noopener noreferrer" className="community-link discord">
                              💬 {server.discord_url}
                            </a>
                          )}
                          {server.srs_address && (
                            <div className="community-link srs">🎧 {server.srs_address}</div>
                          )}
                          {!server.discord_url && !server.srs_address && (
                            <p className="no-links">No community links detected</p>
                          )}
                        </div>

                        <div className="detail-section">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCompare(server); }}
                            className={`compare-btn ${compareServers.find(s => s.id === server.id) ? 'active' : ''}`}
                          >
                            {compareServers.find(s => s.id === server.id) ? '✓ Comparing' : '⊕ Compare'}
                          </button>
                        </div>
                      </div>

                      {/* Player History Chart */}
                      <div className="history-section">
                        <div className="history-header">
                          <h5>Player History</h5>
                          <div className="history-range-buttons">
                            {[6, 12, 24, 48, 168].map(h => (
                              <button
                                key={h}
                                onClick={(e) => { e.stopPropagation(); setHistoryHours(h); }}
                                className={`history-range-btn ${historyHours === h ? 'active' : ''}`}
                              >
                                {h <= 24 ? `${h}h` : `${h / 24}d`}
                              </button>
                            ))}
                          </div>
                        </div>
                        {historyLoading ? (
                          <div className="history-loading">Loading history...</div>
                        ) : serverHistory.length > 0 ? (
                          <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={serverHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="playerGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <XAxis
                                dataKey="time"
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                axisLine={{ stroke: '#334155' }}
                                tickLine={false}
                                interval="preserveStartEnd"
                              />
                              <YAxis
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                domain={[0, 'auto']}
                              />
                              <Tooltip content={<CustomTooltip />} />
                              <Area
                                type="monotone"
                                dataKey="players"
                                stroke="#06b6d4"
                                strokeWidth={2}
                                fill="url(#playerGradient)"
                                name="Players"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="history-empty">No history data available</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PATTERNS TAB */}
        {activeTab === 'patterns' && (
          <div className="tab-content">
            <div className="patterns-header">
              <div>
                <h3 className="section-title">Activity Patterns</h3>
                <p className="patterns-subtitle">Find servers with scheduled activity (e.g., squad training nights)</p>
              </div>
            </div>

            {/* Controls Row - Info on left, Grid + Filters on right */}
            <div className="patterns-controls-row">
              <div className="patterns-info">
                <p><strong>Baseline:</strong> 25th percentile avg (0-1 = dead/bot most of time)</p>
                <p><strong>Training Ratio:</strong> Peak window ÷ baseline (relative spike size)</p>
                <p><strong>Training Mode:</strong> Baseline ≤1 AND ratio ≥3x</p>
              </div>

              <div className="patterns-right-controls">
                {/* Clickable Time Grid Filter */}
                <div className="time-grid-filter">
                  <div className="time-grid-header">
                    <h4>Click to Filter by Time (ET)</h4>
                    {selectedTimeCells.size > 0 && (
                      <span className="time-grid-selection-info">
                        {selectedTimeCells.size} selected
                      </span>
                    )}
                    {selectedTimeCells.size > 0 && (
                      <button
                        className="time-grid-clear"
                        onClick={() => setSelectedTimeCells(new Set())}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="time-grid-container">
                    <div className="time-grid">
                      <div className="time-grid-row time-grid-hours-row">
                        <div className="time-grid-day-label"></div>
                        {[...Array(24)].map((_, h) => (
                          <div key={h} className="time-grid-hour-label">{h}</div>
                        ))}
                      </div>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dayIdx) => (
                        <div key={day} className="time-grid-row">
                          <div
                            className="time-grid-day-label clickable"
                            onClick={() => {
                              const dayCells = [...Array(24)].map((_, h) => `${dayIdx}-${h}`);
                              const allSelected = dayCells.every(c => selectedTimeCells.has(c));
                              setSelectedTimeCells(prev => {
                                const newSet = new Set(prev);
                                dayCells.forEach(c => {
                                  if (allSelected) newSet.delete(c);
                                  else newSet.add(c);
                                });
                                return newSet;
                              });
                              setActivePreset(null);
                            }}
                            title={`Select all ${day}`}
                          >
                            {day}
                          </div>
                          {[...Array(24)].map((_, hour) => {
                            const cellKey = `${dayIdx}-${hour}`;
                            const isSelected = selectedTimeCells.has(cellKey);
                            return (
                              <div
                                key={hour}
                                className={`time-grid-cell ${isSelected ? 'selected' : ''}`}
                                onClick={() => toggleTimeCell(dayIdx, hour)}
                                title={`${day} ${hour}:00`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Presets + Filters in one row */}
                <div className="presets-filters-row">
                  <div className="presets-section">
                    <span className="presets-label">Presets:</span>
                    {savedPresets.map(preset => (
                      <div key={preset.id} className={`preset-chip ${activePreset === preset.id ? 'active' : ''}`}>
                        <button className="preset-btn" onClick={() => loadPresetWithClear(preset)}>
                          {preset.name}
                        </button>
                        {preset.id.startsWith('custom-') && (
                          <button
                            className="preset-delete"
                            onClick={(e) => { e.stopPropagation(); deletePreset(preset.id); }}
                          >×</button>
                        )}
                      </div>
                    ))}
                    <button className="preset-clear" onClick={clearFilters}>Clear</button>
                  </div>

                  <div className="patterns-filters">
                    <label className="filter-checkbox">
                      <input
                        type="checkbox"
                        checked={patternFilters.passwordOnly}
                        onChange={(e) => setPatternFilters(f => ({ ...f, passwordOnly: e.target.checked }))}
                      />
                      <span>Password only</span>
                    </label>

                    <label className="filter-checkbox training-mode">
                      <input
                        type="checkbox"
                        checked={patternFilters.trainingMode}
                        onChange={(e) => setPatternFilters(f => ({ ...f, trainingMode: e.target.checked }))}
                      />
                      <span>Training servers</span>
                    </label>

                    <div className="filter-group">
                      <label>Day</label>
                      <select
                        value={patternFilters.peakDay ?? ''}
                        onChange={(e) => setPatternFilters(f => ({ ...f, peakDay: e.target.value ? parseInt(e.target.value) : null }))}
                      >
                        <option value="">Any</option>
                        <option value="0">Mon</option>
                        <option value="1">Tue</option>
                        <option value="2">Wed</option>
                        <option value="3">Thu</option>
                        <option value="4">Fri</option>
                        <option value="5">Sat</option>
                        <option value="6">Sun</option>
                      </select>
                    </div>

                    <div className="filter-group">
                      <label>Hours</label>
                      <div className="hour-range">
                        <select
                          value={patternFilters.peakHourStart ?? ''}
                          onChange={(e) => setPatternFilters(f => ({ ...f, peakHourStart: e.target.value ? parseInt(e.target.value) : null }))}
                        >
                          <option value="">From</option>
                          {[...Array(24)].map((_, i) => (
                            <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                          ))}
                        </select>
                        <span>-</span>
                        <select
                          value={patternFilters.peakHourEnd ?? ''}
                          onChange={(e) => setPatternFilters(f => ({ ...f, peakHourEnd: e.target.value ? parseInt(e.target.value) : null }))}
                        >
                          <option value="">To</option>
                          {[...Array(24)].map((_, i) => (
                            <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="filter-group">
                      <label>Active Hrs</label>
                      <select
                        value={patternFilters.maxActiveHours ?? ''}
                        onChange={(e) => setPatternFilters(f => ({ ...f, maxActiveHours: e.target.value ? parseInt(e.target.value) : null }))}
                      >
                        <option value="">Any</option>
                        <option value="3">≤3</option>
                        <option value="6">≤6</option>
                        <option value="12">≤12</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {patternsLoading ? (
              <div className="patterns-loading">Analyzing activity patterns...</div>
            ) : activityPatterns.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <p>No patterns found</p>
                <p className="empty-hint">Try adjusting filters or wait for more data to accumulate</p>
              </div>
            ) : (
              <div className="patterns-list">
                {activityPatterns.map(server => (
                  <div
                    key={server.server_id}
                    className="pattern-card"
                    onClick={() => selectPatternServer(server)}
                  >
                    <div className="pattern-header">
                      <h4 className="pattern-name">{server.server_name}</h4>
                      <div className="pattern-header-actions">
                        {server.password_required && <span className="pattern-badge password">🔒</span>}
                        <button
                          className={`pattern-watchlist-btn ${watchlist.includes(server.server_id) ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleWatchlist(server.server_id); }}
                          title={watchlist.includes(server.server_id) ? 'Remove from watchlist' : 'Add to watchlist'}
                        >
                          {watchlist.includes(server.server_id) ? '★' : '☆'}
                        </button>
                      </div>
                    </div>
                    <div className="pattern-stats">
                      <div className="pattern-stat peak">
                        <span className="pattern-label">Peak Time</span>
                        <span className="pattern-value">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][server.peak_day]} {server.peak_hour}:00 ET
                        </span>
                      </div>
                      <div className="pattern-stat">
                        <span className="pattern-label">Peak Avg</span>
                        <span className="pattern-value">{server.peak_avg_players} players</span>
                      </div>
                      <div className="pattern-stat">
                        <span className="pattern-label">Active Hrs</span>
                        <span className="pattern-value">{server.active_hours}</span>
                      </div>
                      <div className="pattern-stat">
                        <span className="pattern-label">Focus</span>
                        <span className="pattern-value">{server.activity_score.toFixed(1)}x</span>
                      </div>
                      <div className="pattern-stat">
                        <span className="pattern-label">Ratio</span>
                        <span className={`pattern-value ${server.training_score >= 3 && server.off_peak_avg <= 1 ? 'highlight' : ''}`}>
                          {server.training_score.toFixed(1)}x
                        </span>
                      </div>
                      <div className="pattern-stat">
                        <span className="pattern-label">Baseline</span>
                        <span className={`pattern-value ${server.off_peak_avg <= 1 ? 'highlight' : ''}`}>
                          {server.off_peak_avg}
                        </span>
                      </div>
                    </div>
                    <div className="pattern-tags">
                      {server.terrain && <span className="tag terrain">{server.terrain}</span>}
                      {server.framework && <span className="tag framework">{server.framework}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Server Details Modal */}
            {selectedPatternServer && (
              <div className="modal-overlay" onClick={() => setSelectedPatternServer(null)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>{selectedPatternServer.server_name}</h3>
                    <button className="modal-close" onClick={() => setSelectedPatternServer(null)}>×</button>
                  </div>

                  <div className="modal-body">
                    {/* Pattern Summary */}
                    <div className="modal-section">
                      <div className="modal-pattern-summary">
                        <div className="pattern-stat peak">
                          <span className="pattern-label">Peak Time</span>
                          <span className="pattern-value">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][selectedPatternServer.peak_day]} {selectedPatternServer.peak_hour}:00 ET
                          </span>
                        </div>
                        <div className="pattern-stat">
                          <span className="pattern-label">Peak Avg</span>
                          <span className="pattern-value">{selectedPatternServer.peak_avg_players} players</span>
                        </div>
                        <div className="pattern-stat">
                          <span className="pattern-label">Active Hours</span>
                          <span className="pattern-value">{selectedPatternServer.active_hours} slots</span>
                        </div>
                        <div className="pattern-stat">
                          <span className="pattern-label">Focus Score</span>
                          <span className="pattern-value">{selectedPatternServer.activity_score.toFixed(1)}x</span>
                        </div>
                        <div className="pattern-stat">
                          <span className="pattern-label">Training Ratio</span>
                          <span className={`pattern-value ${selectedPatternServer.training_score >= 3 && selectedPatternServer.off_peak_avg <= 1 ? 'highlight' : ''}`}>
                            {selectedPatternServer.training_score.toFixed(1)}x
                          </span>
                        </div>
                        <div className="pattern-stat">
                          <span className="pattern-label">Baseline</span>
                          <span className={`pattern-value ${selectedPatternServer.off_peak_avg <= 1 ? 'highlight' : ''}`}>
                            {selectedPatternServer.off_peak_avg} avg
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Server Details */}
                    {patternServerDetails && (
                      <div className="modal-section">
                        <div className="pattern-details-grid">
                          <div className="pattern-detail-section">
                            <h5>Connection</h5>
                            <code className="connection-string">
                              {patternServerDetails.ip_address?.replace('/32', '')}:{patternServerDetails.port}
                            </code>
                            <div className="detail-row">
                              <span>Version:</span>
                              <span>{patternServerDetails.dcs_version || 'N/A'}</span>
                            </div>
                            <div className="detail-row">
                              <span>Password:</span>
                              <span>{patternServerDetails.password_required ? '🔒 Required' : 'Open'}</span>
                            </div>
                            <div className="detail-row">
                              <span>Current Players:</span>
                              <span>{patternServerDetails.players_current}/{patternServerDetails.players_max}</span>
                            </div>
                          </div>

                          <div className="pattern-detail-section">
                            <h5>Community</h5>
                            {patternServerDetails.discord_url && (
                              <a href={`https://${patternServerDetails.discord_url}`} target="_blank" rel="noopener noreferrer" className="community-link discord">
                                💬 {patternServerDetails.discord_url}
                              </a>
                            )}
                            {patternServerDetails.srs_address && (
                              <div className="community-link srs">🎧 {patternServerDetails.srs_address}</div>
                            )}
                            {!patternServerDetails.discord_url && !patternServerDetails.srs_address && (
                              <p className="no-links">No community links detected</p>
                            )}
                          </div>

                          <div className="pattern-detail-section">
                            <h5>Mission</h5>
                            <p className="mission-name">{patternServerDetails.mission || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Activity Heatmap */}
                    {patternServerHeatmap.length > 0 && (
                      <div className="modal-section">
                        <h5>Activity Heatmap (ET)</h5>
                        <div className="heatmap-grid">
                          <div className="heatmap-header">
                            <div className="heatmap-corner"></div>
                            {[...Array(24)].map((_, h) => (
                              <div key={h} className="heatmap-hour">{h}</div>
                            ))}
                          </div>
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dayIdx) => (
                            <div key={day} className="heatmap-row">
                              <div className="heatmap-day">{day}</div>
                              {[...Array(24)].map((_, hour) => {
                                const cell = patternServerHeatmap.find(c => c.day === dayIdx && c.hour === hour);
                                const intensity = cell ? Math.min(cell.avg_players / 20, 1) : 0;
                                return (
                                  <div
                                    key={hour}
                                    className="heatmap-cell"
                                    style={{ backgroundColor: intensity > 0 ? `rgba(6, 182, 212, ${0.2 + intensity * 0.8})` : 'transparent' }}
                                    title={cell ? `${cell.avg_players.toFixed(1)} avg players` : 'No data'}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                        <div className="heatmap-legend">
                          <span>Low</span>
                          <div className="heatmap-legend-bar"></div>
                          <span>High</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="modal-footer">
                    <button
                      className={`pattern-action-btn ${watchlist.includes(selectedPatternServer.server_id) ? 'active' : ''}`}
                      onClick={() => toggleWatchlist(selectedPatternServer.server_id)}
                    >
                      {watchlist.includes(selectedPatternServer.server_id) ? '★ In Watchlist' : '☆ Add to Watchlist'}
                    </button>
                    <button
                      className="pattern-action-btn secondary"
                      onClick={() => { setSelectedServer(patternServerDetails); setActiveTab('servers'); setSelectedPatternServer(null); }}
                    >
                      View in Servers →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* COMPARE TAB */}
        {activeTab === 'compare' && (
          <div className="tab-content">
            {compareServers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">⊕</div>
                <p>No servers selected</p>
                <p className="empty-hint">Go to Servers tab and click ⊕ on up to 3 servers</p>
              </div>
            ) : (
              <>
                <div className="compare-header">
                  <h3>Comparing {compareServers.length} Servers</h3>
                  <button onClick={() => setCompareServers([])} className="clear-btn">Clear all</button>
                </div>
                <div className={`compare-grid cols-${compareServers.length}`}>
                  {compareServers.map(server => (
                    <div key={server.id} className="compare-card">
                      <div className="compare-card-header">
                        <h4>{server.server_name}</h4>
                        <button onClick={() => toggleCompare(server)} className="remove-btn">✕</button>
                      </div>
                      <div className="compare-players">
                        <span className="compare-current">{server.players_current}</span>
                        <span className="compare-max">/{server.players_max}</span>
                      </div>
                      <p className="compare-label">Current Players</p>
                      <div className="compare-stats">
                        <div className="compare-stat">
                          <span className="label">Terrain</span>
                          <span className="value">{server.terrain || 'N/A'}</span>
                        </div>
                        <div className="compare-stat">
                          <span className="label">Mode</span>
                          <span className="value">{server.game_mode?.toUpperCase() || 'N/A'}</span>
                        </div>
                        <div className="compare-stat">
                          <span className="label">Framework</span>
                          <span className="value">{server.framework || 'None'}</span>
                        </div>
                        <div className="compare-stat">
                          <span className="label">Discord</span>
                          <span className="value">{server.discord_url ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* WATCHLIST TAB */}
        {activeTab === 'watchlist' && (
          <div className="tab-content">
            {watchlist.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">★</div>
                <p>No servers in watchlist</p>
                <p className="empty-hint">Click ☆ on any server to add it to your watchlist</p>
              </div>
            ) : (
              <>
                <h3 className="section-title">Your Watchlist ({watchlist.length} servers)</h3>
                <div className="server-list">
                  {watchlistServers.map(server => (
                    <div
                      key={server.id}
                      className={`server-card ${selectedServer?.id === server.id ? 'selected' : ''}`}
                    >
                      <div
                        className="server-card-header"
                        onClick={() => setSelectedServer(selectedServer?.id === server.id ? null : server)}
                      >
                        <div className="server-main-info">
                          <div className="server-title-row">
                            <span className="expand-icon">{selectedServer?.id === server.id ? '▼' : '▶'}</span>
                            <h4 className="server-name">{server.server_name}</h4>
                            {server.players_current >= 20 && <span className="hot-badge">🔥</span>}
                          </div>
                          <p className="server-mission">{server.mission}</p>
                        </div>
                        <div className="server-actions">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleWatchlist(server.id); }}
                            className="watchlist-btn active"
                          >★</button>
                          <div className="player-count">
                            <span className={`players ${server.players_current >= 20 ? 'high' : server.players_current >= 5 ? 'medium' : 'low'}`}>
                              {server.players_current}
                            </span>
                            <span className="max-players">/{server.players_max}</span>
                          </div>
                        </div>
                      </div>

                      <div className="server-tags">
                        {server.terrain && <span className="tag terrain">{server.terrain.replace('_', ' ')}</span>}
                        {server.game_mode && (
                          <span className={`tag mode ${server.game_mode}`}>{server.game_mode.toUpperCase()}</span>
                        )}
                        {server.framework && <span className="tag framework">{server.framework}</span>}
                        {server.discord_url && <span className="tag discord">Discord</span>}
                        {server.srs_address && <span className="tag srs">SRS</span>}
                      </div>

                      {selectedServer?.id === server.id && (
                        <div className="server-details">
                          <div className="details-grid">
                            <div className="detail-section">
                              <h5>Connection</h5>
                              <code className="connection-string">{server.ip_address?.replace('/32', '')}:{server.port}</code>
                              <div className="detail-row">
                                <span>Version:</span>
                                <span>{server.dcs_version}</span>
                              </div>
                              <div className="detail-row">
                                <span>Password:</span>
                                <span>{server.password_required ? '🔒 Required' : 'Open'}</span>
                              </div>
                            </div>

                            <div className="detail-section">
                              <h5>Community</h5>
                              {server.discord_url && (
                                <a href={`https://${server.discord_url}`} target="_blank" rel="noopener noreferrer" className="community-link discord">
                                  💬 {server.discord_url}
                                </a>
                              )}
                              {server.srs_address && (
                                <div className="community-link srs">🎧 {server.srs_address}</div>
                              )}
                              {!server.discord_url && !server.srs_address && (
                                <p className="no-links">No community links detected</p>
                              )}
                            </div>

                            <div className="detail-section">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleCompare(server); }}
                                className={`compare-btn ${compareServers.find(s => s.id === server.id) ? 'active' : ''}`}
                              >
                                {compareServers.find(s => s.id === server.id) ? '✓ Comparing' : '⊕ Compare'}
                              </button>
                            </div>
                          </div>

                          {/* Player History Chart */}
                          <div className="history-section">
                            <div className="history-header">
                              <h5>Player History</h5>
                              <div className="history-range-buttons">
                                {[6, 12, 24, 48, 168].map(h => (
                                  <button
                                    key={h}
                                    onClick={(e) => { e.stopPropagation(); setHistoryHours(h); }}
                                    className={`history-range-btn ${historyHours === h ? 'active' : ''}`}
                                  >
                                    {h <= 24 ? `${h}h` : `${h / 24}d`}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {historyLoading ? (
                              <div className="history-loading">Loading history...</div>
                            ) : serverHistory.length > 0 ? (
                              <ResponsiveContainer width="100%" height={180}>
                                <AreaChart data={serverHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id="playerGradientWatchlist" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <XAxis
                                    dataKey="time"
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    axisLine={{ stroke: '#334155' }}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                  />
                                  <YAxis
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={[0, 'auto']}
                                  />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Area
                                    type="monotone"
                                    dataKey="players"
                                    stroke="#06b6d4"
                                    strokeWidth={2}
                                    fill="url(#playerGradientWatchlist)"
                                    name="Players"
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            ) : (
                              <div className="history-empty">No history data available</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* TERRAINS TAB */}
        {activeTab === 'terrains' && (
          <div className="tab-content">
            <div className="chart-panel full-width">
              <h3 className="panel-title">Terrain Usage</h3>
              <div className="terrain-grid">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart style={{ cursor: 'pointer' }}>
                    <Pie
                      data={terrainData}
                      cx="50%"
                      cy="50%"
                      outerRadius={130}
                      dataKey="value"
                      stroke="#1e293b"
                      strokeWidth={2}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ stroke: '#64748b' }}
                      onClick={(data) => goToFilteredServers('terrain', data.rawName)}
                    >
                      {terrainData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} style={{ cursor: 'pointer' }} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="terrain-stats">
                  {terrainData.map((terrain, i) => (
                    <div
                      key={i}
                      className="terrain-stat-card clickable"
                      onClick={() => goToFilteredServers('terrain', terrain.rawName)}
                    >
                      <div className="terrain-color" style={{ backgroundColor: terrain.fill }} />
                      <span className="terrain-name">{terrain.name}</span>
                      <span className="terrain-count">{terrain.value} servers</span>
                      <span className="terrain-players">{terrain.players} players</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TRENDS TAB */}
        {activeTab === 'trends' && (
          <div className="tab-content">
            {/* Summary Cards */}
            <div className="trends-grid">
              <div className="chart-panel trend-leader green">
                <h4>📈 Most Popular Framework</h4>
                <p className="trend-value">{frameworkData[0]?.name || 'N/A'}</p>
                <p className="trend-desc">{frameworkData[0]?.servers || 0} servers, {frameworkData[0]?.players || 0} players online</p>
              </div>
              <div className="chart-panel trend-leader blue">
                <h4>🗺️ Top Terrain</h4>
                <p className="trend-value">{terrainData[0]?.name || 'N/A'}</p>
                <p className="trend-desc">{terrainData[0]?.value || 0} servers, {terrainData[0]?.players || 0} players online</p>
              </div>
              <div className="chart-panel trend-leader cyan">
                <h4>🎯 Server Utilization</h4>
                <p className="trend-value">{stats ? ((stats.total_players / (stats.active_servers * 50)) * 100).toFixed(1) : 0}%</p>
                <p className="trend-desc">Average capacity utilization</p>
              </div>
            </div>

            {/* Time Range Selector */}
            <div className="trends-range-selector">
              <span>Show last:</span>
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setTrendsDays(d)}
                  className={`trends-range-btn ${trendsDays === d ? 'active' : ''}`}
                >
                  {d} days
                </button>
              ))}
            </div>

            {/* Player Count Trend */}
            <div className="chart-panel full-width">
              <h3 className="panel-title">Player Count Over Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={ecosystemTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="playerTrendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="players" stroke="#10b981" strokeWidth={2} fill="url(#playerTrendGradient)" name="Total Players" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Two Column Layout */}
            <div className="trends-two-col">
              {/* Active Servers Trend */}
              <div className="chart-panel">
                <h3 className="panel-title">Active Servers</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={ecosystemTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="activeServers" stroke="#3b82f6" strokeWidth={2} dot={false} name="Active Servers" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Multiplayer Sessions Trend */}
              <div className="chart-panel">
                <h3 className="panel-title">Multiplayer Sessions</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={ecosystemTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="multiplayer" stroke="#f59e0b" strokeWidth={2} dot={false} name="Multiplayer Sessions" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Framework Comparison */}
            <div className="chart-panel full-width">
              <h3 className="panel-title">Framework Comparison</h3>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={frameworkData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="servers" fill="#3b82f6" name="Servers" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="players" stroke="#10b981" strokeWidth={2} name="Players" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Terrain Comparison */}
            <div className="chart-panel full-width">
              <h3 className="panel-title">Terrain Comparison</h3>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={terrainData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="value" name="Servers" radius={[4, 4, 0, 0]}>
                    {terrainData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="players" stroke="#10b981" strokeWidth={2} name="Players" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="footer">
          <p>DCS Server Intelligence • {stats?.total_servers?.toLocaleString() || 0} servers • {stats?.total_players?.toLocaleString() || 0} players online</p>
        </footer>
      </div>
    </div>
  );
};

export default DCSServerIntelligence;
