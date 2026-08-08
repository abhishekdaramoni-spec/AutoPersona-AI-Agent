/* ── app.js — AutoPersona AI Frontend ── */

'use strict';

// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
const state = {
  agentId:    localStorage.getItem('ap_agentId')   || null,
  agentName:  localStorage.getItem('ap_agentName') || 'Ada',
  agentDomain:localStorage.getItem('ap_agentDomain')|| 'AI Security',
  posts:      [],
  logItems:   [],
  countdownSec: 600,
  countdownTimer: null,
  pollTimer: null
};

// ════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════
function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return Math.floor(diff / 60)   + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600)  + ' hr ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function styleClass(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('critique'))   return 'critique';
  if (t.includes('prediction')) return 'prediction';
  return 'insight';
}

function sourceChip(src) {
  if (!src) return '<span class="src-chip default">UNKNOWN</span>';
  const s = src.toLowerCase();
  if (s.includes('hackernews') || s.includes('hacker news'))
    return '<span class="src-chip hackernews">HACKERNEWS</span>';
  if (s.includes('techcrunch'))
    return '<span class="src-chip techcrunch">RSS (TECHCRUNCH)</span>';
  if (s.includes('wired'))
    return '<span class="src-chip wired">RSS (WIRED)</span>';
  if (s.includes('bleeping'))
    return '<span class="src-chip bleeping">RSS (BLEEPING)</span>';
  if (s.includes('krebs'))
    return '<span class="src-chip krebs">RSS (KREBS)</span>';
  if (s.includes('ars'))
    return '<span class="src-chip ars">RSS (ARSTECHNICA)</span>';
  return `<span class="src-chip default">${esc(src.toUpperCase())}</span>`;
}

// ════════════════════════════════════════
// DOM HELPERS
// ════════════════════════════════════════
const $ = id => document.getElementById(id);

// ════════════════════════════════════════
// TABS
// ════════════════════════════════════════
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// ════════════════════════════════════════
// COUNTDOWN TIMER
// ════════════════════════════════════════
function startCountdown() {
  state.countdownSec = 600;
  if (state.countdownTimer) clearInterval(state.countdownTimer);
  state.countdownTimer = setInterval(() => {
    state.countdownSec--;
    if (state.countdownSec <= 0) state.countdownSec = 600;
    const m = String(Math.floor(state.countdownSec / 60)).padStart(2, '0');
    const s = String(state.countdownSec % 60).padStart(2, '0');
    const el = $('next-cycle-countdown');
    if (el) el.textContent = `${m}:${s}`;
  }, 1000);
}

// ════════════════════════════════════════
// INIT FORM
// ════════════════════════════════════════
function initForm() {
  $('init-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name   = $('inp-name').value.trim();
    const domain = $('inp-domain').value.trim();
    if (!name || !domain) return;

    const btn = $('btn-init');
    btn.disabled    = true;
    btn.textContent = 'Initializing…';

    try {
      const res  = await fetch('/api/agent/init', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ persona: { name, domain } })
      });
      const data = await res.json();

      if (data.agentId) {
        state.agentId     = data.agentId;
        state.agentName   = name;
        state.agentDomain = domain;
        localStorage.setItem('ap_agentId',     state.agentId);
        localStorage.setItem('ap_agentName',   state.agentName);
        localStorage.setItem('ap_agentDomain', state.agentDomain);
        enterDashboard();
      } else {
        btn.disabled    = false;
        btn.textContent = '🚀 Initialize Agent';
        alert(data.error || 'Initialization failed.');
      }
    } catch (err) {
      btn.disabled    = false;
      btn.textContent = '🚀 Initialize Agent';
      alert('Server unreachable: ' + err.message);
    }
  });
}

// ════════════════════════════════════════
// ENTER DASHBOARD
// ════════════════════════════════════════
function enterDashboard() {
  $('init-screen').classList.add('hidden');
  $('dashboard').classList.remove('hidden');

  // Populate sidebar persona info
  $('s-name').textContent   = state.agentName;
  $('s-domain').textContent = state.agentDomain.toUpperCase();

  startCountdown();
  startPolling();
}

// ════════════════════════════════════════
// POLLING
// ════════════════════════════════════════
function startPolling() {
  fetchFeed();
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(fetchFeed, 60 * 1000);
}

async function fetchFeed() {
  if (!state.agentId) return;
  try {
    const res  = await fetch(`/api/agent/feed?agentId=${state.agentId}`);
    const data = await res.json();
    const posts = Array.isArray(data.posts) ? data.posts : [];
    state.posts = posts;
    renderFeed(posts);
    renderDecisions(posts);
    renderMemory(posts);
  } catch (err) {
    console.warn('[AutoPersona] Feed fetch error:', err.message);
  }
}

// ════════════════════════════════════════
// RENDER FEED
// ════════════════════════════════════════
function renderFeed(posts) {
  $('s-stat-posts').textContent = posts.length;
  $('feed-count-badge').textContent = posts.length + ' Post' + (posts.length !== 1 ? 's' : '');

  const container = $('feed-container');
  if (!posts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⏳</div>
        <div class="empty-title">Waiting for first cycle…</div>
        <div class="empty-desc">The autonomous loop runs every 10 minutes.<br />Posts will appear here automatically — no manual input needed.</div>
      </div>`;
    return;
  }

  container.innerHTML = [...posts].reverse().map((p, i) => {
    const cls = styleClass(p.styleType || p.rationale || p.text);
    const src = Array.isArray(p.sources) && p.sources[0] ? p.sources[0] : null;
    const srcUrl   = typeof src === 'object' ? src.url   : src;
    const srcLabel = typeof src === 'object' ? (src.source || srcUrl) : src;

    return `
    <article class="post-card">
      <div class="post-meta">
        <span class="style-badge ${cls}">${cls.toUpperCase()}</span>
        <span class="post-author">${esc(state.agentName)}</span>
        <span class="post-time">🕐 ${timeAgo(p.createdAt)}</span>
        <span class="post-tone">skeptical and risk-focused</span>
      </div>

      <div class="post-body">${esc(p.text || '')}</div>

      ${srcUrl ? `
      <div class="source-box">
        <div class="source-label">Source Context</div>
        <a class="source-link" href="${esc(srcUrl)}" target="_blank" rel="noopener">🔗 ${esc(srcLabel || srcUrl)}</a>
      </div>` : ''}

      <div class="rationale-row" id="rat-toggle-${i}" onclick="toggleRationale(${i})">
        <span class="rationale-label">💡 View Persona Rationale</span>
        <span class="rationale-chevron">▼</span>
      </div>
      <div class="rationale-body" id="rat-body-${i}">${esc(p.rationale || '')}</div>
    </article>`;
  }).join('');
}

function toggleRationale(i) {
  const toggle = $('rat-toggle-' + i);
  const body   = $('rat-body-'   + i);
  toggle.classList.toggle('open');
  body.style.display = body.style.display === 'block' ? 'none' : 'block';
}

// ════════════════════════════════════════
// RENDER DECISIONS
// ════════════════════════════════════════
function renderDecisions(posts) {
  const items = [];
  let selected = 0, offDomain = 0, hype = 0, duplicate = 0, lowRel = 0;

  posts.forEach(post => {
    // Selected topic
    const src0 = Array.isArray(post.sources) ? post.sources[0] : null;
    if (src0) {
      const url    = typeof src0 === 'object' ? src0.url    : src0;
      const title  = typeof src0 === 'object' ? (src0.title  || url) : url;
      const source = typeof src0 === 'object' ? (src0.source || '') : '';
      items.push({ title, url, source, reason: '[Selected] Passed all filters and scored highest this cycle.', isSelected: true, score: post.score || 82, time: post.createdAt });
      selected++;
    }

    // Rejected topics
    if (Array.isArray(post.rejectedTopics)) {
      post.rejectedTopics.forEach(t => {
        const title  = typeof t === 'string' ? t : (t.title  || '');
        const reason = typeof t === 'string' ? 'Not AI security' : (t.reason || 'Not AI security');
        const r      = reason.toLowerCase();
        let cat = 'off-domain';
        if (r.includes('duplicate'))  { duplicate++; cat = 'duplicate'; }
        else if (r.includes('low'))   { lowRel++;    cat = 'low-rel';   }
        else if (r.includes('hype') || r.includes('saturat')) { hype++; cat = 'hype'; }
        else                          { offDomain++;              }
        items.push({ title, url: null, source: '', reason: `[Not AI security] ${reason}`, isSelected: false, score: 0, time: post.createdAt });
      });
    }
  });

  const total = items.length;
  $('s-stat-evaluated').textContent = total;
  $('d-total').textContent    = total;
  $('d-selected').textContent = selected;
  $('d-offdomain').textContent= offDomain;
  $('d-hype').textContent     = hype;
  $('d-duplicate').textContent= duplicate;
  $('d-lowrel').textContent   = lowRel;

  state.logItems = items;
  applyLogFilter();
}

function applyLogFilter() {
  const filter = $('log-filter').value;
  const visible = filter === 'selected' ? state.logItems.filter(x =>  x.isSelected)
                : filter === 'rejected' ? state.logItems.filter(x => !x.isSelected)
                : state.logItems;

  const container = $('decisions-container');
  if (!visible.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-title">No evaluation data yet</div>
        <div class="empty-desc">Decision logs populate after the first autonomous cycle.</div>
      </div>`;
    return;
  }

  container.innerHTML = visible.map(item => `
    <div class="log-item">
      <div class="log-check ${item.isSelected ? 'selected' : ''}">${item.isSelected ? '✓' : ''}</div>
      <div class="log-body">
        <div class="log-title">${esc(item.title)}</div>
        <div class="log-reason">${esc(item.reason)}</div>
        <div class="log-tags">
          ${sourceChip(item.source)}
          <span class="log-time">🕐 ${timeAgo(item.time)}</span>
          ${item.url ? `<a class="log-ext" href="${esc(item.url)}" target="_blank" rel="noopener">🔗 Link</a>` : ''}
        </div>
      </div>
      <div class="log-score ${item.isSelected ? 'selected' : ''}">${item.score}%</div>
    </div>
  `).join('');
}

// ════════════════════════════════════════
// RENDER MEMORY
// ════════════════════════════════════════
function renderMemory(posts) {
  const titles = posts.map(p => {
    const src = Array.isArray(p.sources) && p.sources[0];
    return typeof src === 'object' ? (src.title || src.url) : (src || p.text?.split('\n')[0]?.replace('Insight:', '').trim());
  }).filter(Boolean);

  $('memory-count-badge').textContent = titles.length + ' Entr' + (titles.length === 1 ? 'y' : 'ies');

  $('memory-topics').innerHTML = titles.length
    ? titles.map(t => `<div class="memory-entry">• ${esc(t)}</div>`).join('')
    : '<div class="empty-small">No topics covered yet.</div>';

  $('memory-registry').innerHTML = titles.length
    ? titles.map(t => `<div class="memory-entry">🔒 ${esc(t.substring(0, 65))}${t.length > 65 ? '…' : ''}</div>`).join('')
    : '<div class="empty-small">Registry is empty.</div>';

  const opinions = [
    'Current LLM safety guardrails are mostly security theater and easily bypassed',
    'The rush to deploy agents without sandboxed runtimes is the biggest cybersecurity threat of this decade',
    'Organizations hosting private corporate data on public AI APIs are walking into a data privacy nightmare'
  ];
  $('memory-opinions').innerHTML = opinions.map(o => `<div class="memory-entry">💬 ${esc(o)}</div>`).join('');
}

// ════════════════════════════════════════
// BOOT
// ════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initForm();

  // Hook filter select
  $('log-filter').addEventListener('change', applyLogFilter);

  // Auto-restore session
  if (state.agentId) {
    enterDashboard();
  }
});
