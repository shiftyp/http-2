/** @jsxImportSource ./index */
import { h, Fragment, RadioJSXCompiler, ComponentRegistry } from './index';

// Example: Ham Radio Dashboard
export const Dashboard = ({ callsign, stats }: any) => (
  <>
    <div className="dashboard">
      <h1>Station {callsign}</h1>
      
      <div className="stats-grid">
        <StatCard title="QSOs Today" value={stats.qsosToday} />
        <StatCard title="Countries" value={stats.countries} />
        <StatCard title="Grid Squares" value={stats.grids} />
        <StatCard title="Total QSOs" value={stats.total} />
      </div>

      <RecentActivity activities={stats.recent} />
    </div>
  </>
);

const StatCard = ({ title, value }: any) => (
  <div className="stat-card">
    <h3>{title}</h3>
    <div className="value">{value}</div>
  </div>
);

const RecentActivity = ({ activities }: any) => (
  <div className="recent">
    <h2>Recent Activity</h2>
    <ul>
      {activities.map((activity: any) => (
        <li>
          <span className="time">{activity.time}</span>
          <span className="call">{activity.call}</span>
          <span className="freq">{activity.freq}</span>
        </li>
      ))}
    </ul>
  </div>
);

// Show compression in action
export function demonstrateRealWorldCompression(): void {
  const compiler = new RadioJSXCompiler();
  const registry = new ComponentRegistry();

  // Register our custom components
  registry.register('StatCard', '<div class="stat-card"><h3>{{title}}</h3><div class="value">{{value}}</div></div>');
  registry.register('Activity', '<li><span class="time">{{time}}</span><span class="call">{{call}}</span><span class="freq">{{freq}}</span></li>');

  // Sample data
  const dashboardData = {
    callsign: 'KJ4ABC',
    stats: {
      qsosToday: 42,
      countries: 15,
      grids: 8,
      total: 1337,
      recent: [
        { time: '14:30Z', call: 'W1AW', freq: '14.205' },
        { time: '15:45Z', call: 'VK3ABC', freq: '14.230' },
        { time: '16:20Z', call: 'JA1ABC', freq: '21.195' },
        { time: '17:00Z', call: 'EA8ABC', freq: '28.485' },
        { time: '17:30Z', call: 'ZL2ABC', freq: '14.205' }
      ]
    }
  };

  // Original HTML (what would normally be sent)
  const originalHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Station KJ4ABC</title>
  <style>
    .dashboard { padding: 20px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .stat-card { background: #111; padding: 15px; border: 1px solid #0f0; }
    .stat-card h3 { color: #0ff; margin: 0 0 10px 0; }
    .stat-card .value { font-size: 24px; color: #0f0; }
    .recent { margin-top: 20px; }
    .recent ul { list-style: none; padding: 0; }
    .recent li { padding: 5px 0; border-bottom: 1px solid #333; }
    .time { color: #ff0; margin-right: 10px; }
    .call { color: #0ff; margin-right: 10px; }
    .freq { color: #0f0; }
  </style>
</head>
<body>
  <div class="dashboard">
    <h1>Station KJ4ABC</h1>
    
    <div class="stats-grid">
      <div class="stat-card">
        <h3>QSOs Today</h3>
        <div class="value">42</div>
      </div>
      <div class="stat-card">
        <h3>Countries</h3>
        <div class="value">15</div>
      </div>
      <div class="stat-card">
        <h3>Grid Squares</h3>
        <div class="value">8</div>
      </div>
      <div class="stat-card">
        <h3>Total QSOs</h3>
        <div class="value">1337</div>
      </div>
    </div>

    <div class="recent">
      <h2>Recent Activity</h2>
      <ul>
        <li>
          <span class="time">14:30Z</span>
          <span class="call">W1AW</span>
          <span class="freq">14.205</span>
        </li>
        <li>
          <span class="time">15:45Z</span>
          <span class="call">VK3ABC</span>
          <span class="freq">14.230</span>
        </li>
        <li>
          <span class="time">16:20Z</span>
          <span class="call">JA1ABC</span>
          <span class="freq">21.195</span>
        </li>
        <li>
          <span class="time">17:00Z</span>
          <span class="call">EA8ABC</span>
          <span class="freq">28.485</span>
        </li>
        <li>
          <span class="time">17:30Z</span>
          <span class="call">ZL2ABC</span>
          <span class="freq">14.205</span>
        </li>
      </ul>
    </div>
  </div>
</body>
</html>`.trim();

  // Compressed transmission (what we actually send)
  const compressed = {
    t: 1, // Template ID for base page
    s: [2], // Style IDs
    d: { // Data
      c: 'KJ4ABC',
      stats: [
        { c: 1001, t: 'QSOs Today', v: 42 },
        { c: 1001, t: 'Countries', v: 15 },
        { c: 1001, t: 'Grid Squares', v: 8 },
        { c: 1001, t: 'Total QSOs', v: 1337 }
      ],
      recent: [
        { c: 1002, t: '14:30Z', ca: 'W1AW', f: '14.205' },
        { c: 1002, t: '15:45Z', ca: 'VK3ABC', f: '14.230' },
        { c: 1002, t: '16:20Z', ca: 'JA1ABC', f: '21.195' },
        { c: 1002, t: '17:00Z', ca: 'EA8ABC', f: '28.485' },
        { c: 1002, t: '17:30Z', ca: 'ZL2ABC', f: '14.205' }
      ]
    }
  };

  // Calculate sizes
  const originalSize = originalHTML.length;
  const compressedSize = JSON.stringify(compressed).length;
  const ratio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

  console.log('=== Real World Compression Example ===');
  console.log(`Original HTML: ${originalSize} bytes`);
  console.log(`Compressed JSON: ${compressedSize} bytes`);
  console.log(`Compression ratio: ${ratio}% reduction`);
  console.log(`\nTransmission times at different speeds:`);
  
  const speeds = [
    { name: 'HTTP-1000', bps: 750 },
    { name: 'HTTP-4800', bps: 3600 },
    { name: 'HTTP-5600', bps: 4200 },
    { name: 'HTTP-11200', bps: 8400 }
  ];

  for (const speed of speeds) {
    const originalTime = (originalSize * 8 / speed.bps).toFixed(1);
    const compressedTime = (compressedSize * 8 / speed.bps).toFixed(1);
    console.log(`${speed.name}: ${originalTime}s → ${compressedTime}s`);
  }
}

// Delta updates example
export function demonstrateDeltaUpdates(): void {
  console.log('\n=== Delta Updates Example ===');
  
  // Initial state
  const initial = {
    t: 1001, // StatCard template
    title: 'QSOs Today',
    value: 42
  };

  // User makes another QSO, only send the change
  const delta = {
    type: 'update',
    path: '[0].value', // First stat card's value
    data: 43
  };

  console.log('Initial transmission:', JSON.stringify(initial).length, 'bytes');
  console.log('Delta update:', JSON.stringify(delta).length, 'bytes');
  console.log('Delta is only', JSON.stringify(delta).length, 'bytes vs re-sending entire component');
}

// Run demonstrations
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateRealWorldCompression();
  demonstrateDeltaUpdates();
}