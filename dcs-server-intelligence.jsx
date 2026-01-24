import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart, Legend } from 'recharts';

const DCSServerIntelligence = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedServer, setSelectedServer] = useState(null);
  const [serverFilter, setServerFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('7d');
  const [compareServers, setCompareServers] = useState([]);
  const [watchlist, setWatchlist] = useState([1, 5, 9]);

  // Ecosystem daily stats (30 days)
  const ecosystemHistory = [
    { date: 'Dec 7', totalPlayers: 2450, activeServers: 1680, peakConcurrent: 3200 },
    { date: 'Dec 14', totalPlayers: 2890, activeServers: 1750, peakConcurrent: 3680 },
    { date: 'Dec 21', totalPlayers: 3250, activeServers: 1790, peakConcurrent: 4100 },
    { date: 'Dec 25', totalPlayers: 3680, activeServers: 1850, peakConcurrent: 4580 },
    { date: 'Dec 28', totalPlayers: 3450, activeServers: 1815, peakConcurrent: 4320 },
    { date: 'Jan 1', totalPlayers: 4120, activeServers: 1920, peakConcurrent: 5200 },
    { date: 'Jan 5', totalPlayers: 2863, activeServers: 1774, peakConcurrent: 3650 },
  ];

  // Framework trends (weekly)
  const frameworkTrends = [
    { week: 'W48', foothold: 210, pretense: 32, tti: 48, blueflag: 12 },
    { week: 'W49', foothold: 225, pretense: 35, tti: 46, blueflag: 10 },
    { week: 'W50', foothold: 238, pretense: 38, tti: 45, blueflag: 8 },
    { week: 'W51', foothold: 245, pretense: 42, tti: 44, blueflag: 5 },
    { week: 'W52', foothold: 250, pretense: 44, tti: 44, blueflag: 4 },
    { week: 'W1', foothold: 253, pretense: 45, tti: 44, blueflag: 3 },
  ];

  // Activity heatmap
  const activityHeatmap = [
    { hour: '00', sun: 45, mon: 22, tue: 18, wed: 20, thu: 19, fri: 28, sat: 52 },
    { hour: '04', sun: 25, mon: 10, tue: 8, wed: 9, thu: 8, fri: 12, sat: 28 },
    { hour: '08', sun: 22, mon: 15, tue: 14, wed: 15, thu: 14, fri: 16, sat: 25 },
    { hour: '12', sun: 48, mon: 38, tue: 35, wed: 36, thu: 35, fri: 40, sat: 52 },
    { hour: '16', sun: 72, mon: 55, tue: 52, wed: 54, thu: 53, fri: 60, sat: 78 },
    { hour: '20', sun: 95, mon: 82, tue: 78, wed: 80, thu: 79, fri: 88, sat: 98 },
  ];

  // Full server list with enrichment
  const serverList = [
    { 
      id: 1, name: '[SPS] Contention | PVP | Persistent Dynamic Campaign',
      players: 60, max: 70, ip: '147.135.72.74', port: 10308,
      mission: 'Contention_PG_v3.2', password: false, version: '2.9.23.18431',
      terrain: 'Persian Gulf', era: 'Modern', mode: 'PVP', framework: null,
      discord: 'discord.gg/StrikePackageSRS', srs: '147.135.72.74:5002',
      website: 'https://strikepackagesrs.com', tacview: '147.135.72.74:42674',
      gci: 'https://sps-gci.com',
      description: 'Strike Package SRS - persistent PVP campaign with dynamic objectives and territory control.',
      uptime: 99.2, avgPlayers7d: 42, avgPlayers30d: 38, peakPlayers: 68, peakTime: '20:00 UTC',
      playerHistory: [
        { time: '00:00', players: 28 }, { time: '04:00', players: 12 },
        { time: '08:00', players: 15 }, { time: '12:00', players: 35 },
        { time: '16:00', players: 52 }, { time: '20:00', players: 65 },
      ],
      dailyHistory: [
        { date: 'Dec 30', avg: 38, peak: 62 }, { date: 'Jan 1', avg: 52, peak: 70 },
        { date: 'Jan 3', avg: 42, peak: 58 }, { date: 'Jan 5', avg: 42, peak: 60 },
      ],
      trend: 12.5, rank: 1, rankChange: 0, healthScore: 94, cgi: 8.7, stickiness: 0.72,
      firstSeen: '2023-06-15', tags: ['competitive', 'active-admins', 'events']
    },
    { 
      id: 2, name: 'Growling Sidewinder Open Conflict Server 1',
      players: 43, max: 68, ip: '45.76.2.150', port: 10308,
      mission: 'GS_OpenConflict_Syria_v4.1', password: false, version: '2.9.23.18431',
      terrain: 'Syria', era: 'Modern', mode: 'PVP', framework: null,
      discord: 'discord.gg/growlingsidewinder', srs: '45.76.2.150:5002',
      website: 'https://growlingsidewinder.com', tacview: '45.76.2.150:42674', gci: null,
      description: 'Premier PVP server with realistic scenarios and active GCI.',
      uptime: 98.5, avgPlayers7d: 38, avgPlayers30d: 35, peakPlayers: 65, peakTime: '21:00 UTC',
      playerHistory: [
        { time: '00:00', players: 22 }, { time: '04:00', players: 8 },
        { time: '08:00', players: 12 }, { time: '12:00', players: 28 },
        { time: '16:00', players: 45 }, { time: '20:00', players: 58 },
      ],
      dailyHistory: [
        { date: 'Dec 30', avg: 32, peak: 55 }, { date: 'Jan 1', avg: 45, peak: 65 },
        { date: 'Jan 3', avg: 38, peak: 52 }, { date: 'Jan 5', avg: 38, peak: 55 },
      ],
      trend: 8.2, rank: 2, rankChange: 1, healthScore: 91, cgi: 8.2, stickiness: 0.68,
      firstSeen: '2022-03-20', tags: ['competitive', 'gci-available', 'beginner-friendly']
    },
    { 
      id: 3, name: '[SPS] Contention Cold War | PVP',
      players: 42, max: 70, ip: '147.135.72.75', port: 10308,
      mission: 'Contention_CW_v2.1', password: false, version: '2.9.23.18431',
      terrain: 'Caucasus', era: 'Cold War', mode: 'PVP', framework: null,
      discord: 'discord.gg/StrikePackageSRS', srs: '147.135.72.75:5002',
      website: 'https://strikepackagesrs.com', tacview: '147.135.72.75:42674', gci: null,
      description: 'Cold War era featuring F-14A, MiG-23, and period-accurate weapons.',
      uptime: 98.8, avgPlayers7d: 35, avgPlayers30d: 32, peakPlayers: 62, peakTime: '20:00 UTC',
      playerHistory: [
        { time: '00:00', players: 20 }, { time: '04:00', players: 6 },
        { time: '08:00', players: 10 }, { time: '12:00', players: 25 },
        { time: '16:00', players: 42 }, { time: '20:00', players: 55 },
      ],
      dailyHistory: [
        { date: 'Dec 30', avg: 28, peak: 48 }, { date: 'Jan 1', avg: 42, peak: 62 },
        { date: 'Jan 3', avg: 32, peak: 48 }, { date: 'Jan 5', avg: 35, peak: 52 },
      ],
      trend: 15.8, rank: 3, rankChange: 2, healthScore: 92, cgi: 7.8, stickiness: 0.65,
      firstSeen: '2024-02-10', tags: ['cold-war', 'competitive']
    },
    { 
      id: 4, name: '[4YA] TRAINING 24/7 CAUCASUS PVE',
      players: 32, max: 62, ip: '51.195.85.191', port: 10308,
      mission: '4YA_Training_v4.5', password: false, version: '2.9.23.18431',
      terrain: 'Caucasus', era: 'Modern', mode: 'PVE', framework: null,
      discord: 'discord.gg/CaYRRDd', srs: '51.195.85.191:5002',
      website: 'https://4ya.info', tacview: null, gci: null,
      description: 'Training server with various PvE scenarios. Beginner friendly.',
      uptime: 99.8, avgPlayers7d: 28, avgPlayers30d: 26, peakPlayers: 55, peakTime: '19:00 UTC',
      playerHistory: [
        { time: '00:00', players: 15 }, { time: '04:00', players: 4 },
        { time: '08:00', players: 8 }, { time: '12:00', players: 22 },
        { time: '16:00', players: 35 }, { time: '20:00', players: 38 },
      ],
      dailyHistory: [
        { date: 'Dec 30', avg: 24, peak: 45 }, { date: 'Jan 1', avg: 32, peak: 55 },
        { date: 'Jan 3', avg: 26, peak: 42 }, { date: 'Jan 5', avg: 28, peak: 48 },
      ],
      trend: 5.2, rank: 4, rankChange: 0, healthScore: 96, cgi: 7.5, stickiness: 0.58,
      firstSeen: '2021-08-05', tags: ['training', 'beginner-friendly', '24-7']
    },
    { 
      id: 5, name: 'BUDDYSPIKE BLUE FLAG - 80s',
      players: 31, max: 60, ip: '45.33.45.162', port: 10308,
      mission: 'BlueFlag_80s_v8.2', password: false, version: '2.9.23.18431',
      terrain: 'Caucasus', era: 'Cold War', mode: 'PVP', framework: 'BlueFLAG',
      discord: 'discord.gg/KSFd5uV', srs: '45.33.45.162:5002',
      website: 'http://gadget2.buddyspike.net', tacview: '45.33.45.162:42674',
      gci: 'http://gadget2.buddyspike.net/gci',
      description: 'The original Blue Flag persistent campaign with dynamic frontlines.',
      uptime: 97.5, avgPlayers7d: 25, avgPlayers30d: 28, peakPlayers: 58, peakTime: '21:00 UTC',
      playerHistory: [
        { time: '00:00', players: 18 }, { time: '04:00', players: 5 },
        { time: '08:00', players: 8 }, { time: '12:00', players: 22 },
        { time: '16:00', players: 38 }, { time: '20:00', players: 52 },
      ],
      dailyHistory: [
        { date: 'Dec 30', avg: 22, peak: 42 }, { date: 'Jan 1', avg: 32, peak: 58 },
        { date: 'Jan 3', avg: 24, peak: 42 }, { date: 'Jan 5', avg: 25, peak: 45 },
      ],
      trend: -8.5, rank: 5, rankChange: -2, healthScore: 85, cgi: 6.8, stickiness: 0.62,
      firstSeen: '2019-04-12', tags: ['cold-war', 'persistent', 'legendary']
    },
    { 
      id: 6, name: 'BSC | Pretense Syria | RealWX',
      players: 30, max: 30, ip: '85.215.44.12', port: 10308,
      mission: 'Pretense_Syria_v2.8', password: false, version: '2.9.23.18431',
      terrain: 'Syria', era: 'Modern', mode: 'PVE', framework: 'Pretense',
      discord: 'discord.gg/bsc-dcs', srs: '85.215.44.12:5002',
      website: 'https://bsc-dcs.com', tacview: null, gci: null,
      description: 'Dynamic PvE using Pretense with real weather integration.',
      uptime: 99.1, avgPlayers7d: 24, avgPlayers30d: 22, peakPlayers: 30, peakTime: '20:00 UTC',
      playerHistory: [
        { time: '00:00', players: 12 }, { time: '04:00', players: 3 },
        { time: '08:00', players: 5 }, { time: '12:00', players: 18 },
        { time: '16:00', players: 26 }, { time: '20:00', players: 30 },
      ],
      dailyHistory: [
        { date: 'Dec 30', avg: 20, peak: 28 }, { date: 'Jan 1', avg: 26, peak: 30 },
        { date: 'Jan 3', avg: 22, peak: 28 }, { date: 'Jan 5', avg: 24, peak: 30 },
      ],
      trend: 18.5, rank: 6, rankChange: 3, healthScore: 93, cgi: 7.2, stickiness: 0.78,
      firstSeen: '2024-05-20', tags: ['pretense', 'real-weather', 'rising-star']
    },
    { 
      id: 7, name: 'RotorHeads Server PVE',
      players: 23, max: 50, ip: '147.135.9.170', port: 10308,
      mission: 'RotorHeads_v3.1', password: false, version: '2.9.23.18431',
      terrain: 'Caucasus', era: 'Modern', mode: 'PVE', framework: 'RotorHeads',
      discord: 'discord.gg/hRYv7Cq', srs: '147.135.9.170:5002',
      website: null, tacview: null, gci: null,
      description: 'Helicopter-focused PvE with logistics, SAR, and CAS missions.',
      uptime: 98.2, avgPlayers7d: 18, avgPlayers30d: 16, peakPlayers: 42, peakTime: '19:00 UTC',
      playerHistory: [
        { time: '00:00', players: 8 }, { time: '04:00', players: 2 },
        { time: '08:00', players: 4 }, { time: '12:00', players: 15 },
        { time: '16:00', players: 22 }, { time: '20:00', players: 25 },
      ],
      dailyHistory: [
        { date: 'Dec 30', avg: 14, peak: 32 }, { date: 'Jan 1', avg: 22, peak: 42 },
        { date: 'Jan 3', avg: 16, peak: 30 }, { date: 'Jan 5', avg: 18, peak: 35 },
      ],
      trend: 6.2, rank: 7, rankChange: 1, healthScore: 88, cgi: 6.5, stickiness: 0.72,
      firstSeen: '2022-11-08', tags: ['helicopters', 'logistics', 'sar']
    },
    { 
      id: 8, name: 'Grayflag Persian Gulf',
      players: 21, max: 65, ip: '45.76.13.88', port: 10308,
      mission: 'Grayflag_PG_v4.2', password: false, version: '2.9.23.18431',
      terrain: 'Persian Gulf', era: 'Modern', mode: 'PVP', framework: 'Grayflag',
      discord: 'discord.gg/deathfromabove', srs: '45.76.13.88:5002',
      website: 'https://deathfromabove.gg', tacview: '45.76.13.88:42674', gci: null,
      description: 'Grayflag persistent campaign with dynamic frontlines and ground war.',
      uptime: 96.8, avgPlayers7d: 16, avgPlayers30d: 18, peakPlayers: 48, peakTime: '22:00 UTC',
      playerHistory: [
        { time: '00:00', players: 15 }, { time: '04:00', players: 4 },
        { time: '08:00', players: 5 }, { time: '12:00', players: 14 },
        { time: '16:00', players: 22 }, { time: '20:00', players: 35 },
      ],
      dailyHistory: [
        { date: 'Dec 30', avg: 15, peak: 35 }, { date: 'Jan 1', avg: 20, peak: 48 },
        { date: 'Jan 3', avg: 14, peak: 32 }, { date: 'Jan 5', avg: 16, peak: 35 },
      ],
      trend: -5.2, rank: 8, rankChange: -1, healthScore: 82, cgi: 5.8, stickiness: 0.55,
      firstSeen: '2023-09-15', tags: ['grayflag', 'persistent', 'ground-war']
    },
    { 
      id: 9, name: 'Through The Inferno [107th]',
      players: 15, max: 107, ip: '207.32.218.179', port: 10308,
      mission: 'TTI_Caucasus_v5.1', password: false, version: '2.9.23.18431',
      terrain: 'Caucasus', era: 'Modern', mode: 'PVE', framework: 'TTI',
      discord: 'discord.gg/tti-dcs', srs: '207.32.218.179:5002',
      website: 'https://throughtheinferno.com', tacview: null, gci: null,
      description: 'TTI dynamic PvE - earn points, unlock aircraft, progress through campaign.',
      uptime: 99.5, avgPlayers7d: 12, avgPlayers30d: 14, peakPlayers: 85, peakTime: '02:00 UTC',
      playerHistory: [
        { time: '00:00', players: 25 }, { time: '04:00', players: 18 },
        { time: '08:00', players: 5 }, { time: '12:00', players: 10 },
        { time: '16:00', players: 14 }, { time: '20:00', players: 18 },
      ],
      dailyHistory: [
        { date: 'Dec 30', avg: 10, peak: 65 }, { date: 'Jan 1', avg: 18, peak: 85 },
        { date: 'Jan 3', avg: 11, peak: 55 }, { date: 'Jan 5', avg: 12, peak: 58 },
      ],
      trend: 2.5, rank: 9, rankChange: 0, healthScore: 90, cgi: 5.5, stickiness: 0.48,
      firstSeen: '2020-06-22', tags: ['tti', 'progression', 'na-peak']
    },
    { 
      id: 10, name: 'Burning Skies NA | Foothold',
      players: 9, max: 66, ip: '15.235.65.122', port: 10308,
      mission: 'Foothold_Caucasus_Live', password: false, version: '2.9.23.18431',
      terrain: 'Caucasus', era: 'Modern', mode: 'PVE', framework: 'Foothold',
      discord: 'discord.gg/burningskies', srs: '15.235.65.122:5002',
      website: 'http://dcsburningskies.mywire.org:8080', tacview: null,
      gci: 'http://dcsburningskies.mywire.org:8080',
      description: 'Custom 12hr persistent missions using Foothold with AWACS bot.',
      uptime: 97.2, avgPlayers7d: 8, avgPlayers30d: 10, peakPlayers: 45, peakTime: '01:00 UTC',
      playerHistory: [
        { time: '00:00', players: 18 }, { time: '04:00', players: 8 },
        { time: '08:00', players: 3 }, { time: '12:00', players: 6 },
        { time: '16:00', players: 10 }, { time: '20:00', players: 14 },
      ],
      dailyHistory: [
        { date: 'Dec 30', avg: 7, peak: 32 }, { date: 'Jan 1', avg: 12, peak: 45 },
        { date: 'Jan 3', avg: 7, peak: 28 }, { date: 'Jan 5', avg: 8, peak: 32 },
      ],
      trend: 25.8, rank: 10, rankChange: 5, healthScore: 86, cgi: 4.8, stickiness: 0.62,
      firstSeen: '2024-08-10', tags: ['foothold', 'na-peak', 'rising-star', 'awacs-bot']
    },
    { 
      id: 11, name: 'VFA168 Training Server',
      players: 1, max: 32, ip: '118.114.196.47', port: 10245,
      mission: 'BVR Training v1.9', password: false, version: '2.9.22.17790',
      terrain: 'Caucasus', era: 'Modern', mode: 'Training', framework: null,
      discord: null, srs: null, website: 'http://bbs.flightnet.cn',
      tacview: null, gci: null, qqGroup: '341733884', teamspeak: 'ts.vfa168.cn',
      description: 'VFA168 BVR combat training server with TeamSpeak and QQ group.',
      uptime: 92.1, avgPlayers7d: 2, avgPlayers30d: 3, peakPlayers: 18, peakTime: '13:00 UTC',
      playerHistory: [
        { time: '00:00', players: 1 }, { time: '04:00', players: 0 },
        { time: '08:00', players: 2 }, { time: '12:00', players: 5 },
        { time: '16:00', players: 3 }, { time: '20:00', players: 1 },
      ],
      dailyHistory: [
        { date: 'Dec 30', avg: 2, peak: 12 }, { date: 'Jan 1', avg: 4, peak: 18 },
        { date: 'Jan 3', avg: 2, peak: 8 }, { date: 'Jan 5', avg: 2, peak: 6 },
      ],
      trend: -12.5, rank: 45, rankChange: -5, healthScore: 68, cgi: 2.1, stickiness: 0.35,
      firstSeen: '2023-01-15', tags: ['chinese', 'training', 'bvr']
    },
  ];

  // Summary stats
  const summaryStats = {
    totalServers: 1790, totalPlayers: 2863, totalCapacity: 63501,
    activeServers: 1774, uniqueHosts: 1133, discordEnabled: 229, srsEnabled: 144,
    playersChange: 12.5, serversChange: 3.2, peakToday: 3650, peakAllTime: 5200,
    peakAllTimeDate: 'Jan 1, 2025', newServers7d: 28, deadServers7d: 12
  };

  // Framework data
  const frameworkData = [
    { name: 'Foothold', servers: 253, fill: '#3b82f6', trend: 12 },
    { name: 'Pretense', servers: 45, fill: '#10b981', trend: 28 },
    { name: 'TTI', servers: 44, fill: '#f59e0b', trend: -2 },
    { name: 'Grayflag', servers: 6, fill: '#8b5cf6', trend: -15 },
    { name: 'BlueFLAG', servers: 3, fill: '#06b6d4', trend: -40 },
  ];

  // Terrain data
  const terrainData = [
    { name: 'Caucasus', value: 160, fill: '#3b82f6' },
    { name: 'Syria', value: 129, fill: '#ef4444' },
    { name: 'Persian Gulf', value: 79, fill: '#f59e0b' },
    { name: 'Marianas', value: 78, fill: '#10b981' },
    { name: 'Nevada', value: 62, fill: '#8b5cf6' },
    { name: 'Kola', value: 41, fill: '#06b6d4' },
  ];

  // Multiplayer distribution
  const multiplayerDistribution = [
    { range: '2-5', count: 207, fill: '#3b82f6' },
    { range: '6-10', count: 28, fill: '#10b981' },
    { range: '11-20', count: 13, fill: '#f59e0b' },
    { range: '21-40', count: 8, fill: '#ef4444' },
    { range: '41+', count: 3, fill: '#8b5cf6' },
  ];

  // Rising stars
  const risingStars = serverList.filter(s => s.trend > 10).sort((a, b) => b.trend - a.trend);

  // Helper components
  const StatCard = ({ title, value, subtitle, icon, trend, trendLabel }) => (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-5 hover:border-cyan-500/30 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-white mt-1 font-mono">{value}</p>
          {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
        </div>
        <div className="text-2xl opacity-50">{icon}</div>
      </div>
      {trend !== undefined && (
        <div className={`mt-3 text-xs font-medium ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}% {trendLabel || 'vs last week'}
        </div>
      )}
    </div>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-cyan-400 font-medium text-sm">{label}</p>
          {payload.map((p, i) => (
            <p key={i} className="text-white font-mono text-sm">{p.name}: {p.value?.toLocaleString()}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  const TrendBadge = ({ value }) => (
    <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${
      value > 0 ? 'bg-emerald-500/20 text-emerald-400' : 
      value < 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-500/20 text-slate-400'
    }`}>
      {value > 0 ? '↑' : value < 0 ? '↓' : '→'}{Math.abs(value)}%
    </span>
  );

  const toggleWatchlist = (id) => setWatchlist(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleCompare = (server) => setCompareServers(prev => {
    if (prev.find(s => s.id === server.id)) return prev.filter(s => s.id !== server.id);
    if (prev.length >= 3) return prev;
    return [...prev, server];
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />
      
      <div className="relative max-w-[1600px] mx-auto p-6">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-2xl font-bold shadow-lg shadow-cyan-500/20">✈</div>
              <div>
                <h1 className="text-2xl font-bold">DCS Server Intelligence</h1>
                <p className="text-slate-400 text-sm">Real-time analytics & historical trends</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-slate-400 text-xs">Last updated</p>
                <p className="text-white font-mono text-sm">14:32 UTC</p>
              </div>
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            </div>
          </div>
          
          <nav className="flex gap-2 mt-6 border-b border-slate-800 pb-4 overflow-x-auto">
            {['overview', 'servers', 'trends', 'compare', 'watchlist', 'terrains'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'watchlist' && watchlist.length > 0 && (
                  <span className="ml-1.5 bg-yellow-500/20 text-yellow-400 text-xs px-1.5 py-0.5 rounded-full">{watchlist.length}</span>
                )}
                {tab === 'compare' && compareServers.length > 0 && (
                  <span className="ml-1.5 bg-purple-500/20 text-purple-400 text-xs px-1.5 py-0.5 rounded-full">{compareServers.length}</span>
                )}
              </button>
            ))}
          </nav>
        </header>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Players Online" value={summaryStats.totalPlayers.toLocaleString()} subtitle={`Peak today: ${summaryStats.peakToday.toLocaleString()}`} icon="👥" trend={summaryStats.playersChange} />
              <StatCard title="Active Servers" value={summaryStats.activeServers.toLocaleString()} subtitle={`${summaryStats.newServers7d} new this week`} icon="🖥️" trend={summaryStats.serversChange} />
              <StatCard title="Peak All-Time" value={summaryStats.peakAllTime.toLocaleString()} subtitle={summaryStats.peakAllTimeDate} icon="🏆" />
              <StatCard title="Multiplayer" value="259" subtitle="14.6% of active" icon="🎮" trend={8.5} />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">Ecosystem Activity</h3>
                  <div className="flex gap-2">
                    {['7d', '14d', '30d'].map(r => (
                      <button key={r} onClick={() => setTimeRange(r)} className={`px-2 py-1 text-xs rounded ${timeRange === r ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400'}`}>{r}</button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={ecosystemHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="playersGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/><stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="peakConcurrent" stroke="#8b5cf6" fill="none" strokeWidth={2} name="Peak" />
                    <Area type="monotone" dataKey="totalPlayers" stroke="#06b6d4" fill="url(#playersGrad)" strokeWidth={2} name="Avg Players" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><span className="text-orange-400">🔥</span> Rising Stars</h3>
                <div className="space-y-3">
                  {risingStars.slice(0, 5).map((server, i) => (
                    <div key={server.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/30 cursor-pointer" onClick={() => { setSelectedServer(server); setActiveTab('servers'); }}>
                      <span className="text-slate-500 font-mono text-sm w-6">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{server.name}</p>
                        <p className="text-slate-400 text-xs">{server.terrain} • {server.mode}</p>
                      </div>
                      <TrendBadge value={server.trend} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Framework Trends</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={frameworkTrends} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="foothold" stroke="#3b82f6" strokeWidth={2} dot={false} name="Foothold" />
                    <Line type="monotone" dataKey="pretense" stroke="#10b981" strokeWidth={2} dot={false} name="Pretense" />
                    <Line type="monotone" dataKey="tti" stroke="#f59e0b" strokeWidth={2} dot={false} name="TTI" />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-3">
                  {frameworkData.slice(0, 3).map(f => (
                    <div key={f.name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.fill }} />
                      <span className="text-slate-400 text-xs">{f.name}</span>
                      <TrendBadge value={f.trend} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Best Times to Play</h3>
                <div className="grid grid-cols-8 gap-1 text-xs">
                  <div></div>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (<div key={i} className="text-center text-slate-500">{d}</div>))}
                  {activityHeatmap.map((row, i) => (
                    <React.Fragment key={i}>
                      <div className="text-slate-500 text-right pr-1">{row.hour}</div>
                      {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day, j) => (
                        <div key={j} className="aspect-square rounded-sm" style={{ backgroundColor: `rgba(6, 182, 212, ${row[day] / 100})` }} title={`${row[day]}%`} />
                      ))}
                    </React.Fragment>
                  ))}
                </div>
                <p className="text-slate-500 text-xs mt-3 text-center">Peak: Weekends 18:00-22:00 UTC</p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-2">Server Population</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-slate-900/50 rounded-lg p-2 border-l-4 border-slate-500">
                    <p className="text-slate-400 text-xs">Solo/Bot</p>
                    <p className="text-xl font-bold text-white">1,515</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-2 border-l-4 border-cyan-500">
                    <p className="text-cyan-400 text-xs">Multiplayer</p>
                    <p className="text-xl font-bold text-white">259</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={multiplayerDistribution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>{multiplayerDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* SERVERS TAB */}
        {activeTab === 'servers' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <input type="text" placeholder="Search servers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-[200px] bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50" />
                <div className="flex gap-2 flex-wrap">
                  {['all', 'multiplayer', 'pvp', 'pve', 'frameworks', 'rising'].map(f => (
                    <button key={f} onClick={() => setServerFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${serverFilter === f ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 bg-slate-900/50 border border-slate-700'}`}>
                      {f === 'rising' ? '🔥 Rising' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Server List with Inline Details */}
            <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
              {serverList
                .filter(s => {
                  if (serverFilter === 'multiplayer') return s.players >= 2;
                  if (serverFilter === 'pvp') return s.mode === 'PVP';
                  if (serverFilter === 'pve') return s.mode === 'PVE';
                  if (serverFilter === 'frameworks') return s.framework;
                  if (serverFilter === 'rising') return s.trend > 10;
                  return true;
                })
                .filter(s => !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.terrain?.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(server => (
                  <div key={server.id} className={`bg-slate-800/50 border rounded-xl transition-all ${selectedServer?.id === server.id ? 'border-cyan-500/50 bg-slate-800/80' : 'border-slate-700/50 hover:border-cyan-500/30'}`}>
                    {/* Server Row - Always Visible */}
                    <div 
                      onClick={() => setSelectedServer(selectedServer?.id === server.id ? null : server)}
                      className="p-4 cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${selectedServer?.id === server.id ? 'text-cyan-400' : 'text-slate-500'}`}>
                              {selectedServer?.id === server.id ? '▼' : '▶'}
                            </span>
                            <h4 className="text-white font-medium truncate">{server.name}</h4>
                            {server.trend > 15 && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">🔥</span>}
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5 truncate ml-5">{server.mission}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={(e) => { e.stopPropagation(); toggleWatchlist(server.id); }}
                            className={`text-lg ${watchlist.includes(server.id) ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-400'}`}>
                            {watchlist.includes(server.id) ? '★' : '☆'}
                          </button>
                          <div className="text-right">
                            <span className={`text-lg font-bold ${server.players >= 20 ? 'text-emerald-400' : server.players >= 5 ? 'text-cyan-400' : 'text-slate-500'}`}>{server.players}</span>
                            <span className="text-slate-500 text-sm">/{server.max}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between ml-5">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-300">{server.terrain}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${server.mode === 'PVP' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{server.mode}</span>
                          {server.framework && <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">{server.framework}</span>}
                          {server.discord && <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400">Discord</span>}
                          {server.srs && <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">SRS</span>}
                        </div>
                        <TrendBadge value={server.trend} />
                      </div>
                    </div>

                    {/* Expanded Details - Shows Below Entry When Selected */}
                    {selectedServer?.id === server.id && (
                      <div className="border-t border-slate-700/50 p-4 bg-slate-900/30">
                        <div className="grid md:grid-cols-3 gap-4">
                          {/* Left Column - Stats & Chart */}
                          <div className="space-y-4">
                            {/* Player Stats */}
                            <div className="bg-slate-800/50 rounded-lg p-3">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-slate-400 text-sm">Players</span>
                                <span className="text-xl font-bold text-white">{server.players}<span className="text-slate-500 text-base">/{server.max}</span></span>
                              </div>
                              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-2">
                                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: `${(server.players / server.max) * 100}%` }} />
                              </div>
                              <div className="grid grid-cols-4 gap-1 text-center text-xs">
                                <div><p className="text-slate-500">7d</p><p className="text-white">{server.avgPlayers7d}</p></div>
                                <div><p className="text-slate-500">30d</p><p className="text-white">{server.avgPlayers30d}</p></div>
                                <div><p className="text-slate-500">Peak</p><p className="text-white">{server.peakPlayers}</p></div>
                                <div><p className="text-slate-500">Best</p><p className="text-cyan-400 text-[10px]">{server.peakTime}</p></div>
                              </div>
                            </div>

                            {/* Health Metrics */}
                            <div className="grid grid-cols-4 gap-2">
                              <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                                <p className="text-slate-500 text-[10px]">Health</p>
                                <p className={`text-sm font-bold ${server.healthScore >= 90 ? 'text-emerald-400' : server.healthScore >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>{server.healthScore}</p>
                              </div>
                              <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                                <p className="text-slate-500 text-[10px]">CGI</p>
                                <p className="text-sm font-bold text-cyan-400">{server.cgi}</p>
                              </div>
                              <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                                <p className="text-slate-500 text-[10px]">Uptime</p>
                                <p className="text-sm font-bold text-emerald-400">{server.uptime}%</p>
                              </div>
                              <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                                <p className="text-slate-500 text-[10px]">Sticky</p>
                                <p className="text-sm font-bold text-blue-400">{Math.round(server.stickiness * 100)}%</p>
                              </div>
                            </div>

                            {/* Hourly Chart */}
                            <div className="bg-slate-800/50 rounded-lg p-3">
                              <p className="text-slate-400 text-xs mb-2">Typical Day (UTC)</p>
                              <ResponsiveContainer width="100%" height={60}>
                                <AreaChart data={server.playerHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                  <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 8 }} axisLine={false} tickLine={false} interval={1} />
                                  <YAxis hide />
                                  <Area type="monotone" dataKey="players" stroke="#06b6d4" fill="url(#playersGrad)" strokeWidth={1.5} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Middle Column - Server Info */}
                          <div className="space-y-3">
                            <div className="bg-slate-800/50 rounded-lg p-3 space-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-slate-400">Terrain</span><span className="text-white">{server.terrain}</span></div>
                              <div className="flex justify-between"><span className="text-slate-400">Era</span><span className="text-white">{server.era}</span></div>
                              <div className="flex justify-between"><span className="text-slate-400">Mode</span><span className={server.mode === 'PVP' ? 'text-rose-400' : server.mode === 'PVE' ? 'text-emerald-400' : 'text-blue-400'}>{server.mode}</span></div>
                              {server.framework && <div className="flex justify-between"><span className="text-slate-400">Framework</span><span className="text-purple-400">{server.framework}</span></div>}
                              <div className="flex justify-between"><span className="text-slate-400">Version</span><span className="text-slate-300 font-mono text-xs">{server.version}</span></div>
                              <div className="flex justify-between"><span className="text-slate-400">Password</span><span className={server.password ? 'text-amber-400' : 'text-emerald-400'}>{server.password ? '🔒 Yes' : 'Open'}</span></div>
                              <div className="flex justify-between"><span className="text-slate-400">Rank</span><span className="text-white">#{server.rank} {server.rankChange !== 0 && <span className={server.rankChange > 0 ? 'text-emerald-400' : 'text-rose-400'}>{server.rankChange > 0 ? '↑' : '↓'}{Math.abs(server.rankChange)}</span>}</span></div>
                              <div className="flex justify-between"><span className="text-slate-400">First Seen</span><span className="text-slate-300">{server.firstSeen}</span></div>
                            </div>

                            {/* Connection */}
                            <div className="bg-slate-800/50 rounded-lg p-3">
                              <p className="text-slate-400 text-xs mb-1">Connection</p>
                              <code className="text-cyan-400 text-sm">{server.ip}:{server.port}</code>
                            </div>

                            {/* Description */}
                            {server.description && (
                              <div className="bg-slate-800/50 rounded-lg p-3">
                                <p className="text-slate-400 text-xs mb-1">Description</p>
                                <p className="text-slate-300 text-sm leading-relaxed">{server.description}</p>
                              </div>
                            )}
                          </div>

                          {/* Right Column - Community Links */}
                          <div className="space-y-2">
                            <p className="text-slate-400 text-xs uppercase">Community Links</p>
                            {server.discord && (
                              <a href={`https://${server.discord}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg px-3 py-2 transition-all">
                                <span className="text-indigo-400">💬</span>
                                <span className="text-indigo-300 text-sm truncate">{server.discord}</span>
                              </a>
                            )}
                            {server.srs && (
                              <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2">
                                <span className="text-cyan-400">🎧</span>
                                <span className="text-cyan-300 text-sm font-mono">{server.srs}</span>
                              </div>
                            )}
                            {server.website && (
                              <a href={server.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg px-3 py-2 transition-all">
                                <span className="text-emerald-400">🌐</span>
                                <span className="text-emerald-300 text-sm truncate">{server.website}</span>
                              </a>
                            )}
                            {server.tacview && (
                              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                                <span className="text-amber-400">📹</span>
                                <span className="text-amber-300 text-sm font-mono truncate">{server.tacview}</span>
                              </div>
                            )}
                            {server.gci && (
                              <a href={server.gci} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg px-3 py-2 transition-all">
                                <span className="text-purple-400">📡</span>
                                <span className="text-purple-300 text-sm">GCI / Live Map</span>
                              </a>
                            )}
                            {server.qqGroup && (
                              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                                <span className="text-blue-400">QQ</span>
                                <span className="text-blue-300 text-sm font-mono">群: {server.qqGroup}</span>
                              </div>
                            )}
                            {server.teamspeak && (
                              <div className="flex items-center gap-2 bg-slate-500/10 border border-slate-500/20 rounded-lg px-3 py-2">
                                <span className="text-slate-400">🔊</span>
                                <span className="text-slate-300 text-sm">{server.teamspeak}</span>
                              </div>
                            )}
                            {!server.discord && !server.srs && !server.website && !server.tacview && !server.gci && !server.qqGroup && !server.teamspeak && (
                              <p className="text-slate-500 text-sm italic">No community links detected</p>
                            )}

                            {/* Tags */}
                            {server.tags && server.tags.length > 0 && (
                              <div className="pt-2">
                                <p className="text-slate-400 text-xs uppercase mb-2">Tags</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {server.tags.map(tag => <span key={tag} className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">#{tag}</span>)}
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-2 flex gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleCompare(server); }}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${compareServers.find(s => s.id === server.id) ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-700/50 text-slate-400 hover:text-white border border-slate-600'}`}
                              >
                                {compareServers.find(s => s.id === server.id) ? '✓ Comparing' : '⊕ Compare'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
        {/* TRENDS TAB */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Ecosystem Growth</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={ecosystemHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="totalPlayers" fill="url(#playersGrad)" stroke="#06b6d4" strokeWidth={2} name="Avg Players" />
                    <Line yAxisId="right" type="monotone" dataKey="activeServers" stroke="#10b981" strokeWidth={2} dot={false} name="Active Servers" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Framework Evolution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={frameworkTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="foothold" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Foothold" />
                    <Area type="monotone" dataKey="pretense" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Pretense" />
                    <Area type="monotone" dataKey="tti" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="TTI" />
                    <Area type="monotone" dataKey="blueflag" stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.6} name="BlueFLAG" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 border-l-4 border-l-emerald-500">
                <h4 className="text-emerald-400 font-medium mb-2">📈 Growth Leader</h4>
                <p className="text-white text-2xl font-bold">Pretense</p>
                <p className="text-slate-400 text-sm mt-1">+28% adoption this month. BSC servers driving growth.</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 border-l-4 border-l-amber-500">
                <h4 className="text-amber-400 font-medium mb-2">⚠️ Declining</h4>
                <p className="text-white text-2xl font-bold">BlueFLAG</p>
                <p className="text-slate-400 text-sm mt-1">-40% from peak. Legacy framework losing ground.</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 border-l-4 border-l-cyan-500">
                <h4 className="text-cyan-400 font-medium mb-2">🎯 Stable Leader</h4>
                <p className="text-white text-2xl font-bold">Foothold</p>
                <p className="text-slate-400 text-sm mt-1">253 servers, 14.1% market share. Consistent growth.</p>
              </div>
            </div>
          </div>
        )}

        {/* COMPARE TAB */}
        {activeTab === 'compare' && (
          <div className="space-y-6">
            {compareServers.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
                <div className="text-5xl mb-4 opacity-50">⊕</div>
                <p className="text-slate-400 text-lg">No servers selected</p>
                <p className="text-slate-500 text-sm mt-2">Go to Servers tab and click ⊕ on up to 3 servers</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white">Comparing {compareServers.length} Servers</h3>
                  <button onClick={() => setCompareServers([])} className="text-slate-400 hover:text-white text-sm">Clear all</button>
                </div>
                
                <div className={`grid gap-6 ${compareServers.length === 1 ? 'grid-cols-1' : compareServers.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {compareServers.map(server => (
                    <div key={server.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-white font-medium truncate">{server.name}</h4>
                        <button onClick={() => toggleCompare(server)} className="text-slate-400 hover:text-white">✕</button>
                      </div>
                      
                      <div className="text-center mb-4">
                        <p className="text-4xl font-bold text-white">{server.players}<span className="text-slate-500 text-xl">/{server.max}</span></p>
                        <p className="text-slate-400 text-sm">Current Players</p>
                      </div>
                      
                      <ResponsiveContainer width="100%" height={100}>
                        <AreaChart data={server.dailyHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 8 }} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Area type="monotone" dataKey="avg" stroke="#06b6d4" fill="url(#playersGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                      
                      <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                        <div className="bg-slate-900/50 rounded p-2"><span className="text-slate-400">7d Avg:</span> <span className="text-white float-right">{server.avgPlayers7d}</span></div>
                        <div className="bg-slate-900/50 rounded p-2"><span className="text-slate-400">Peak:</span> <span className="text-white float-right">{server.peakPlayers}</span></div>
                        <div className="bg-slate-900/50 rounded p-2"><span className="text-slate-400">Health:</span> <span className="text-white float-right">{server.healthScore}</span></div>
                        <div className="bg-slate-900/50 rounded p-2"><span className="text-slate-400">CGI:</span> <span className="text-white float-right">{server.cgi}</span></div>
                        <div className="bg-slate-900/50 rounded p-2"><span className="text-slate-400">Uptime:</span> <span className="text-white float-right">{server.uptime}%</span></div>
                        <div className="bg-slate-900/50 rounded p-2"><span className="text-slate-400">Trend:</span> <span className="float-right"><TrendBadge value={server.trend} /></span></div>
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
          <div className="space-y-6">
            {watchlist.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
                <div className="text-5xl mb-4 opacity-50">★</div>
                <p className="text-slate-400 text-lg">No servers in watchlist</p>
                <p className="text-slate-500 text-sm mt-2">Click ☆ on any server to add it to your watchlist</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-white">Your Watchlist ({watchlist.length} servers)</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {serverList.filter(s => watchlist.includes(s.id)).map(server => (
                    <div key={server.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-yellow-500/30 cursor-pointer" onClick={() => { setSelectedServer(server); setActiveTab('servers'); }}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-white font-medium truncate flex-1">{server.name}</h4>
                        <button onClick={(e) => { e.stopPropagation(); toggleWatchlist(server.id); }} className="text-yellow-400 ml-2">★</button>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className={`text-2xl font-bold ${server.players >= 20 ? 'text-emerald-400' : server.players >= 5 ? 'text-cyan-400' : 'text-slate-500'}`}>{server.players}</span>
                          <span className="text-slate-500">/{server.max}</span>
                        </div>
                        <TrendBadge value={server.trend} />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-300">{server.terrain}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${server.mode === 'PVP' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{server.mode}</span>
                      </div>
                      <p className="text-slate-500 text-xs mt-2">Peak time: {server.peakTime}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* TERRAINS TAB */}
        {activeTab === 'terrains' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Terrain Usage</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie data={terrainData} cx="50%" cy="50%" outerRadius={130} dataKey="value" stroke="#1e293b" strokeWidth={2}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#64748b' }}>
                      {terrainData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-2 gap-3">
                  {terrainData.map((terrain, i) => (
                    <div key={i} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: terrain.fill }} />
                        <span className="text-slate-300 text-sm">{terrain.name}</span>
                      </div>
                      <p className="text-2xl font-bold text-white mt-1">{terrain.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-slate-800 text-center text-slate-500 text-sm">
          <p>DCS Server Intelligence • {summaryStats.totalServers.toLocaleString()} servers • {summaryStats.totalPlayers.toLocaleString()} players online</p>
        </footer>
      </div>
    </div>
  );
};

export default DCSServerIntelligence;
