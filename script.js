// =============================================
//   QA STATUS GENERATOR — script.js
// =============================================

// ---------- Data ----------

const MEMBERS = ['Ajay', 'Keshav', 'Gourav', 'Shubhi', 'Subhani', 'Mohit', 'Yadav'];

const COLORS = [
  '#1D9E75', // teal   — Ajay
  '#185FA5', // blue   — Keshav
  '#534AB7', // purple — Gourav
  '#993C1D', // coral  — Shubhi
  '#854F0B', // amber  — Subhani
  '#3B6D11', // green  — Mohit
  '#72243E', // pink   — Yadav
];

let selectedMembers = new Set(); // members ticked in the top grid
let assignees       = new Set(); // multi-select: members chosen in "Assign to" bar
let tasks           = [];        // { members: string[], text: string }[]

// ---------- Helpers ----------

/** Return first two letters of a name, uppercase */
const initials = name => name.slice(0, 2).toUpperCase();

/** Escape HTML special characters */
const esc = s =>
  s.replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;');

/** Shake an element briefly (validation feedback) */
function shake(id) {
  const el = document.getElementById(id);
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 300);
}

// ---------- Render: Member chips (top grid) ----------

function renderMembers() {
  const grid = document.getElementById('mgrid');

  grid.innerHTML = MEMBERS.map((name, i) => {
    const on    = selectedMembers.has(name);
    const color = on ? `background:${COLORS[i]};color:white` : '';
    return `
      <div class="mchip ${on ? 'on' : ''}" onclick="toggleMember('${name}')">
        <div class="mav" style="${color}">${initials(name)}</div>
        ${name}
      </div>`;
  }).join('');

  // Badge
  const badge = document.getElementById('mbadge');
  badge.style.display = selectedMembers.size ? 'inline-flex' : 'none';
  badge.textContent   = selectedMembers.size + ' selected';

  // Hero counter
  document.getElementById('s-members').textContent = selectedMembers.size;

  renderAssignChips();
}

function toggleMember(name) {
  if (selectedMembers.has(name)) {
    selectedMembers.delete(name);
    // Also remove from assignees if they were deselected
    assignees.delete(name);
  } else {
    selectedMembers.add(name);
  }
  renderMembers();
  build();
}

// ---------- Render: Assign-to chips (multi-select) ----------

function renderAssignChips() {
  const wrap = document.getElementById('achips');

  if (!selectedMembers.size) {
    wrap.innerHTML = '<span class="placeholder-text">Select members above first</span>';
    assignees.clear();
    return;
  }

  wrap.innerHTML = [...selectedMembers].map(name => {
    const i   = MEMBERS.indexOf(name);
    const col = COLORS[i] || COLORS[0];
    const sel = assignees.has(name);
    return `
      <div
        class="achip ${sel ? 'sel' : ''}"
        style="${sel ? `background:${col};border-color:${col}` : ''}"
        onclick="toggleAssignee('${name}')">
        ${sel ? `<svg width="8" height="8" viewBox="0 0 8 8" fill="none" style="display:inline;margin-right:3px;vertical-align:middle"><path d="M1.5 4l2 2 3-3" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}${name}
      </div>`;
  }).join('');
}

function toggleAssignee(name) {
  if (assignees.has(name)) {
    assignees.delete(name);
  } else {
    assignees.add(name);
  }
  document.getElementById('hint').textContent = '';
  renderAssignChips();
}

// ---------- Add task ----------

function addTask() {
  const ta   = document.getElementById('tinput');
  const val  = ta.value.trim();
  const hint = document.getElementById('hint');

  // Validation
  if (!selectedMembers.size) {
    hint.textContent = 'Please select at least one team member first.';
    shake('mgrid');
    return;
  }
  if (!assignees.size) {
    hint.textContent = 'Please assign the task to at least one member (click names above).';
    shake('abar');
    return;
  }
  if (!val) {
    hint.textContent = 'Please enter a task description.';
    ta.focus();
    return;
  }

  hint.textContent = '';
  tasks.push({ members: [...assignees], text: val });
  ta.value = '';
  ta.focus();

  renderTasks();
  build();
}

// ---------- Remove task ----------

function removeTask(index) {
  tasks.splice(index, 1);
  renderTasks();
  build();
}

// ---------- Render: Task list ----------

function renderTasks() {
  const list  = document.getElementById('tlist');
  const badge = document.getElementById('tbadge');

  // Hero counter
  document.getElementById('s-tasks').textContent = tasks.length;

  if (!tasks.length) {
    list.innerHTML         = '<div class="empty">No tasks added yet.</div>';
    badge.style.display    = 'none';
    // Still show no-tasks indicator if members are selected
    if (selectedMembers.size) appendNoTasksRow(list, [...selectedMembers]);
    return;
  }

  badge.style.display  = 'inline-flex';
  badge.textContent    = tasks.length + ' task' + (tasks.length > 1 ? 's' : '');

  list.innerHTML = tasks.map((t, i) => {
    // Build owner row — multiple avatars + names
    const ownerHtml = t.members.map((name, pos) => {
      const idx   = MEMBERS.indexOf(name);
      const color = COLORS[idx] || COLORS[0];
      return `
        ${pos > 0 ? '<span class="tsep">,</span>' : ''}
        <div class="tav" style="background:${color}">${initials(name)}</div>
        <span class="towname" style="color:${color}">${name}</span>`;
    }).join('');

    // Build bullets using the same smart splitter
    const lines = splitTaskText(t.text);
    const bulletsHtml = lines.map(line => `
          <div class="ttext-row">
            <div class="tbullet"></div>
            <div class="ttext">${esc(line)}</div>
          </div>`).join('');

    return `
      <div class="tcard">
        <div class="tbody">
          <div class="towner">${ownerHtml}</div>
          ${bulletsHtml}
        </div>
        <button class="tdel" onclick="removeTask(${i})">Remove</button>
      </div>`;
  }).join('');

  // "No tasks yet" members row
  if (selectedMembers.size) {
    const membersWithTasks = new Set(tasks.flatMap(t => t.members));
    const noTaskMembers    = [...selectedMembers].filter(m => !membersWithTasks.has(m));
    appendNoTasksRow(list, noTaskMembers);
  }
}

function appendNoTasksRow(container, noTaskMembers) {
  if (!noTaskMembers.length) return;

  const chips = noTaskMembers.map(name => {
    const i   = MEMBERS.indexOf(name);
    const col = COLORS[i] || COLORS[0];
    return `<span class="notask-chip" style="border-color:${col}20;color:${col};background:${col}12">
      <span class="notask-av" style="background:${col}">${initials(name)}</span>${name}
    </span>`;
  }).join('');

  const row = document.createElement('div');
  row.className = 'notask-row';
  row.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;opacity:.5">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2"/>
      <path d="M6 4v2.5M6 8h.01" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>
    <span class="notask-label">No tasks yet:</span>
    ${chips}`;
  container.appendChild(row);
}

// ---------- Smart task deduplication ----------
// Handles two input styles:
//   1. One item per line  → split on \n
//   2. Multiple PORTAL-IDs typed as one long string → auto-split on PORTAL-/Reported/Bug keywords
// Then deduplicates all items globally (case-insensitive) across all tasks.

/** Split a raw task string into individual item strings */
function splitTaskText(raw) {
  const text = raw.trim();
  if (!text) return [];

  // If user typed newlines, respect those first
  const byNewline = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (byNewline.length > 1) return byNewline;

  // Otherwise auto-split on common QA item prefixes:
  // PORTAL-XXXXX, Reported Standalone Bug, Reported Bug, [QA Only Bug], [QA/prd Only Bug]
  const SPLIT_RE = /(PORTAL-\d+|Reported\s+(?:Standalone\s+)?Bug[:\s#]|\[QA[^\]]*Bug\])/gi;

  const parts = [];
  let last = 0;
  let match;
  const re = new RegExp(SPLIT_RE.source, 'gi');

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      // text before this keyword — attach to previous part if exists, else start new
      const before = text.slice(last, match.index).trim();
      if (before && parts.length > 0) {
        parts[parts.length - 1] += ' ' + before;
      } else if (before) {
        parts.push(before);
      }
    }
    // Start a new part at this keyword
    parts.push(match[0]);
    last = match.index + match[0].length;
  }

  // Append any trailing text to last part
  if (last < text.length) {
    const tail = text.slice(last).trim();
    if (tail) {
      if (parts.length > 0) parts[parts.length - 1] += ' ' + tail;
      else parts.push(tail);
    }
  }

  // If splitting produced nothing useful, return original
  if (parts.length === 0) return [text];

  // Merge each keyword with the text that follows it until the next keyword
  // (already done above — each part starts with keyword + trailing text from re.exec loop)
  // Final clean
  return parts.map(p => p.trim()).filter(p => p.length > 0);
}

function buildSmartTaskLines(tasks) {
  const seen = new Set();
  const uniqueLines = [];

  for (const t of tasks) {
    const items = splitTaskText(t.text);
    for (const item of items) {
      const norm = item.toLowerCase().replace(/\s+/g, ' ').trim();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        uniqueLines.push(item.replace(/\s+/g, ' ').trim());
      }
    }
  }

  return uniqueLines;
}

// ---------- Build generated mail ----------

function build() {
  const dateVal   = document.getElementById('date').value;
  const recipient = document.getElementById('recipient').value || 'Jenny';
  const signoff   = document.getElementById('signoff').value   || 'Mohit';

  // Format date as "21 April 2026"
  let dateStr = '[select date]';
  if (dateVal) {
    dateStr = new Date(dateVal).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  // Member name list (comma-separated, all selected members)
  const nameList = [...selectedMembers].join(', ') || '[no members selected]';

  const BULLET = '\u2022';

  // Smart deduplication:
  // 1. Exact dedup — same text by different people → show once
  // 2. Prefix dedup — if task A is the start of task B, show A once then only B's unique suffix
  //    e.g. "PORTAL-77943 ... for QA" + "PORTAL-77943 ... for QA Report issue 01"
  //    → "PORTAL-77943 ... for QA" then "Report issue 01" (not repeated)
  const smartLines = buildSmartTaskLines(tasks);

  const taskBlock = smartLines.length
    ? smartLines.map(line => `${BULLET} ${line}`).join('\n')
    : `${BULLET} [no tasks added yet]`;

  const mail =
`Hi ${recipient},

Below are the tasks performed by the Orion India QA team on ${dateStr},

${nameList}:

${taskBlock}

Thanks,
${signoff}`;

  document.getElementById('outbox').textContent = mail;
}

// ---------- Open in Mail ----------

// ---------- Build Outlook URL ----------

function buildOutlookUrl() {
  const dateVal = document.getElementById('date').value;
  let dateStr = 'Report';
  if (dateVal) {
    dateStr = new Date(dateVal).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }
  const subject = `Orion India QA Team Task Report - ${dateStr}`;
  const body    = document.getElementById('outbox').textContent;
  const to      = document.getElementById('toEmail').value.trim();

  // NOTE: Outlook Web's compose URL does NOT support the &cc= parameter —
  // it is simply ignored. We handle CC separately via clipboard (see openInMail).
  return 'https://outlook.cloud.microsoft/mail/deeplink/compose'
    + '?to='      + encodeURIComponent(to)
    + '&subject=' + encodeURIComponent(subject)
    + '&body='    + encodeURIComponent(body);
}

/** Open Outlook and auto-copy CC to clipboard, then show paste-reminder toast */
function launchOutlookWithCC() {
  const cc = document.getElementById('ccEmail').value.trim();

  // Copy CC email to clipboard first
  navigator.clipboard.writeText(cc).then(() => {
    showCCToast(cc);
  }).catch(() => {
    // Fallback clipboard copy
    try {
      const ta = document.createElement('textarea');
      ta.value = cc;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
    } catch(e) {}
    showCCToast(cc);
  });

  window.open(buildOutlookUrl(), '_blank');
}

function showCCToast(cc) {
  const t = document.getElementById('ccToast');
  document.getElementById('ccToastEmail').textContent = cc;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 7000);
}

// ---------- Open in Mail ----------

function openInMail() {
  launchOutlookWithCC();
}

// ---------- Schedule mail ----------

let scheduleTimer    = null;  // setTimeout handle
let scheduleInterval = null;  // setInterval for countdown
let scheduledAt      = null;  // scheduled Date object

function showScheduleModal() {
  // Pre-set input to next round hour as a sensible default
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = n => String(n).padStart(2, '0');
  const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  document.getElementById('scheduleTime').value = local;
  updateSchPreview();
  document.getElementById('scheduleModal').classList.add('open');
}

function hideScheduleModal() {
  document.getElementById('scheduleModal').classList.remove('open');
}

function updateSchPreview() {
  const val = document.getElementById('scheduleTime').value;
  const pre = document.getElementById('schPreview');
  if (!val) { pre.textContent = ''; return; }
  const d = new Date(val);
  if (isNaN(d)) { pre.textContent = ''; return; }
  pre.textContent = 'Will open: ' + d.toLocaleString('en-GB', {
    weekday:'short', day:'numeric', month:'short',
    year:'numeric', hour:'2-digit', minute:'2-digit'
  });
}

// live-update preview as user changes the time picker
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('scheduleTime').addEventListener('input', updateSchPreview);
  document.getElementById('tinput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addTask();
  });
});

function confirmSchedule() {
  const val = document.getElementById('scheduleTime').value;
  if (!val) { alert('Please pick a date and time.'); return; }

  const target = new Date(val);
  const diff   = target - new Date();
  if (diff <= 0) { alert('Please pick a future time.'); return; }

  cancelSchedule(true);
  scheduledAt = target;

  // When timer fires — show "Send Now" modal (browsers block window.open from
  // setTimeout; it MUST be triggered by a direct user click to work reliably)
  scheduleTimer = setTimeout(() => {
    clearInterval(scheduleInterval);
    scheduleInterval = null;
    scheduledAt      = null;
    scheduleTimer    = null;
    updateBanner();
    showSendNowModal(); // user clicks one button → Outlook opens
  }, diff);

  scheduleInterval = setInterval(updateBanner, 1000);
  hideScheduleModal();
  updateBanner();
}

function cancelSchedule(silent) {
  if (scheduleTimer)    { clearTimeout(scheduleTimer);    scheduleTimer    = null; }
  if (scheduleInterval) { clearInterval(scheduleInterval); scheduleInterval = null; }
  scheduledAt = null;
  if (!silent) updateBanner();
}

// ── "Time to send!" modal — shown at scheduled time ──
function showSendNowModal() {
  // Fill meta details
  const to      = document.getElementById('toEmail').value.trim();
  const cc      = document.getElementById('ccEmail').value.trim();
  const dateVal = document.getElementById('date').value;
  let dateStr   = 'Report';
  if (dateVal) dateStr = new Date(dateVal).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  document.getElementById('sendNowMeta').innerHTML =
    `<strong>To:</strong> ${to}<br><strong>CC:</strong> ${cc}<br><strong>Subject:</strong> Orion India QA Team Task Report - ${dateStr}`;

  document.getElementById('sendNowModal').classList.add('open');
  try { window.focus(); } catch(e) {}
  // Flash tab title so user notices
  const orig = document.title;
  let blink  = true;
  const fi   = setInterval(() => {
    document.title = blink ? '🔔 TIME TO SEND!' : orig;
    blink = !blink;
  }, 600);
  document.getElementById('sendNowModal')._fi = fi;
}

function hideSendNowModal() {
  const m = document.getElementById('sendNowModal');
  m.classList.remove('open');
  clearInterval(m._fi);
  document.title = 'QA Status Generator';
}

function openAndSend() {
  hideSendNowModal();
  launchOutlookWithCC(); // opens Outlook + copies CC to clipboard
}

function updateBanner() {
  const banner    = document.getElementById('schBanner');
  const bannerTxt = document.getElementById('schBannerText');
  const countdown = document.getElementById('schCountdown');

  if (!scheduledAt) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'flex';
  bannerTxt.textContent = 'Scheduled for ' + scheduledAt.toLocaleString('en-GB', {
    weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
  });

  const diff = scheduledAt - new Date();
  if (diff <= 0) { countdown.textContent = ''; return; }

  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = n => String(n).padStart(2, '0');
  countdown.textContent = h > 0
    ? `(${h}h ${pad(m)}m ${pad(s)}s remaining)`
    : `(${pad(m)}m ${pad(s)}s remaining)`;
}

// ---------- Copy mail ----------

function copyMail() {
  const text = document.getElementById('outbox').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const tag = document.getElementById('ctag');
    tag.classList.add('show');
    setTimeout(() => tag.classList.remove('show'), 2000);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

// ---------- Clear report ----------

function showClearModal() {
  document.getElementById('clearModal').classList.add('open');
}

function hideClearModal() {
  document.getElementById('clearModal').classList.remove('open');
}

function confirmClear() {
  // Reset all state
  selectedMembers.clear();
  assignees.clear();
  tasks = [];

  // Reset form fields
  document.getElementById('date').value      = '';
  document.getElementById('recipient').value = 'Jenny';
  document.getElementById('signoff').value   = 'Mohit';
  document.getElementById('tinput').value    = '';
  document.getElementById('hint').textContent = '';

  hideClearModal();
  renderMembers();
  renderTasks();
  build();
}

// ---------- Dark / Light mode ----------

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next   = isDark ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('qa-theme', next); } catch(e) {}
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const sun  = document.querySelector('.icon-sun');
  const moon = document.querySelector('.icon-moon');
  if (theme === 'dark') {
    sun.style.display  = 'none';
    moon.style.display = 'block';
  } else {
    sun.style.display  = 'block';
    moon.style.display = 'none';
  }
}

// ---------- Init ----------
// Restore saved theme
try {
  const saved = localStorage.getItem('qa-theme');
  if (saved) applyTheme(saved);
} catch(e) {}
renderMembers();
renderTasks();
build();