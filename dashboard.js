/* ═══════════════════════════════════════════════════════════
   LEWA SMART CONSERVATION DASHBOARD — dashboard.js
   Handles: seed data, real-time simulation, rendering,
   filtering, charts, interactions, localStorage persistence.
═══════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────
// LUCIDE ICON HELPER
// Returns an <i> element that Lucide will hydrate into SVG.
// ─────────────────────────────────────────────────────────
function icon(name, cls = 'icon-md') {
  return `<i data-lucide="${name}" class="icon ${cls}"></i>`;
}

// Re-renders Lucide icons in a given root element (or entire page).
function refreshIcons(root) {
  if (window.lucide) {
    if (root) lucide.createIcons({ nodes: root.querySelectorAll('[data-lucide]') });
    else       lucide.createIcons();
  }
}

// ─────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────

const SEED_ANIMALS = [
  { id:'E21', lucideIcon:'circle-dot', name:'Elephant #E21', status:'Safe',   zone:'North', battery:72, lastTx:'2 mins ago'  },
  { id:'R07', lucideIcon:'circle-dot', name:'Rhino #R07',    status:'Alert',  zone:'East',  battery:34, lastTx:'15 mins ago' },
  { id:'L12', lucideIcon:'circle-dot', name:'Lion #L12',     status:'Moving', zone:'Core',  battery:91, lastTx:'1 min ago'   },
  { id:'B04', lucideIcon:'circle-dot', name:'Buffalo #B04',  status:'Safe',   zone:'South', battery:58, lastTx:'5 mins ago'  },
  { id:'G09', lucideIcon:'circle-dot', name:'Giraffe #G09',  status:'Moving', zone:'West',  battery:83, lastTx:'3 mins ago'  }
];

const SEED_INCIDENTS = [
  { id:1, type:'Fence Breach',     zone:'North', severity:'High',   time:'5 mins ago',  acknowledged:false, source:'System'    },
  { id:2, type:'Animal Distress',  zone:'Core',  severity:'Medium', time:'22 mins ago', acknowledged:false, source:'Sensor'    },
  { id:3, type:'Poaching Alert',   zone:'East',  severity:'High',   time:'1 hour ago',  acknowledged:true,  source:'System'    },
  { id:4, type:'Community Report', zone:'South', severity:'Low',    time:'2 hours ago', acknowledged:false, source:'Community' }
];

const SEED_COMMUNITY = [
  { id:1, message:'Elephant near farm',      location:'Isiolo',      timestamp:'1 hour ago',  urgent:false },
  { id:2, message:'Water shortage reported', location:'Ngare Ndare', timestamp:'3 hours ago', urgent:true  },
  { id:3, message:'Strange vehicle spotted', location:'Lewa border', timestamp:'30 mins ago', urgent:true  }
];

const SEED_RANGERS = [
  { name:'Team Alpha',   status:'Patrolling', zone:'North', lastContact:'2 mins ago'  },
  { name:'Team Bravo',   status:'Standby',    zone:'Camp',  lastContact:'10 mins ago' },
  { name:'Team Charlie', status:'Responding', zone:'East',  lastContact:'Just now'    }
];

const SEED_PROJECTS = [
  { lucideIcon:'radio',      name:'Smart Collars',            status:'Deployed'    },
  { lucideIcon:'plane',      name:'Drone Surveillance',       status:'Testing'     },
  { lucideIcon:'droplets',   name:'Water Monitoring Sensors', status:'Maintenance' },
  { lucideIcon:'camera',     name:'AI Camera Traps',          status:'Deployed'    }
];

const TRAINING_DOCS = [
  { title:'How to Use GPS Tracker',   body:'Power on the device and wait for satellite lock (~90s). Assign the animal ID via the collar app. Ensure battery is above 20% before field deployment.' },
  { title:'How to Report Incidents',  body:'Use the Community Report button for urgent threats. Include: what, where, and urgency level. Photos can be attached via email to ops@lewa.org.' },
  { title:'Ranger Safety Protocols',  body:'Always patrol in pairs. Carry radio and emergency beacon. Check in every 30 minutes. In case of a poaching contact do NOT engage — report and withdraw to safe distance.' }
];

const WEATHER_FORECASTS = [
  { time:'Now',   icon:'sun',          temp:'28°C' },
  { time:'12:00', icon:'sun',          temp:'30°C' },
  { time:'14:00', icon:'cloud-drizzle',temp:'26°C' },
  { time:'16:00', icon:'cloud-rain',   temp:'24°C' },
  { time:'18:00', icon:'cloud',        temp:'23°C' },
  { time:'20:00', icon:'moon',         temp:'21°C' }
];

const PRESET_COMMS = [
  'Check fence Zone B',
  'Poaching reported near river',
  'Request backup',
  'All clear — return to camp',
  'Medical support needed'
];

// ─────────────────────────────────────────────────────────
// MUTABLE STATE  (deep clones from seed so reset works)
// ─────────────────────────────────────────────────────────
let animals   = JSON.parse(JSON.stringify(SEED_ANIMALS));
let incidents = JSON.parse(JSON.stringify(SEED_INCIDENTS));
let community = JSON.parse(JSON.stringify(SEED_COMMUNITY));

// Restore acknowledged state from localStorage
const storedAck = JSON.parse(localStorage.getItem('lewa_ack') || '{}');
incidents.forEach(i => { if (storedAck[i.id]) i.acknowledged = true; });

let currentZone      = 'All';
let currentView      = localStorage.getItem('lewa_view') || 'card';
let soundEnabled     = false;
let adminMode        = false;
let droneBattery     = 67;
let droneFlightTime  = 15;
let sensorFailure    = false;
let droneAngle       = 0;
const DRONE_RADIUS   = 55;
let incidentCounter  = 10;
let communityCounter = 10;
let syncCounter      = 0;
let currentTimeline  = 0;

const TIMELINE_LABELS = ['Past 24 Hours', 'Past 7 Days', 'Past 30 Days'];

let sensorData = { temp: 28.4, humidity: 62, gps: 97, movement: 'All clear' };

// ─────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  startClock();
  renderWildlife();
  renderSensors();
  renderIncidents();
  renderCommunity();
  renderRangers();
  renderDevices();
  renderProjects();
  renderTraining();
  renderWeather();
  animateImpactCounters();
  drawMovementChart();
  drawIncidentsChart();
  drawRiskChart();
  startDroneCanvas();
  startSimulation();
  setView(currentView);
  restoreTheme();
  window.addEventListener('keydown', handleKeyboard);
  refreshIcons();
});

// ─────────────────────────────────────────────────────────
// CLOCK
// ─────────────────────────────────────────────────────────
function startClock() {
  function tick() {
    const now = new Date();
    const clockEl = document.getElementById('live-clock');
    if (clockEl) clockEl.querySelector('span').textContent = now.toLocaleTimeString('en-GB');
    syncCounter++;
    const footer = document.getElementById('last-sync-footer');
    const label  = document.getElementById('last-sync-label');
    if (footer) footer.textContent = syncCounter + ' seconds ago';
    if (label)  label.textContent  = 'Last sync: ' + syncCounter + 's ago';
  }
  tick();
  setInterval(tick, 1000);
}

// ─────────────────────────────────────────────────────────
// WILDLIFE MONITORING
// ─────────────────────────────────────────────────────────
function renderWildlife() {
  const filtered = currentZone === 'All' ? animals : animals.filter(a => a.zone === currentZone);
  const cardEl   = document.getElementById('card-view');
  const mapEl    = document.getElementById('map-view');

  // --- Card View ---
  if (!filtered.length) {
    cardEl.innerHTML = `<p style="color:var(--text-dim);font-size:0.78rem;padding:10px">No animals in selected zone.</p>`;
  } else {
    cardEl.innerHTML = filtered.map(a => {
      const battClass = a.battery < 20 ? 'batt-low' : a.battery < 30 ? 'batt-warn' : 'batt-ok';
      const battWarn  = a.battery < 30
        ? `<span style="color:var(--alert);font-size:0.6rem;margin-left:4px;display:inline-flex;align-items:center;gap:2px">${icon('alert-triangle','icon-sm')} LOW</span>`
        : '';
      return `
        <div class="animal-card">
          <div class="animal-icon">${icon('map-pin','icon-md')}</div>
          <div class="animal-info">
            <div class="animal-name">${a.name}</div>
            <div class="animal-meta">
              ${icon('map','icon-sm')} ${a.zone} Zone
              &nbsp;·&nbsp;
              ${icon('clock','icon-sm')} ${a.lastTx}
            </div>
            <div class="battery-bar">
              <div class="battery-fill ${battClass}" style="width:${a.battery}%"></div>
            </div>
            <div style="font-size:0.62rem;color:var(--text-dim);margin-top:2px;display:flex;align-items:center;gap:3px">
              ${icon('battery','icon-sm')} ${a.battery.toFixed(0)}%${battWarn}
            </div>
          </div>
          <div class="status-badge status-${a.status}">${a.status}</div>
        </div>`;
    }).join('');
  }

  // --- Map View ---
  const zones     = ['North','East','Core','West','South','Camp'];
  mapEl.innerHTML = `<div class="map-grid">` +
    zones.map(z => {
      const dots = animals.filter(a => a.zone === z)
        .map(a => `<div class="map-dot dot-${a.status}" title="${a.name}"></div>`)
        .join('');
      return `<div class="map-zone">${dots}<div class="map-zone-label">${z}</div></div>`;
    }).join('') + `</div>`;

  refreshIcons(document.getElementById('wildlife-card'));
}

// ─────────────────────────────────────────────────────────
// IOT SENSOR PANEL
// ─────────────────────────────────────────────────────────
function renderSensors() {
  const rows = [
    { lucideIcon:'thermometer',  label:'Temperature',     value: sensorFailure ? 'OFFLINE' : `${sensorData.temp.toFixed(1)}°C`, id:'s-temp' },
    { lucideIcon:'droplets',     label:'Humidity',        value: `${sensorData.humidity.toFixed(0)}%`,                          id:'s-hum'  },
    { lucideIcon:'signal',       label:'GPS Signal',      value: `${sensorData.gps.toFixed(0)}%`,                               id:'s-gps'  },
    { lucideIcon:'activity',     label:'Movement Detect', value: sensorData.movement,                                           id:'s-mov'  }
  ];

  document.getElementById('sensor-rows').innerHTML = rows.map(r => `
    <div class="sensor-row">
      <div class="sensor-label">${icon(r.lucideIcon,'icon-sm')} ${r.label}</div>
      <div class="sensor-value" id="${r.id}">${r.value}</div>
    </div>`
  ).join('');

  refreshIcons(document.getElementById('sensor-card'));
}

// ─────────────────────────────────────────────────────────
// INCIDENTS
// ─────────────────────────────────────────────────────────
function renderIncidents() {
  let list = [...incidents];
  if (currentZone !== 'All') list = list.filter(i => i.zone === currentZone);

  const sevOrder = { High: 0, Medium: 1, Low: 2 };
  list.sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    return sevOrder[a.severity] - sevOrder[b.severity];
  });

  const unacked = list.filter(i => !i.acknowledged).length;
  const badge   = document.getElementById('active-alerts-count');
  const alertBadge = document.getElementById('alert-count-badge');
  if (badge)      badge.textContent     = unacked;
  if (alertBadge) alertBadge.textContent = unacked ? `${unacked} active` : '';

  const container = document.getElementById('incidents-list');
  if (!list.length) {
    container.innerHTML = `<p style="color:var(--text-dim);font-size:0.78rem;padding:10px">No incidents in selected zone.</p>`;
    return;
  }

  container.innerHTML = list.map(inc => {
    const srcTag  = inc.source === 'Community'
      ? `<span style="font-size:0.6rem;color:var(--sand);margin-left:6px">Community</span>` : '';
    const ackLabel = inc.acknowledged ? 'Acknowledged' : 'Acknowledge';
    const ackIco   = inc.acknowledged ? icon('check-circle','icon-sm') : icon('check','icon-sm');
    return `
      <div class="incident-item sev-${inc.severity} ${inc.acknowledged ? 'acknowledged' : ''}" id="inc-${inc.id}">
        <div class="incident-header">
          <span class="incident-type">${inc.type}${srcTag}</span>
          <span class="severity-tag">${inc.severity}</span>
        </div>
        <div class="incident-meta">
          ${icon('map-pin','icon-sm')} ${inc.zone} Zone
          &nbsp;·&nbsp;
          ${icon('clock','icon-sm')} ${inc.time}
        </div>
        <button class="ack-btn" onclick="acknowledgeAlert(${inc.id})">${ackIco} ${ackLabel}</button>
      </div>`;
  }).join('');

  refreshIcons(document.getElementById('incidents-card'));
}

function acknowledgeAlert(id) {
  const inc = incidents.find(i => i.id === id);
  if (!inc) return;
  inc.acknowledged = true;
  const stored  = JSON.parse(localStorage.getItem('lewa_ack') || '{}');
  stored[id]    = true;
  localStorage.setItem('lewa_ack', JSON.stringify(stored));
  renderIncidents();
  toast('Alert acknowledged', 'info');
}

// ─────────────────────────────────────────────────────────
// COMMUNITY REPORTS
// ─────────────────────────────────────────────────────────
function renderCommunity() {
  const container = document.getElementById('community-list');
  container.innerHTML = community.map(r => `
    <div class="report-item ${r.urgent ? 'urgent' : ''}">
      <div class="report-msg">
        ${r.message}
        ${r.urgent ? `<span class="urgent-tag">${icon('alert-circle','icon-sm')} URGENT</span>` : ''}
      </div>
      <div class="report-meta">
        ${icon('map-pin','icon-sm')} ${r.location}
        &nbsp;·&nbsp;
        ${icon('clock','icon-sm')} ${r.timestamp}
      </div>
    </div>`
  ).join('');

  refreshIcons(container);
}

// ─────────────────────────────────────────────────────────
// RANGER DISPATCH
// ─────────────────────────────────────────────────────────
function renderRangers() {
  document.getElementById('ranger-list').innerHTML = SEED_RANGERS.map((r, i) => `
    <div class="ranger-item">
      <div class="ranger-icon">${icon('user','icon-md')}</div>
      <div class="ranger-info">
        <div class="ranger-name">${r.name}</div>
        <div class="ranger-meta">
          ${icon('map-pin','icon-sm')} ${r.zone}
          &nbsp;·&nbsp; Last contact: ${r.lastContact}
        </div>
      </div>
      <span class="ranger-status rs-${r.status}">${r.status}</span>
      <button class="btn btn-sand btn-sm" onclick="dispatchRanger(${i})">
        ${icon('send','icon-sm')} Dispatch
      </button>
    </div>`
  ).join('');

  document.getElementById('preset-btns').innerHTML = PRESET_COMMS.map(m =>
    `<button class="preset-btn" onclick="sendComm('${m}')">${m}</button>`
  ).join('');

  refreshIcons(document.getElementById('ranger-card'));
}

function dispatchRanger(idx) {
  const r = SEED_RANGERS[idx];
  addCommLog(`Alert dispatched to ${r.name} — responding to active incident`);
  toast(`Alert sent to ${r.name}`, 'info');
}

function sendComm(msg) {
  addCommLog(`Message sent: "${msg}"`);
  setTimeout(() => {
    const responder = SEED_RANGERS[Math.floor(Math.random() * 3)].name;
    addCommLog(`${responder}: Message received`);
  }, 1200);
}

function addCommLog(msg) {
  const log = document.getElementById('comms-log');
  const ts  = new Date().toLocaleTimeString('en-GB');
  const div = document.createElement('div');
  div.className   = 'comms-msg';
  div.innerHTML   = `<span class="ts">[${ts}]</span>${msg}`;
  log.appendChild(div);
  log.scrollTop   = log.scrollHeight;
}

// ─────────────────────────────────────────────────────────
// DEVICE HEALTH
// ─────────────────────────────────────────────────────────
function renderDevices() {
  const devices = [
    { name:'Elephant #E21 Collar', batt: animals.find(a=>a.id==='E21')?.battery ?? 72, signal:4, ts:'2m ago'    },
    { name:'Rhino #R07 Collar',    batt: animals.find(a=>a.id==='R07')?.battery ?? 34, signal:2, ts:'15m ago'   },
    { name:'Lion #L12 Collar',     batt: animals.find(a=>a.id==='L12')?.battery ?? 91, signal:4, ts:'1m ago'    },
    { name:'Drone 03',             batt: droneBattery,                                 signal:3, ts:'just now'  },
    { name:'Sensor Node N4',       batt: null,                                         signal:1, ts:'8m ago', note:'Signal weak' }
  ];

  const signalBars = n => {
    const bars = ['▁','▃','▅','▇'];
    return bars.slice(0, n).map((b, i) =>
      `<span style="color:${i < n ? 'var(--neon)' : 'rgba(57,255,20,0.2)'}">${b}</span>`
    ).join('');
  };

  document.getElementById('device-list').innerHTML = devices.map(d => {
    let cls = 'ok', label = '';
    if (d.batt !== null) {
      cls   = d.batt < 20 ? 'low' : d.batt < 35 ? 'warn' : 'ok';
      label = `${d.batt.toFixed(0)}% ${d.batt < 35 ? icon('alert-triangle','icon-sm') : ''}`;
    } else {
      cls   = 'warn';
      label = d.note || '';
    }
    return `
      <div class="device-item">
        <div class="device-icon">${icon('cpu','icon-sm')}</div>
        <div class="device-name">${d.name}</div>
        <span class="signal-bars">${signalBars(d.signal)}</span>
        <span class="device-batt ${cls}">${label}</span>
      </div>`;
  }).join('');

  refreshIcons(document.getElementById('device-card'));
}

// ─────────────────────────────────────────────────────────
// TECHHUB PROJECTS
// ─────────────────────────────────────────────────────────
function renderProjects() {
  document.getElementById('projects-list').innerHTML = SEED_PROJECTS.map(p => `
    <div class="project-item">
      <div class="project-icon">${icon(p.lucideIcon,'icon-md')}</div>
      <div class="project-name">${p.name}</div>
      <span class="project-status ps-${p.status}">${p.status}</span>
    </div>`
  ).join('');

  refreshIcons(document.getElementById('techhub-card'));
}

// ─────────────────────────────────────────────────────────
// TRAINING DOCS  (collapsible)
// ─────────────────────────────────────────────────────────
function renderTraining() {
  document.getElementById('training-list').innerHTML = TRAINING_DOCS.map((d, i) => `
    <div class="collapsible-item">
      <div class="collapsible-header" id="th-${i}" onclick="toggleCollapsible(${i})">
        <span style="display:flex;align-items:center;gap:7px">${icon('book-open','icon-sm')} ${d.title}</span>
        <span class="collapsible-arrow">${icon('chevron-down','icon-sm')}</span>
      </div>
      <div class="collapsible-body" id="tb-${i}">${d.body}</div>
    </div>`
  ).join('');

  refreshIcons(document.getElementById('training-card'));
}

function toggleCollapsible(i) {
  const header = document.getElementById(`th-${i}`);
  const body   = document.getElementById(`tb-${i}`);
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  header.classList.toggle('open', !isOpen);
}

// ─────────────────────────────────────────────────────────
// WEATHER
// ─────────────────────────────────────────────────────────
function renderWeather() {
  document.getElementById('forecast-row').innerHTML = WEATHER_FORECASTS.map(f => `
    <div class="forecast-hour">
      <span class="fh-time">${f.time}</span>
      <span class="fh-icon">${icon(f.icon,'icon-md')}</span>
      <span class="fh-temp">${f.temp}</span>
    </div>`
  ).join('');

  refreshIcons(document.getElementById('weather-card'));
}

// ─────────────────────────────────────────────────────────
// IMPACT COUNTERS  (count-up animation)
// ─────────────────────────────────────────────────────────
function animateImpactCounters() {
  const items = [
    { el: document.getElementById('cnt-1'), target: 34,    suffix: '%' },
    { el: document.getElementById('cnt-2'), target: 62000, suffix: '+' },
    { el: document.getElementById('cnt-3'), target: 1247,  suffix: ''  },
    { el: document.getElementById('cnt-4'), target: 24,    suffix: ''  }
  ];
  items.forEach(item => {
    if (!item.el) return;
    let current = 0;
    const step  = item.target / 60;
    const timer = setInterval(() => {
      current = Math.min(current + step, item.target);
      item.el.textContent = Math.floor(current).toLocaleString() + item.suffix;
      if (current >= item.target) clearInterval(timer);
    }, 20);
  });
}

// ─────────────────────────────────────────────────────────
// CANVAS CHARTS
// ─────────────────────────────────────────────────────────

// Movement trend line chart (simulated 24h data)
function drawMovementChart() {
  const canvas = document.getElementById('movement-chart');
  if (!canvas) return;
  canvas.width  = canvas.offsetWidth || 300;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  const points = 12;
  const data   = Array.from({ length: points }, () => 20 + Math.sin(Math.random() * 3) * 10 + Math.random() * 15);
  const max    = Math.max(...data), min = Math.min(...data);

  ctx.clearRect(0, 0, w, h);

  // Subtle grid
  ctx.strokeStyle = 'rgba(57,255,20,0.1)';
  ctx.lineWidth   = 1;
  for (let i = 0; i < 4; i++) {
    const y = (h / 4) * i + 10;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const px = i => (i / (points - 1)) * (w - 20) + 10;
  const py = v => h - 10 - ((v - min) / (max - min || 1)) * (h - 20);

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(57,255,20,0.35)');
  grad.addColorStop(1, 'rgba(57,255,20,0.02)');

  ctx.beginPath();
  ctx.moveTo(px(0), py(data[0]));
  data.forEach((_, i) => { if (i > 0) ctx.lineTo(px(i), py(data[i])); });
  ctx.strokeStyle = '#39FF14';
  ctx.lineWidth   = 2;
  ctx.shadowColor = '#39FF14';
  ctx.shadowBlur  = 8;
  ctx.stroke();

  ctx.lineTo(px(points - 1), h);
  ctx.lineTo(px(0), h);
  ctx.closePath();
  ctx.fillStyle  = grad;
  ctx.shadowBlur = 0;
  ctx.fill();
}

// Incidents by zone bar chart
function drawIncidentsChart() {
  const canvas = document.getElementById('incidents-chart');
  if (!canvas) return;
  canvas.width  = canvas.offsetWidth || 300;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  const zones  = ['N', 'E', 'S', 'W', 'Core'];
  const counts = zones.map(z => incidents.filter(i => i.zone.startsWith(z === 'Core' ? 'Core' : z === 'N' ? 'North' : z === 'E' ? 'East' : z === 'S' ? 'South' : 'West')).length || Math.floor(Math.random() * 5) + 1);
  const max    = Math.max(...counts);

  ctx.clearRect(0, 0, w, h);

  const bw = (w - 20) / zones.length - 4;
  zones.forEach((z, i) => {
    const x  = 10 + i * ((w - 20) / zones.length);
    const bh = (counts[i] / max) * (h - 30);
    const y  = h - bh - 20;

    const g = ctx.createLinearGradient(0, y, 0, h - 20);
    g.addColorStop(0, 'rgba(57,255,20,0.8)');
    g.addColorStop(1, 'rgba(57,255,20,0.2)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 3);
    ctx.fill();

    ctx.fillStyle = 'rgba(210,180,140,0.8)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(z, x + bw / 2, h - 6);
    ctx.fillStyle = 'rgba(57,255,20,0.9)';
    ctx.fillText(counts[i], x + bw / 2, y - 4);
  });
}

// Poaching risk gauge (semi-circle)
function drawRiskChart() {
  const canvas = document.getElementById('risk-chart');
  if (!canvas) return;
  canvas.width  = canvas.offsetWidth || 300;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  const hour       = new Date().getHours();
  const nightRisk  = (hour >= 19 || hour < 6) ? 25 : 0;
  const incRisk    = incidents.filter(i => i.severity === 'High' && !i.acknowledged).length * 18;
  const risk       = Math.min(100, 20 + nightRisk + incRisk + Math.random() * 10);

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h - 10;
  const r  = Math.min(w, h) - 30;

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, r / 2, Math.PI, 0);
  ctx.lineWidth   = 14;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.stroke();

  // Risk arc
  const color = risk < 33 ? '#39FF14' : risk < 66 ? '#FFB300' : '#FF3B3B';
  ctx.beginPath();
  ctx.arc(cx, cy, r / 2, Math.PI, Math.PI + (risk / 100) * Math.PI);
  ctx.lineWidth   = 14;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Labels
  ctx.fillStyle = color;
  ctx.font      = `bold ${Math.floor(r * 0.38)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(risk)}%`, cx, cy - 8);
  ctx.fillStyle = 'rgba(165,200,176,0.8)';
  ctx.font      = '9px monospace';
  ctx.fillText('Poaching Risk', cx, cy + 10);
  const rLabel = risk < 33 ? 'LOW' : risk < 66 ? 'MODERATE' : 'HIGH';
  ctx.fillStyle = color;
  ctx.font      = 'bold 9px monospace';
  ctx.fillText(rLabel, cx, cy + 22);
}

// ─────────────────────────────────────────────────────────
// DRONE CANVAS  (animated patrol path)
// ─────────────────────────────────────────────────────────
function startDroneCanvas() {
  const canvas = document.getElementById('drone-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function drawFrame() {
    canvas.width = canvas.offsetWidth || 300;
    const w = canvas.width, h = canvas.height || 160;
    ctx.clearRect(0, 0, w, h);

    // Background terrain gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgba(5,25,15,0.9)');
    bg.addColorStop(1, 'rgba(11,61,46,0.6)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // HUD grid
    ctx.strokeStyle = 'rgba(57,255,20,0.07)';
    ctx.lineWidth   = 1;
    for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // Patrol path
    droneAngle += 0.012;
    const cx = w / 2, cy = h / 2;
    const dx = cx + Math.cos(droneAngle) * DRONE_RADIUS;
    const dy = cy + Math.sin(droneAngle) * DRONE_RADIUS;

    // Orbit circle
    ctx.beginPath();
    ctx.arc(cx, cy, DRONE_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(57,255,20,0.15)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Drone marker
    ctx.beginPath();
    ctx.arc(dx, dy, 6, 0, Math.PI * 2);
    ctx.fillStyle  = '#39FF14';
    ctx.shadowColor = '#39FF14';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Crosshair
    ctx.strokeStyle = 'rgba(57,255,20,0.4)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(dx - 14, dy); ctx.lineTo(dx + 14, dy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dx, dy - 14); ctx.lineTo(dx, dy + 14); ctx.stroke();

    // HUD telemetry text
    ctx.fillStyle = 'rgba(57,255,20,0.7)';
    ctx.font      = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`ALT: 42m`,        8, 14);
    ctx.fillText(`SPD: 18km/h`,     8, 26);
    ctx.fillText(`BATT: ${droneBattery.toFixed(0)}%`, 8, 38);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(57,255,20,0.4)';
    ctx.fillText('DRONE 03 — LIVE FEED', w / 2, 14);
    ctx.fillStyle   = 'rgba(255,59,59,0.8)';
    ctx.font        = 'bold 9px monospace';
    ctx.textAlign   = 'right';
    ctx.fillText('● REC', w - 8, 14);
  }

  (function loop() { drawFrame(); requestAnimationFrame(loop); })();
}

// ─────────────────────────────────────────────────────────
// REAL-TIME SIMULATION  (runs every 7 seconds)
// ─────────────────────────────────────────────────────────
function startSimulation() {
  setInterval(() => {
    // Sensor fluctuation
    sensorData.temp     += (Math.random() - 0.5) * 1.0;
    sensorData.humidity += (Math.random() - 0.5) * 4;
    sensorData.humidity  = Math.max(20, Math.min(99, sensorData.humidity));
    sensorData.temp      = Math.max(15, Math.min(45, sensorData.temp));
    sensorData.gps       = Math.max(80, Math.min(100, sensorData.gps + (Math.random() - 0.5) * 2));
    const movOptions     = ['All clear', 'Movement in North Zone', 'Movement in East Zone', 'All clear', 'All clear'];
    sensorData.movement  = movOptions[Math.floor(Math.random() * movOptions.length)];

    // Spinner
    const spin = document.getElementById('spin-icon');
    if (spin) { spin.style.display = 'inline'; setTimeout(() => spin.style.display = 'none', 600); }

    // Flash sensor values
    renderSensors();
    ['s-temp', 's-hum', 's-gps', 's-mov'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.add('updating'); setTimeout(() => el.classList.remove('updating'), 400); }
    });

    // Drone battery drain
    droneBattery    = Math.max(0, droneBattery - 0.3);
    droneFlightTime = Math.max(0, droneFlightTime - 0.1);
    const battEl    = document.getElementById('drone-batt');
    const fltEl     = document.getElementById('drone-flight');
    if (battEl) battEl.textContent = droneBattery.toFixed(0) + '%';
    if (fltEl)  fltEl.textContent  = droneFlightTime.toFixed(0) + ' min';

    // Weather temperature update
    const tempEl = document.getElementById('weather-temp');
    if (tempEl) tempEl.textContent = `${sensorData.temp.toFixed(1)}°C`;

    // Random animal status change (10% chance)
    if (Math.random() < 0.1) {
      const a        = animals[Math.floor(Math.random() * animals.length)];
      const statuses = ['Safe', 'Moving', 'Alert'];
      const next     = statuses[Math.floor(Math.random() * statuses.length)];
      if (next !== a.status) { a.status = next; renderWildlife(); }
    }

    // Battery drain on collars
    animals.forEach(a => { a.battery = Math.max(1, a.battery - Math.random() * 0.5); });
    renderDevices();

    // 20% chance of new low-severity alert
    if (Math.random() < 0.2) generateRandomAlert();

    syncCounter = 0;
    drawRiskChart();

  }, 7000);

  // Additional random alert every 20–30s
  setInterval(() => { if (Math.random() < 0.5) generateRandomAlert(); }, 25000);
}

function generateRandomAlert() {
  const types = ['Fence Breach', 'Community Report', 'Unusual Movement', 'Water Level Alert', 'Vehicle Spotted'];
  const zones = ['North', 'East', 'South', 'West', 'Core'];
  const sevs  = ['Low', 'Low', 'Low', 'Medium'];
  const inc   = {
    id:           ++incidentCounter,
    type:         types[Math.floor(Math.random() * types.length)],
    zone:         zones[Math.floor(Math.random() * zones.length)],
    severity:     sevs[Math.floor(Math.random() * sevs.length)],
    time:         'just now',
    acknowledged: false,
    source:       'System'
  };
  incidents.unshift(inc);
  if (incidents.length > 20) incidents.pop();
  renderIncidents();
  toast(`New alert: ${inc.type} — ${inc.zone} Zone`, inc.severity === 'High' ? 'alert' : 'warn');
}

// ─────────────────────────────────────────────────────────
// ZONE FILTER
// ─────────────────────────────────────────────────────────
function setZone(zone, btn) {
  currentZone = zone;
  document.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderWildlife();
  renderIncidents();
  renderCommunity();
}

// ─────────────────────────────────────────────────────────
// VIEW TOGGLE  (Card / Map)
// ─────────────────────────────────────────────────────────
function setView(v) {
  currentView = v;
  localStorage.setItem('lewa_view', v);
  const cardEl  = document.getElementById('card-view');
  const mapEl   = document.getElementById('map-view');
  const cardBtn = document.getElementById('card-view-btn');
  const mapBtn  = document.getElementById('map-view-btn');
  if (v === 'map') {
    cardEl.style.display = 'none';  mapEl.style.display = 'block';
    mapBtn.classList.add('active'); cardBtn.classList.remove('active');
  } else {
    cardEl.style.display = 'block'; mapEl.style.display = 'none';
    cardBtn.classList.add('active'); mapBtn.classList.remove('active');
  }
  renderWildlife();
}

// ─────────────────────────────────────────────────────────
// TIMELINE SLIDER
// ─────────────────────────────────────────────────────────
function updateTimeline(val) {
  currentTimeline = parseInt(val);
  const lbl = document.getElementById('timeline-label');
  if (lbl) lbl.textContent = TIMELINE_LABELS[currentTimeline];
  drawMovementChart();
  drawIncidentsChart();
  drawRiskChart();
  toast(`Showing: ${TIMELINE_LABELS[currentTimeline]}`, 'info');
}

// ─────────────────────────────────────────────────────────
// COMMUNITY REPORT FORM
// ─────────────────────────────────────────────────────────
function openReportForm() {
  const form = document.getElementById('report-form');
  if (form) form.style.display = 'block';
}

function submitReport() {
  const what = document.getElementById('rep-what').value.trim();
  const where = document.getElementById('rep-where').value.trim();
  const urg   = document.getElementById('rep-urgency').value;

  if (!what || !where) { toast('Please fill in all fields', 'warn'); return; }

  community.unshift({ id: ++communityCounter, message: what, location: where, timestamp: 'just now', urgent: urg === 'High' });
  renderCommunity();

  incidents.unshift({ id: ++incidentCounter, type: what, zone: where, severity: urg, time: 'just now', acknowledged: false, source: 'Community' });
  renderIncidents();

  const stored = JSON.parse(localStorage.getItem('lewa_community') || '[]');
  stored.unshift({ what, where, urg, ts: new Date().toISOString() });
  localStorage.setItem('lewa_community', JSON.stringify(stored.slice(0, 50)));

  document.getElementById('rep-what').value  = '';
  document.getElementById('rep-where').value = '';
  document.getElementById('report-form').style.display = 'none';
  toast('Incident reported successfully', 'info');
  playBeep(urg === 'High');
}

// ─────────────────────────────────────────────────────────
// ANALYTICS MODAL
// ─────────────────────────────────────────────────────────
function openAnalyticsModal() {
  const total    = incidents.length;
  const high     = incidents.filter(i => i.severity === 'High').length;
  const acked    = incidents.filter(i => i.acknowledged).length;
  const zones    = ['North','East','South','West','Core'];
  const zoneBreak = zones.map(z => `${z}: ${incidents.filter(i => i.zone === z).length}`).join(' | ');

  document.getElementById('modal-content').innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:0.75rem">
      <tr><td style="padding:6px 0;color:var(--text-dim);border-bottom:1px solid var(--card-border)">Total Incidents</td>
          <td style="color:var(--neon)">${total}</td></tr>
      <tr><td style="padding:6px 0;color:var(--text-dim);border-bottom:1px solid var(--card-border)">High Severity</td>
          <td style="color:var(--alert)">${high}</td></tr>
      <tr><td style="padding:6px 0;color:var(--text-dim);border-bottom:1px solid var(--card-border)">Acknowledged</td>
          <td style="color:var(--neon)">${acked}</td></tr>
      <tr><td style="padding:6px 0;color:var(--text-dim);border-bottom:1px solid var(--card-border)">Animals Tracked</td>
          <td style="color:var(--neon)">${animals.length}</td></tr>
      <tr><td style="padding:6px 0;color:var(--text-dim);border-bottom:1px solid var(--card-border)">Alert Animals</td>
          <td style="color:var(--alert)">${animals.filter(a => a.status === 'Alert').length}</td></tr>
      <tr><td style="padding:6px 0;color:var(--text-dim);border-bottom:1px solid var(--card-border)">Incidents by Zone</td>
          <td style="color:var(--sand);font-size:0.65rem">${zoneBreak}</td></tr>
      <tr><td style="padding:6px 0;color:var(--text-dim)">Drone Battery</td>
          <td style="color:var(--warn)">${droneBattery.toFixed(0)}%</td></tr>
    </table>
    <div style="margin-top:14px;color:var(--text-dim);font-size:0.68rem;line-height:1.8">
      Report generated: ${new Date().toLocaleString()}<br>
      Dashboard: Lewa Smart Conservation Dashboard v1.0<br>
      Status: Simulation Mode
    </div>`;

  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// ─────────────────────────────────────────────────────────
// SYSTEM HEALTH FOOTER
// ─────────────────────────────────────────────────────────
function toggleSysFooter() {
  const body  = document.getElementById('sys-footer-body');
  const arrow = document.getElementById('sys-arrow');
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  if (arrow) arrow.textContent = isOpen ? '▲' : '▼';
}

function triggerTestAlert() {
  toast('Test alert triggered — System OK', 'info');
  generateRandomAlert();
}

// ─────────────────────────────────────────────────────────
// EXPORT CSV
// ─────────────────────────────────────────────────────────
function exportReport() {
  const rows = [['Animal','Status','Zone','Battery','Last TX']];
  animals.forEach(a => rows.push([a.name, a.status, a.zone, a.battery.toFixed(0)+'%', a.lastTx]));
  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'lewa_wildlife_report.csv'; link.click();
  URL.revokeObjectURL(url);
  toast('CSV report downloaded', 'info');
}

// ─────────────────────────────────────────────────────────
// THEME TOGGLE
// ─────────────────────────────────────────────────────────
function toggleTheme() {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.querySelector('span').textContent = isLight ? 'Light Mode' : 'Dark Mode';
  localStorage.setItem('lewa_theme', isLight ? 'light' : 'dark');
}

function restoreTheme() {
  if (localStorage.getItem('lewa_theme') === 'light') {
    document.body.classList.add('light');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.querySelector('span').textContent = 'Light Mode';
  }
}

// ─────────────────────────────────────────────────────────
// SOUND
// ─────────────────────────────────────────────────────────
function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('sound-toggle');
  if (btn) btn.querySelector('span').textContent = soundEnabled ? 'Sound: ON' : 'Sound: OFF';
}

function playBeep(loud = false) {
  if (!soundEnabled) return;
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.value = loud ? 880 : 440;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* silently fail if audio is blocked */ }
}

// ─────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 4200);
  if (type === 'alert') playBeep(true);
}

// ─────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────
function handleKeyboard(e) {
  if (e.shiftKey && e.key === 'A') {
    adminMode = !adminMode;
    document.getElementById('admin-panel').classList.toggle('visible', adminMode);
    toast(adminMode ? 'Admin Override Mode ON' : 'Admin Mode OFF', 'warn');
    return;
  }
  if (e.key === 'a' && !e.shiftKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    const oldest = incidents.find(i => !i.acknowledged);
    if (oldest) acknowledgeAlert(oldest.id);
  }
  if (e.key === 'm' && document.activeElement.tagName !== 'INPUT') {
    setView(currentView === 'map' ? 'card' : 'map');
  }
}

// ─────────────────────────────────────────────────────────
// ADMIN OVERRIDE  (Shift+A to unlock)
// ─────────────────────────────────────────────────────────
function adminSimulatePoaching() {
  incidents.unshift({
    id:           ++incidentCounter,
    type:         'POACHING ALERT — Armed Suspects',
    zone:         ['North','East'][Math.floor(Math.random() * 2)],
    severity:     'High',
    time:         'just now',
    acknowledged: false,
    source:       'System'
  });
  renderIncidents();
  toast('POACHING ALERT SIMULATED — High Severity', 'alert');
  playBeep(true);
}

function adminSimulateSensorFail() {
  sensorFailure = true;
  renderSensors();
  toast('Sensor Node offline — Temperature unavailable', 'warn');
  setTimeout(() => {
    sensorFailure = false;
    renderSensors();
    toast('Sensor back online', 'info');
  }, 8000);
}

function adminResetData() {
  animals   = JSON.parse(JSON.stringify(SEED_ANIMALS));
  incidents = JSON.parse(JSON.stringify(SEED_INCIDENTS));
  community = JSON.parse(JSON.stringify(SEED_COMMUNITY));
  droneBattery     = 67;
  droneFlightTime  = 15;
  incidentCounter  = 10;
  communityCounter = 10;
  localStorage.removeItem('lewa_ack');
  renderWildlife();
  renderIncidents();
  renderCommunity();
  renderDevices();
  animateImpactCounters();
  toast('All data reset to seed values', 'info');
}

// ─────────────────────────────────────────────────────────
// RESIZE  — redraw charts
// ─────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  drawMovementChart();
  drawIncidentsChart();
  drawRiskChart();
});
