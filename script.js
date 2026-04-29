// =============================================
//   QA STATUS GENERATOR — script.js
// =============================================

// ---------- Firebase Config ----------
// ⚠️  Replace the values below with YOUR Firebase project config
// ⚠️  Follow SETUP_GUIDE.md for step-by-step instructions
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCdnt4Yv2xDIUaIccCkNQEtW2cZl2Xv7UE",
  authDomain:        "orion-qa-generator.firebaseapp.com",
  databaseURL:       "https://orion-qa-generator-default-rtdb.firebaseio.com",
  projectId:         "orion-qa-generator",
  storageBucket:     "orion-qa-generator.firebasestorage.app",
  messagingSenderId: "700142321129",
  appId:             "1:700142321129:web:835c19f5964e270f561f78"
};

let leadTasksRef    = null;
let leadFbListener  = null;
let permissionsRef  = null;  // lead-controlled feature toggles for team
let permListener    = null;
let leadTasks       = [];
let giveTaskEnabled = false;
let leadTaskAssignees = new Set();

// Team permissions — lead controls which features team members can access
let teamPerms = {
  clearReport:   false,
  saveMail:      false,
  copyMail:      false,
  viewSaved:     false,
  openInMail:    false,
  scheduleMail:  false,
};

// inside initFirebase — add leadTasksRef
function initFirebase() {
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    db            = firebase.database();
    tasksRef      = db.ref('qa-daily-tasks');
    reportRef     = db.ref('qa-report-details');
    savedMailsRef = db.ref('qa-saved-mails');
    leadTasksRef  = db.ref('qa-lead-tasks');
    permissionsRef = db.ref('qa-team-permissions');
    console.log('[Firebase] connected ✓');
  } catch (e) {
    console.warn('[Firebase] not configured — localStorage fallback active:', e.message);
    db = null; tasksRef = null; reportRef = null; savedMailsRef = null; leadTasksRef = null;
  }
}

// ── Save lead tasks ──
function saveLeadTasks() {
  if (db && leadTasksRef) {
    leadTasksRef.set(leadTasks.length ? leadTasks : null)
      .catch(e => console.warn('[Firebase] leadTasks write error:', e.code));
  } else {
    try { localStorage.setItem('qa-lead-tasks', JSON.stringify(leadTasks)); } catch(e) {}
  }
}

// ── Start lead tasks listener ──
function startLeadTasksListener(onUpdate) {
  if (leadFbListener && leadTasksRef) { leadTasksRef.off('value', leadFbListener); leadFbListener = null; }
  if (db && leadTasksRef) {
    leadFbListener = leadTasksRef.on('value', snapshot => {
      const val = snapshot.val();
      leadTasks = Array.isArray(val) ? val : (val ? Object.values(val) : []);
      onUpdate();
    }, err => {
      console.warn('[Firebase] leadTasks listener error:', err.code);
      try { leadTasks = JSON.parse(localStorage.getItem('qa-lead-tasks') || '[]'); } catch(e) { leadTasks = []; }
      onUpdate();
    });
  } else {
    try { leadTasks = JSON.parse(localStorage.getItem('qa-lead-tasks') || '[]'); } catch(e) { leadTasks = []; }
    onUpdate();
  }
}

function stopLeadTasksListener() {
  if (leadTasksRef && leadFbListener) { leadTasksRef.off('value', leadFbListener); leadFbListener = null; }
}

// ── Toggle "Give Team Task" section (lead only) ──
function toggleGiveTask() {
  giveTaskEnabled = !giveTaskEnabled;
  const btn  = document.getElementById('giveTaskToggleBtn');
  const body = document.getElementById('giveTaskBody');
  if (giveTaskEnabled) {
    btn.classList.add('toggle-on');
    body.style.display = 'block';
    renderGiveTaskChips();
  } else {
    btn.classList.remove('toggle-on');
    body.style.display = 'none';
    leadTaskAssignees.clear();
  }
}

// ── Render member chips inside "Give Task" section ──
function renderGiveTaskChips() {
  const wrap = document.getElementById('giveTaskChips');
  if (!wrap) return;
  wrap.innerHTML = MEMBERS.map((name, i) => {
    const col = COLORS[i];
    const sel = leadTaskAssignees.has(name);
    return `<div class="give-chip ${sel ? 'give-chip-sel' : ''}"
         style="${sel ? `background:${col};border-color:${col};color:white` : ''}"
         onclick="toggleLeadAssignee('${name}')">
      <div class="tav" style="background:${sel ? 'rgba(255,255,255,0.3)' : col};color:white;width:18px;height:18px;font-size:8px">${initials(name)}</div>
      ${name}
    </div>`;
  }).join('');
}

function toggleLeadAssignee(name) {
  if (leadTaskAssignees.has(name)) leadTaskAssignees.delete(name);
  else leadTaskAssignees.add(name);
  renderGiveTaskChips();
}

// ── Add a lead-assigned task ──
function addLeadTask() {
  const ta   = document.getElementById('giveTaskInput');
  const hint = document.getElementById('giveTaskHint');
  const val  = ta.value.trim();

  if (!leadTaskAssignees.size) {
    hint.textContent = 'Please select at least one member to assign this task to.';
    return;
  }
  if (!val) {
    hint.textContent = 'Please enter a task description.';
    ta.focus();
    return;
  }

  hint.textContent = '';
  leadTasks.push({ id: Date.now(), members: [...leadTaskAssignees], text: val, assignedBy: currentUser });
  ta.value = '';
  ta.focus();
  saveLeadTasks();
  renderAssignedTasks();
}

// ── Remove a lead task (lead only) ──
function removeLeadTask(id) {
  leadTasks = leadTasks.filter(t => t.id !== id);
  saveLeadTasks();
  renderAssignedTasks();
}

// ── Render "Assigned Tasks" section ──
function renderAssignedTasks() {
  const card   = document.getElementById('assignedTaskCard');
  const list   = document.getElementById('assignedTaskList');
  const badge  = document.getElementById('atbadge');
  if (!card || !list) return;

  // Determine which tasks this user can see
  const visible = isLead
    ? leadTasks
    : leadTasks.filter(t => t.members.includes(currentUser));

  if (visible.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  badge.style.display = 'inline-flex';
  badge.textContent   = visible.length + ' task' + (visible.length !== 1 ? 's' : '');

  list.innerHTML = visible.map(t => {
    const ownerChips = t.members.map((name, pos) => {
      const idx   = MEMBERS.indexOf(name);
      const color = COLORS[idx] || COLORS[0];
      return `${pos > 0 ? '<span class="tsep">,</span>' : ''}
              <div class="tav" style="background:${color}">${initials(name)}</div>
              <span class="towname" style="color:${color}">${name}</span>`;
    }).join('');

    const parsed     = parseTaskBlock(t.text);
    const bulletsHtml = parsed.map(item => {
      if (!item.isBullet) {
        const html = item.style === 'bug-sub' ? applyBugSubFormatting(item.text) : applyVerifiedSubFormatting(item.text);
        return `<div class="ttext-row" style="padding-left:14px;margin-top:2px"><span style="font-size:12px">${html}</span></div>`;
      }
      return `<div class="ttext-row"><div class="tbullet" style="background:#534AB7"></div><div class="ttext">${applyMainFormatting(item.text)}</div></div>`;
    }).join('');

    return `
      <div class="tcard" style="border-left:3px solid #534AB7">
        <div class="tbody">
          <div class="towner" style="margin-bottom:6px">
            <span style="font-size:10px;font-weight:600;color:#534AB7;text-transform:uppercase;letter-spacing:.06em;margin-right:6px">Assigned to</span>
            ${ownerChips}
          </div>
          ${bulletsHtml}
        </div>
        ${isLead ? `<button class="tdel" onclick="removeLeadTask(${t.id})" style="border-color:#c7d2fe;color:#534AB7">Remove</button>` : ''}
      </div>`;
  }).join('');
}

function applyLeadTaskUI() {
  const giveCard  = document.getElementById('giveTaskCard');
  const permsCard = document.getElementById('leadPermsCard');
  if (giveCard)  giveCard.style.display  = isLead ? 'block' : 'none';
  if (permsCard) permsCard.style.display = isLead ? 'block' : 'none';
}

// ── Clear lead tasks on clear report ──
function clearLeadTasks() {
  leadTasks = [];
  if (db && leadTasksRef) leadTasksRef.remove().catch(() => {});
  else { try { localStorage.removeItem('qa-lead-tasks'); } catch(e) {} }
  renderAssignedTasks();
}

// ── Stop all listeners including lead ──
let tasksRef       = null;
let reportRef      = null;   // report details (date, recipient, signoff, to, cc)
let savedMailsRef  = null;   // lead's saved mails
let fbListener     = null;   // tasks listener
let reportListener = null;   // report details listener

// ── Write tasks to Firebase ──
function saveTasksToStorage() {
  if (db && tasksRef) {
    tasksRef.set(tasks.length ? tasks : null)
      .catch(e => console.error('[Firebase] tasks write error:', e));
  } else {
    try { localStorage.setItem('qa-daily-tasks', JSON.stringify(tasks)); } catch(e) {}
  }
}

// ── Save/load report details (date, recipient, signoff, to, cc) ──
function saveReportDetails() {
  const details = {
    date:      document.getElementById('date').value,
    recipient: document.getElementById('recipient').value,
    signoff:   document.getElementById('signoff').value,
    toEmail:   document.getElementById('toEmail').value,
    ccEmail:   document.getElementById('ccEmail').value,
  };
  // Always save to localStorage as instant backup
  try { localStorage.setItem('qa-report-details', JSON.stringify(details)); } catch(e) {}
  // Also save to Firebase for cross-device sync
  if (db && reportRef) {
    reportRef.set(details).catch(err => {
      console.warn('[Firebase] saveReportDetails error — check rules:', err.code);
    });
  }
}

function startReportDetailsListener() {
  if (reportListener && reportRef) { reportRef.off('value', reportListener); reportListener = null; }

  const applyDetails = d => {
    if (!d) return;
    if (d.date)      document.getElementById('date').value      = d.date;
    if (d.recipient) document.getElementById('recipient').value = d.recipient;
    if (d.signoff)   document.getElementById('signoff').value   = d.signoff;
    if (d.toEmail)   document.getElementById('toEmail').value   = d.toEmail;
    if (d.ccEmail)   document.getElementById('ccEmail').value   = d.ccEmail;
    build();
  };

  if (db && reportRef) {
    reportListener = reportRef.on('value',
      snapshot => applyDetails(snapshot.val()),
      err => {
        console.warn('[Firebase] reportDetails permission denied — check rules:', err.code);
        // localStorage fallback
        try { applyDetails(JSON.parse(localStorage.getItem('qa-report-details') || 'null')); } catch(e) {}
      }
    );
  } else {
    try { applyDetails(JSON.parse(localStorage.getItem('qa-report-details') || 'null')); } catch(e) {}
  }
}

function stopReportDetailsListener() {
  if (reportRef && reportListener) { reportRef.off('value', reportListener); reportListener = null; }
}

// ── Start real-time tasks listener ──
function startTasksListener(onUpdate) {
  if (tasksRef && fbListener) { tasksRef.off('value', fbListener); fbListener = null; }

  if (db && tasksRef) {
    fbListener = tasksRef.on('value', snapshot => {
      const val = snapshot.val();
      tasks = Array.isArray(val) ? val : (val ? Object.values(val) : []);
      onUpdate();
    }, err => console.error('[Firebase] listener error:', err));
  } else {
    try {
      const raw = localStorage.getItem('qa-daily-tasks');
      tasks = raw ? JSON.parse(raw) : [];
    } catch(e) { tasks = []; }
    onUpdate();
  }
}

function stopAllListeners() {
  if (tasksRef    && fbListener)      { tasksRef.off('value', fbListener);       fbListener     = null; }
  if (reportRef   && reportListener)  { reportRef.off('value', reportListener);  reportListener = null; }
  if (leadTasksRef && leadFbListener) { leadTasksRef.off('value', leadFbListener); leadFbListener = null; }
  if (permissionsRef && permListener) { permissionsRef.off('value', permListener); permListener   = null; }
}

// ── Clear all tasks from Firebase ──
function clearTasksFromStorage() {
  tasks = [];
  if (db && tasksRef) {
    tasksRef.remove().catch(e => console.error('[Firebase] clear error:', e));
  } else {
    try { localStorage.removeItem('qa-daily-tasks'); } catch(e) {}
  }
}

// ── Cloud saved mails (Lead only) ──
function getSavedMails(callback) {
  if (db && savedMailsRef) {
    let settled = false;
    const fallback = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn('[Firebase] getSavedMails timed out — using localStorage');
      try { callback(JSON.parse(localStorage.getItem('qa-saved-mails') || '[]')); }
      catch(e) { callback([]); }
    }, 6000);

    savedMailsRef.once('value',
      snapshot => {
        if (settled) return;
        settled = true;
        clearTimeout(fallback);
        const val = snapshot.val();
        const arr = val ? Object.values(val).sort((a, b) => b.id - a.id) : [];
        callback(arr);
      },
      err => {
        if (settled) return;
        settled = true;
        clearTimeout(fallback);
        console.warn('[Firebase] getSavedMails permission denied — check rules. Error:', err.code);
        try { callback(JSON.parse(localStorage.getItem('qa-saved-mails') || '[]')); }
        catch(e) { callback([]); }
      }
    );
  } else {
    try { callback(JSON.parse(localStorage.getItem('qa-saved-mails') || '[]')); }
    catch(e) { callback([]); }
  }
}

function saveMailToCloud(entry) {
  if (db && savedMailsRef) {
    savedMailsRef.child(String(entry.id)).set(entry)
      .then(() => {
        // Enforce max 7
        savedMailsRef.once('value', snap => {
          const val = snap.val();
          if (!val) return;
          const keys = Object.keys(val).sort((a, b) => Number(a) - Number(b));
          if (keys.length > 7) keys.slice(0, keys.length - 7).forEach(k => savedMailsRef.child(k).remove());
        });
      })
      .catch(err => {
        console.warn('[Firebase] saveMailToCloud error — check rules:', err.code);
        // localStorage fallback
        try {
          const saved = JSON.parse(localStorage.getItem('qa-saved-mails') || '[]');
          saved.unshift(entry);
          if (saved.length > 7) saved.length = 7;
          localStorage.setItem('qa-saved-mails', JSON.stringify(saved));
        } catch(e) {}
      });
  } else {
    try {
      const saved = JSON.parse(localStorage.getItem('qa-saved-mails') || '[]');
      saved.unshift(entry);
      if (saved.length > 7) saved.length = 7;
      localStorage.setItem('qa-saved-mails', JSON.stringify(saved));
    } catch(e) {}
  }
}

function deleteMailFromCloud(id, callback) {
  if (db && savedMailsRef) {
    savedMailsRef.child(String(id)).remove()
      .then(callback)
      .catch(err => {
        console.warn('[Firebase] deleteMailFromCloud error:', err.code);
        callback();
      });
  } else {
    try {
      const saved = JSON.parse(localStorage.getItem('qa-saved-mails') || '[]').filter(m => m.id !== id);
      localStorage.setItem('qa-saved-mails', JSON.stringify(saved));
    } catch(e) {}
    callback();
  }
}

function showSkeleton() {
  const el = document.getElementById('skeletonOverlay');
  if (el) el.style.display = 'block';
}
function hideSkeleton() {
  const el = document.getElementById('skeletonOverlay');
  if (el) { el.style.opacity = '0'; setTimeout(() => { el.style.display = 'none'; el.style.opacity = '1'; }, 350); }
}

// ---------- Shared tasks notification ----------
function showSharedTasksToast(count) {
  const t = document.getElementById('sharedToast');
  if (!t) return;
  document.getElementById('sharedToastCount').textContent =
    count + ' task' + (count > 1 ? 's' : '') + ' already added by other members';
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 6000);
}

// ── Show a small sync indicator when data arrives from another device ──
function showSyncPulse() {
  const el = document.getElementById('syncPulse');
  if (!el) return;
  el.classList.add('pulse-on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('pulse-on'), 1800);
}

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

  saveTasksToStorage(); // ← persist immediately
  renderTasks();
  build();
}

// ---------- Remove task ----------

function removeTask(index) {
  const task = tasks[index];
  if (!task) return;

  // Only lead can remove anyone's task
  // Team members can only remove tasks they are assigned to
  if (!isLead && !task.members.includes(currentUser)) {
    alert('You can only remove tasks assigned to you.');
    return;
  }

  tasks.splice(index, 1);
  saveTasksToStorage();
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

    // Parse task into structured items — apply same formatters as generated mail
    const parsed = parseTaskBlock(t.text);
    const bulletsHtml = parsed.map(item => {
      if (!item.isBullet) {
        let html;
        if (item.style === 'bug-sub')          html = applyBugSubFormatting(item.text);
        else if (item.style === 'label-verified') html = `<strong style="color:#1a7a1a">${applyVerifiedSubFormatting(item.text)}</strong>`;
        else                                    html = applyVerifiedSubFormatting(item.text);
        return `<div class="ttext-row" style="padding-left:14px;margin-top:2px"><span style="font-size:12px;line-height:1.5">${html}</span></div>`;
      }
      // Main bullet — use round bullet (●) not square
      const html = item.style === 'reported-header'
        ? `<strong style="color:#cc0000">${applyMainFormatting(item.text)}</strong>`
        : applyMainFormatting(item.text);
      return `<div class="ttext-row"><div class="tbullet"></div><div class="ttext">${html}</div></div>`;
    }).join('');

    // Show Remove button only if: lead (can remove any) OR task belongs to current user
    const canRemove = isLead || t.members.includes(currentUser);

    return `
      <div class="tcard">
        <div class="tbody">
          <div class="towner">${ownerHtml}</div>
          ${bulletsHtml}
        </div>
        ${canRemove ? `<button class="tdel" onclick="removeTask(${i})">Remove</button>` : ''}
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

// =============================================
//  TASK PARSING — hierarchical structure
// =============================================
//
// Each parsed item has:
//   { text, isBullet, style }
//
// Styles and what they mean:
//   'main'               → • bullet, normal formatting
//   'bug-sub'            → no bullet, indented, RED text
//   'verified-sub'       → no bullet, indented, normal + colored status
//   'continuation'       → no bullet, indented, normal (": Fixed" lines etc.)
//   'label-verified'     → no bullet, indented, GREEN ("Verified Issue: N")
//   'reported-header'    → • RED bullet + RED bold text ("Reported Standalone Bug:")
//   'verified-header'    → • normal bullet + bold GREEN text ("Verified standalone bugs:")

function getLines(raw) {
  // Prefer newline-split; fall back to PORTAL- keyword split
  const byNL = raw.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (byNL.length > 1) return byNL;

  // Single block — split on PORTAL-/SERVICE- boundaries
  const re = /(PORTAL-\d+|SERVICE-\d+)/gi;
  const parts = [];
  let last = 0, m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) {
      const before = raw.slice(last, m.index).trim();
      if (before && parts.length > 0) parts[parts.length - 1] += ' ' + before;
      else if (before) parts.push(before);
    }
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < raw.length) {
    const tail = raw.slice(last).trim();
    if (tail && parts.length > 0) parts[parts.length - 1] += ' ' + tail;
    else if (tail) parts.push(tail);
  }
  return parts.length ? parts.map(p => p.trim()).filter(p => p.length > 0) : [raw.trim()];
}

function parseTaskBlock(rawText) {
  const lines  = getLines(rawText);
  const items  = [];
  let mode     = 'main'; // current context

  for (const line of lines) {
    const lo = line.toLowerCase();

    // ── "Reported Standalone Bug" / "Reported Standalone bug" header ──
    if (/^reported\s+standalone\s+bug/i.test(line)) {
      items.push({ text: line, isBullet: true, style: 'reported-header' });
      mode = 'bug-sub';

    // ── "Verified standalone bug(s)" header ──
    } else if (/^verified\s+stand(?:[ -]?alone\s+)?bug/i.test(line)) {
      items.push({ text: line, isBullet: true, style: 'verified-header' });
      mode = 'verified-sub';

    // ── "Verified Issue / Verified sub issue / Verified sub-issue" label ──
    } else if (/^verified\s+(?:sub[- ]?)?issue/i.test(line)) {
      items.push({ text: line, isBullet: false, style: 'label-verified' });
      mode = 'verified-sub';

    // ── PORTAL- / SERVICE- line ──
    } else if (/^(PORTAL-|SERVICE-)/i.test(line)) {
      const hasReported = /reported\s+(?:issue|bug)\s*[:\s]\s*\d+/i.test(line);

      if (mode === 'bug-sub') {
        // Sub-bug under a reported section → no bullet, red
        items.push({ text: line, isBullet: false, style: 'bug-sub' });
      } else if (mode === 'verified-sub') {
        // Verified sub-item → no bullet, normal
        items.push({ text: line, isBullet: false, style: 'verified-sub' });
      } else {
        // New main task → bullet
        items.push({ text: line, isBullet: true, style: 'main' });
        // If the main task itself has "Reported Issue: N", subsequent PORTALs are sub-bugs
        mode = hasReported ? 'bug-sub' : 'main';
      }

    // ── "Reopen issue" continuation ──
    } else if (/^reopen/i.test(line)) {
      items.push({ text: line, isBullet: false, style: 'bug-sub' });

    // ── Other text (": Fixed", descriptions, etc.) ──
    } else {
      const style = mode === 'bug-sub' ? 'bug-sub' : 'continuation';
      items.push({ text: line, isBullet: false, style });
    }
  }

  return items;
}

// Dedup + QATask-sort across all tasks
function buildSmartTaskList(tasks) {
  const seen   = new Set();
  const result = [];

  for (const t of tasks) {
    const parsed = parseTaskBlock(t.text);
    for (const item of parsed) {
      const norm = item.text.toLowerCase().replace(/\s+/g, ' ').trim();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        result.push({ ...item, text: item.text.replace(/\s+/g, ' ').trim() });
      }
    }
  }

  // Move entire QATask blocks (main + their following sub-items) to the bottom.
  // We do this by collecting groups: each main bullet starts a new group.
  const groups   = [];
  let   curGroup = [];

  for (const item of result) {
    if (item.isBullet && curGroup.length > 0) {
      groups.push(curGroup);
      curGroup = [];
    }
    curGroup.push(item);
  }
  if (curGroup.length > 0) groups.push(curGroup);

  const isQAGroup = g => g[0] && g[0].isBullet && /qatask|build\s+verification/i.test(g[0].text);
  const normal    = groups.filter(g => !isQAGroup(g));
  const qa        = groups.filter(g =>  isQAGroup(g));

  return [...normal, ...qa].flat();
}

// Render a single structured item to HTML — uses pre-formatted `f` for all cases
function renderTaskItem(item) {
  const f = applyFormatting(item.text);   // HTML-safe, with colors + bold IDs

  switch (item.style) {

    case 'main':
      // • bullet, PORTAL bold, inline colors
      return `<div class="mail-bullet"><span class="mail-dot">&#8226;</span><span class="mail-btext">${f}</span></div>`;

    case 'bug-sub':
      // No bullet, indented, FULL LINE RED — PORTAL IDs still bold inside red
      return `<div class="mail-sub mail-sub-bug"><span class="fmt-red">${f}</span></div>`;

    case 'verified-sub':
      // No bullet, indented, normal text — only keywords colored (Fixed=green etc.)
      return `<div class="mail-sub">${f}</div>`;

    case 'continuation':
      // No bullet, indented, plain text (status lines like ": Fixed")
      return `<div class="mail-sub">${f}</div>`;

    case 'label-verified':
      // "Verified Issue: N" or "Verified sub-issue" — no bullet, GREEN bold
      return `<div class="mail-sub mail-label"><strong class="fmt-green">${f}</strong></div>`;

    case 'reported-header':
      // "Reported Standalone Bug:" — RED bullet dot + RED bold text
      return `<div class="mail-bullet"><span class="mail-dot fmt-red">&#8226;</span><span class="mail-btext fmt-red"><strong>${f}</strong></span></div>`;

    case 'verified-header':
      // "Verified standalone bugs:" — normal bullet + GREEN bold
      return `<div class="mail-bullet"><span class="mail-dot">&#8226;</span><span class="mail-btext"><strong class="fmt-green">${f}</strong></span></div>`;

    default:
      return `<div class="mail-bullet"><span class="mail-dot">&#8226;</span><span class="mail-btext">${f}</span></div>`;
  }
}

// ── Formatter for MAIN items: PORTAL bold+black, keywords colored ──
function applyMainFormatting(rawText) {
  let h = rawText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  h = h.replace(/(PORTAL-\s*\d+|SERVICE-\d+)/gi, '<strong>$1</strong>');
  h = h.replace(/(\[Qu?e?r?y\]|\[QUERY\])/gi, '<mark class="fmt-query">$1</mark>');
  // RED keywords inline
  h = h.replace(/(Reported\s+(?:Standalone\s+)?(?:Issue|Bug)\s*[:\d][^<\n]*)/gi, '<span class="fmt-red">$1</span>');
  h = h.replace(/(Reopen(?:ed)?\s+issue[^\n<]*)/gi, '<span class="fmt-red">$1</span>');
  h = h.replace(/\b(Still\s+(?:Replicating|Reproducible))\b/gi, '<span class="fmt-red">$1</span>');
  h = h.replace(/\b(Not\s+Fixed)\b/gi, '<span class="fmt-red">$1</span>');
  h = h.replace(/\b(Back\s+to\s+Dev(?:\s+Not\s+Fixed)?)\b/gi, '<span class="fmt-red">$1</span>');
  h = h.replace(/\b(In[- ]Progress)\b/gi, '<span class="fmt-red">$1</span>');
  // ORANGE
  h = h.replace(/\b(Partially\s+[Ff]ixed)\b/gi, '<span class="fmt-orange">$1</span>');
  h = h.replace(/((?:Marking\s+Jira\s+)?QA[- ]On[- ]Hold[^<,\n]*)/gi, '<span class="fmt-orange">$1</span>');
  h = h.replace(/(Execution\s+completed\s+Put\s+QA[- ]On[- ]Hold[^<\n]*)/gi, '<span class="fmt-orange">$1</span>');
  // GREEN
  h = h.replace(/(Verified\s+(?:standalone\s+|stand\s+alone\s+|sub[- ]?)?(?:Issue|Bug)[^\n<:]*:?\s*\d*)/gi, '<span class="fmt-green">$1</span>');
  h = h.replace(/\b(QA[- ]Completed|QA\s+Completed)\b/gi, '<span class="fmt-green">$1</span>');
  h = h.replace(/\b(Closed)\b/gi, '<span class="fmt-green">$1</span>');
  h = h.replace(/(:?\s*\bFixed\b)/g, m => m.includes('fmt-') ? m : `<span class="fmt-green">${m}</span>`);
  return h;
}

// ── Formatter for BUG-SUB items: PORTAL ID = red bold, rest = normal black ──
// Rule from screenshots: only the ticket number is colored red, description stays black
function applyBugSubFormatting(rawText) {
  let h = rawText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // PORTAL/SERVICE ID → RED + bold (only the ID, not description)
  h = h.replace(/(PORTAL-\s*\d+|SERVICE-\d+)/gi, '<strong><span class="fmt-red">$1</span></strong>');
  h = h.replace(/(\[Qu?e?r?y\]|\[QUERY\])/gi, '<mark class="fmt-query">$1</mark>');
  // Status keywords at end of line
  h = h.replace(/\b(Still\s+(?:Replicating|Reproducible))\b/gi, '<span class="fmt-red">$1</span>');
  h = h.replace(/\b(Not\s+Fixed)\b/gi, '<span class="fmt-red">$1</span>');
  h = h.replace(/\b(Partially\s+[Ff]ixed)\b/gi, '<span class="fmt-orange">$1</span>');
  h = h.replace(/\b(QA[- ]Completed|QA\s+Completed)\b/gi, '<span class="fmt-green">$1</span>');
  h = h.replace(/(:?\s*\bFixed\b)/g, m => m.includes('fmt-') ? m : `<span class="fmt-green">${m}</span>`);
  return h;
}

// ── Formatter for VERIFIED-SUB items: PORTAL ID = bold black, keywords colored ──
function applyVerifiedSubFormatting(rawText) {
  let h = rawText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // PORTAL/SERVICE ID → bold black (NOT red)
  h = h.replace(/(PORTAL-\s*\d+|SERVICE-\d+)/gi, '<strong>$1</strong>');
  h = h.replace(/(\[Qu?e?r?y\]|\[QUERY\])/gi, '<mark class="fmt-query">$1</mark>');
  h = h.replace(/\b(Still\s+(?:Replicating|Reproducible))\b/gi, '<span class="fmt-red">$1</span>');
  h = h.replace(/\b(Not\s+Fixed)\b/gi, '<span class="fmt-red">$1</span>');
  h = h.replace(/\b(In[- ]Progress)\b/gi, '<span class="fmt-red">$1</span>');
  h = h.replace(/\b(Partially\s+[Ff]ixed)\b/gi, '<span class="fmt-orange">$1</span>');
  h = h.replace(/\b(QA[- ]Completed|QA\s+Completed)\b/gi, '<span class="fmt-green">$1</span>');
  h = h.replace(/\b(Closed)\b/gi, '<span class="fmt-green">$1</span>');
  h = h.replace(/(:?\s*\bFixed\b)/g, m => m.includes('fmt-') ? m : `<span class="fmt-green">${m}</span>`);
  return h;
}

// ── Keep applyFormatting as alias for main formatter ──
function applyFormatting(rawText) { return applyMainFormatting(rawText); }

// Render a single structured item to HTML
function renderTaskItem(item) {
  switch (item.style) {

    case 'main':
      return `<div class="mail-bullet"><span class="mail-dot">&#8226;</span><span class="mail-btext">${applyMainFormatting(item.text)}</span></div>`;

    case 'bug-sub':
      // No bullet, indented. PORTAL ID = red bold, rest = black
      return `<div class="mail-sub">${applyBugSubFormatting(item.text)}</div>`;

    case 'verified-sub':
      // No bullet, indented. PORTAL ID = bold black, status keywords colored
      return `<div class="mail-sub">${applyVerifiedSubFormatting(item.text)}</div>`;

    case 'continuation':
      return `<div class="mail-sub">${applyVerifiedSubFormatting(item.text)}</div>`;

    case 'label-verified':
      // "Verified Issue: N" — no bullet, GREEN bold
      return `<div class="mail-sub mail-label"><strong class="fmt-green">${applyVerifiedSubFormatting(item.text)}</strong></div>`;

    case 'reported-header':
      // "Reported Standalone Bug:" — RED bullet + RED bold text
      return `<div class="mail-bullet"><span class="mail-dot fmt-red">&#8226;</span><span class="mail-btext"><strong class="fmt-red">${applyMainFormatting(item.text)}</strong></span></div>`;

    case 'verified-header':
      // "Verified standalone bugs:" — bullet + GREEN bold
      return `<div class="mail-bullet"><span class="mail-dot">&#8226;</span><span class="mail-btext"><strong class="fmt-green">${applyVerifiedSubFormatting(item.text)}</strong></span></div>`;

    default:
      return `<div class="mail-bullet"><span class="mail-dot">&#8226;</span><span class="mail-btext">${applyMainFormatting(item.text)}</span></div>`;
  }
}
function formatNameList(members) {
  const arr = [...members];
  if (!arr.length) return '[no members selected]';
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
}

// ---------- Build generated mail ----------

function build() {
  const dateVal   = document.getElementById('date').value;
  const recipient = document.getElementById('recipient').value || 'Jenny';
  const signoff   = document.getElementById('signoff').value   || 'Mohit';

  let dateStr = '[select date]';
  if (dateVal) {
    dateStr = new Date(dateVal).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  const nameList      = formatNameList(selectedMembers);
  const structuredItems = buildSmartTaskList(tasks);
  const BULLET        = '\u2022';

  // ── Plain text (for copy / Outlook URL) ──
  const plainBlock = structuredItems.length
    ? structuredItems.map(item =>
        item.isBullet ? `${BULLET} ${item.text}` : `  ${item.text}`
      ).join('\n')
    : `${BULLET} [no tasks added yet]`;

  const plainMail =
`Hi ${recipient},

Below are the tasks performed by the Orion India QA team on ${dateStr},

${nameList}:

${plainBlock}

Thanks,
${signoff}`;

  // ── HTML (visual display) ──
  const taskHtml = structuredItems.length
    ? structuredItems.map(item => renderTaskItem(item)).join('')
    : `<div class="mail-bullet"><span class="mail-dot">&#8226;</span><span class="mail-btext fmt-muted">[no tasks added yet]</span></div>`;

  const outbox = document.getElementById('outbox');
  outbox.dataset.plain = plainMail;

  outbox.innerHTML =
    `<p class="ml">Hi ${esc(recipient)},</p>` +
    `<p class="ml">Below are the tasks performed by the Orion India QA team on ${esc(dateStr)},</p>` +
    `<p class="ml"><strong><u>${esc(nameList)}:</u></strong></p>` +
    `<div class="ml">${taskHtml}</div>` +
    `<p class="ml">Thanks,<br>${esc(signoff)}</p>`;
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
  const body = document.getElementById('outbox').dataset.plain
             || document.getElementById('outbox').innerText;
  const to      = document.getElementById('toEmail').value.trim();

  // NOTE: Outlook Web's compose URL does NOT support the &cc= parameter —
  // it is simply ignored. We handle CC separately via clipboard (see openInMail).
  return 'https://outlook.cloud.microsoft/mail/deeplink/compose'
    + '?to='      + encodeURIComponent(to)
    + '&subject=' + encodeURIComponent(subject)
    + '&body='    + encodeURIComponent(body);
}

/** Open Outlook compose: To+Subject+body pre-filled (plain text), formatted HTML copied to clipboard */
function launchOutlookWithCC() {
  const outbox    = document.getElementById('outbox');
  const plainText = outbox.dataset.plain || outbox.innerText;
  const cc        = document.getElementById('ccEmail').value.trim();

  // Build inline-styled HTML for Outlook (class names stripped, inline styles added)
  const styledHtml = outbox.innerHTML
    .replace(/class="fmt-red"/g,    'style="color:#cc0000"')
    .replace(/class="fmt-green"/g,  'style="color:#1a7a1a"')
    .replace(/class="fmt-orange"/g, 'style="color:#b85c00;font-weight:bold"')
    .replace(/class="fmt-query"/g,  'style="background:#FFE500;color:#111;padding:0 2px;border-radius:2px;font-weight:bold"')
    .replace(/class="mail-bullet"/g,'style="display:block;margin-bottom:6px;font-family:Calibri,Arial,sans-serif;font-size:11pt"')
    .replace(/class="mail-dot[^"]*"/g,'style="margin-right:6px"')
    .replace(/class="mail-btext"/g, 'style="display:inline"')
    .replace(/class="mail-sub bug-sub"/g,'style="display:block;margin-left:18px;margin-bottom:3px;font-family:Calibri,Arial,sans-serif;font-size:11pt"')
    .replace(/class="mail-sub[^"]*"/g,   'style="display:block;margin-left:18px;margin-bottom:3px;font-family:Calibri,Arial,sans-serif;font-size:11pt"')
    .replace(/class="mail-label"/g, 'style="display:block;margin-left:18px;margin-bottom:3px;font-family:Calibri,Arial,sans-serif;font-size:11pt"')
    .replace(/class="ml"/g,         'style="margin:0 0 12px 0;font-family:Calibri,Arial,sans-serif;font-size:11pt"')
    .replace(/class="[^"]*"/g, ''); // strip any remaining class attrs

  const htmlBody = `<html><head></head><body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000">${styledHtml}</body></html>`;

  // Copy HTML + plain to clipboard so user can paste formatted version
  try {
    const htmlBlob = new Blob([htmlBody],  { type: 'text/html'  });
    const txtBlob  = new Blob([plainText], { type: 'text/plain' });
    navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': txtBlob })]).catch(() => {
      navigator.clipboard.writeText(plainText);
    });
  } catch(e) {
    try { navigator.clipboard.writeText(plainText); } catch(e2) {}
  }

  showOutlookToast(cc);

  // Open Outlook with plain body — user then pastes HTML version over it for colors
  const dateVal = document.getElementById('date').value;
  let dateStr   = 'Report';
  if (dateVal) dateStr = new Date(dateVal).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  const subject = `Orion India QA Team Task Report - ${dateStr}`;
  const to      = document.getElementById('toEmail').value.trim();

  const url = 'https://outlook.cloud.microsoft/mail/deeplink/compose'
    + '?to='      + encodeURIComponent(to)
    + '&subject=' + encodeURIComponent(subject)
    + '&body='    + encodeURIComponent(plainText);
  window.open(url, '_blank');
}

function showOutlookToast(cc) {
  const t   = document.getElementById('ccToast');
  const em  = document.getElementById('ccToastEmail');
  if (em) em.textContent = cc || '(no CC set)';
  const hint = t.querySelector('.cc-toast-hint');
  if (hint) hint.innerHTML =
    'To get <strong>bold + colours</strong> in Outlook: click in email body → <kbd>Ctrl+A</kbd> → <kbd>Ctrl+V</kbd> &nbsp;|&nbsp; For CC: click CC field → <kbd>Ctrl+V</kbd>';
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 14000);
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
function playAlertBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beeps = [
      { freq: 880, start: 0,    dur: 0.18 },
      { freq: 880, start: 0.22, dur: 0.18 },
      { freq: 1100,start: 0.44, dur: 0.35 },
    ];
    beeps.forEach(({ freq, start, dur }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type      = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + start + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch(e) { /* Audio not supported — silent fallback */ }
}
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

  // 🔔 Play triple-beep alert
  playAlertBeep();
  // Repeat beep every 4 seconds until user dismisses
  const beepInt = setInterval(playAlertBeep, 4000);
  document.getElementById('sendNowModal')._beepInt = beepInt;

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
  clearInterval(m._beepInt);
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
  const outbox    = document.getElementById('outbox');
  const plainText = outbox.dataset.plain || outbox.innerText;
  const tag       = document.getElementById('ctag');

  const showFeedback = () => {
    tag.classList.add('show');
    setTimeout(() => tag.classList.remove('show'), 2000);
  };

  // Try to copy as HTML so pasting into Outlook preserves bold/colors
  try {
    const htmlContent = `<html><body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000">${outbox.innerHTML}</body></html>`;
    const htmlBlob    = new Blob([htmlContent], { type: 'text/html' });
    const textBlob    = new Blob([plainText],   { type: 'text/plain' });
    const item        = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob });
    navigator.clipboard.write([item]).then(showFeedback).catch(() => {
      // Fallback: plain text
      navigator.clipboard.writeText(plainText).then(showFeedback);
    });
  } catch(e) {
    // Older browser fallback
    navigator.clipboard.writeText(plainText).then(showFeedback).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = plainText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showFeedback();
    });
  }
}

// ---------- Day strip ----------

const DAYS     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const TODAY_IDX = new Date().getDay(); // 0=Sun … 6=Sat
let   activeDayIdx = TODAY_IDX;
let   tuesdayReminderDismissed = false;

function renderDayStrip() {
  const strip = document.getElementById('dayStrip');
  if (!strip) return;
  strip.innerHTML = DAYS.map((d, i) => {
    const isToday  = i === TODAY_IDX;
    const isActive = i === activeDayIdx;
    return `<button class="day-chip ${isActive ? 'day-active' : ''} ${isToday ? 'day-today' : ''}"
               onclick="selectDay(${i})" title="${isToday ? 'Today' : d}">
              ${d}${isToday ? '<span class="day-dot"></span>' : ''}
            </button>`;
  }).join('');
  updateTuesdayReminder();
}

function selectDay(idx) {
  activeDayIdx = idx;
  renderDayStrip();
}

function updateTuesdayReminder() {
  const banner = document.getElementById('tuesdayBanner');
  if (!banner) return;
  // Show if selected day is Thursday (idx 4) and not dismissed
  if (activeDayIdx === 4 && !tuesdayReminderDismissed) {
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

function dismissTuesdayReminder() {
  tuesdayReminderDismissed = true;
  updateTuesdayReminder();
}

// ---------- Clear report ----------

function showClearModal() {
  document.getElementById('clearModal').classList.add('open');
}

function hideClearModal() {
  document.getElementById('clearModal').classList.remove('open');
}

function confirmClear() {
  selectedMembers.clear();
  assignees.clear();
  clearTasksFromStorage();
  clearLeadTasks();
  if (db && reportRef) reportRef.remove().catch(() => {});
  try { localStorage.removeItem('qa-report-details'); } catch(e) {}

  document.getElementById('date').value       = '';
  document.getElementById('recipient').value  = 'Jenny';
  document.getElementById('signoff').value    = 'Mohit';
  document.getElementById('tinput').value     = '';
  document.getElementById('hint').textContent = '';

  // Reset day to system's current day
  activeDayIdx               = TODAY_IDX;
  tuesdayReminderDismissed   = false;
  renderDayStrip();

  hideClearModal();
  renderMembers();
  renderTasks();
  build();
}

// ---------- Team Permissions (lead controls, team sees) ----------

function saveTeamPerms() {
  if (db && permissionsRef) {
    permissionsRef.set(teamPerms).catch(e => console.warn('[Firebase] perms write:', e.code));
  } else {
    try { localStorage.setItem('qa-team-perms', JSON.stringify(teamPerms)); } catch(e) {}
  }
}

function startPermissionsListener() {
  if (permissionsRef && permListener) { permissionsRef.off('value', permListener); permListener = null; }

  const apply = val => {
    if (val) Object.assign(teamPerms, val);
    if (!isLead) applyPermissions(); // re-apply for team members
    if (isLead)  renderLeadPermsPanel(); // re-render lead toggles
  };

  if (db && permissionsRef) {
    permListener = permissionsRef.on('value',
      s  => apply(s.val()),
      () => { try { apply(JSON.parse(localStorage.getItem('qa-team-perms') || 'null')); } catch(e) {} }
    );
  } else {
    try { apply(JSON.parse(localStorage.getItem('qa-team-perms') || 'null')); } catch(e) {}
  }
}

// Lead toggles each feature for team
function toggleTeamPerm(key) {
  teamPerms[key] = !teamPerms[key];
  saveTeamPerms();
  renderLeadPermsPanel();
}

// Render lead permission panel toggles (real-time)
function renderLeadPermsPanel() {
  const panel = document.getElementById('leadPermsPanel');
  if (!panel) return;

  const PERMS = [
    { key: 'clearReport',  label: 'Clear Report for Team' },
    { key: 'saveMail',     label: 'Save Final Mail for Team' },
    { key: 'copyMail',     label: 'Copy Mail for Team' },
    { key: 'viewSaved',    label: 'View Saved Mail for Team' },
    { key: 'openInMail',   label: 'Open in Mail for Team' },
    { key: 'scheduleMail', label: 'Schedule Mail for Team' },
  ];

  panel.innerHTML = PERMS.map(p => `
    <div class="perm-row">
      <div class="perm-info">
        <span class="perm-label">${p.label}</span>
        <span class="perm-status">${teamPerms[p.key] ? '✓ Enabled for team' : 'Lead only'}</span>
      </div>
      <button class="toggle-btn ${teamPerms[p.key] ? 'toggle-on' : ''}" onclick="toggleTeamPerm('${p.key}')">
        <span class="toggle-knob"></span>
      </button>
    </div>`).join('');
}

// ---------- Login & Permissions ----------

const MEMBER_PASSWORD = 'Orion@123';
const LEAD_PASSWORD   = 'LOrion@123';
const LEAD_NAME       = 'Mohit';

let currentUser = null;
let isLead      = false;

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('app').style.display         = 'none';
}

function attemptLogin() {
  const name = document.getElementById('loginName').value;
  const pass = document.getElementById('loginPass').value;
  const err  = document.getElementById('loginErr');
  err.textContent = '';

  if (!name) { err.textContent = 'Please select your name.'; return; }
  if (!pass)  { err.textContent = 'Please enter your password.'; return; }

  const correctPass = (name === LEAD_NAME) ? LEAD_PASSWORD : MEMBER_PASSWORD;
  if (pass !== correctPass) {
    err.textContent = 'Incorrect password. Please try again.';
    document.getElementById('loginPass').value = '';
    return;
  }

  currentUser = name;
  isLead      = (name === LEAD_NAME);

  // Persist session so page refresh keeps the user logged in
  try { sessionStorage.setItem('qa-session', JSON.stringify({ user: currentUser, isLead })); } catch(e) {}

  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display         = 'flex';

  // Show logged-in user badge
  document.getElementById('loginBadge').textContent = currentUser + (isLead ? ' (Lead)' : '');
  document.getElementById('loginBadge').style.display = 'flex';

  // Pre-select the member who logged in
  selectedMembers.add(currentUser);
  if (!isLead) {
    assignees.add(currentUser);
    // Lock member grid — team members can't change who's selected
    setTimeout(() => {
      const grid = document.getElementById('mgrid');
      if (grid) { grid.style.pointerEvents = 'none'; grid.style.opacity = '0.7'; }
    }, 50);
  }

  applyPermissions();
  applyLeadTaskUI();
  if (isLead) renderLeadPermsPanel();

  startReportDetailsListener();
  startPermissionsListener();
  startLeadTasksListener(() => { renderAssignedTasks(); });

  let firstLoad = true;
  showSkeleton();
  startTasksListener(() => {
    tasks.forEach(t => t.members.forEach(m => selectedMembers.add(m)));
    selectedMembers.add(currentUser);
    if (!isLead) assignees.add(currentUser);

    if (firstLoad) {
      firstLoad = false;
      hideSkeleton();
      const othersCount = tasks.filter(t => !t.members.includes(currentUser)).length;
      if (othersCount > 0) setTimeout(() => showSharedTasksToast(othersCount), 400);
      renderDayStrip();
      renderMembers();
    } else {
      showSyncPulse();
    }
    renderTasks();
    build();
  });
}

// Toggle password visibility
function togglePassVis() {
  const inp = document.getElementById('loginPass');
  inp.type  = inp.type === 'password' ? 'text' : 'password';
}

function applyPermissions() {
  if (isLead) return;

  // Each button shown/hidden based on lead's teamPerms toggles
  const show = (sel, allowed) =>
    document.querySelectorAll(sel).forEach(el => el.style.display = allowed ? '' : 'none');

  show('.clearbtn', teamPerms.clearReport);
  show('.savebtn',  teamPerms.saveMail);
  show('.cpybtn',   teamPerms.copyMail);
  show('.viewbtn',  teamPerms.viewSaved);
  show('.mailbtn',  teamPerms.openInMail);
  show('.schbtn',   teamPerms.scheduleMail);

  const anyMailVisible = teamPerms.saveMail || teamPerms.copyMail ||
                         teamPerms.viewSaved || teamPerms.openInMail || teamPerms.scheduleMail;
  const outActions = document.querySelector('.out-actions');
  if (outActions) outActions.style.display = anyMailVisible ? '' : 'none';
  const note = document.getElementById('leadOnlyNote');
  if (note) note.style.display = anyMailVisible ? 'none' : 'block';

  ['date','recipient','signoff','toEmail','ccEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = true; el.style.opacity = '0.55'; }
  });
  const toggleRow = document.getElementById('commonToggleRow');
  if (toggleRow) toggleRow.style.display = 'flex';
}

function restorePermissions() {
  document.querySelectorAll('.cpybtn,.mailbtn,.schbtn,.clearbtn,.savebtn,.viewbtn').forEach(el => el.style.display = '');
  ['date','recipient','signoff','toEmail','ccEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = false; el.style.opacity = ''; }
  });
  const outActions = document.querySelector('.out-actions');
  if (outActions) outActions.style.display = '';
  const note = document.getElementById('leadOnlyNote');
  if (note) note.style.display = 'none';
  const toggleRow = document.getElementById('commonToggleRow');
  if (toggleRow) toggleRow.style.display = 'none';
  const grid = document.getElementById('mgrid');
  if (grid) { grid.style.pointerEvents = ''; grid.style.opacity = ''; }
}

// ---------- Common mail toggle (team members) ----------
let commonMailEnabled = false;

function toggleCommonMail() {
  commonMailEnabled = !commonMailEnabled;
  const btn   = document.getElementById('commonToggleBtn');
  const label = document.getElementById('commonToggleLabel');
  const grid  = document.getElementById('mgrid');

  if (commonMailEnabled) {
    btn.classList.add('toggle-on');
    label.textContent = 'Common mail ON — select teammates to include';
    // Unlock member grid so they can select others
    if (grid) { grid.style.pointerEvents = ''; grid.style.opacity = ''; }
  } else {
    btn.classList.remove('toggle-on');
    label.textContent = 'Common mail — include other members in this report';
    // Re-lock grid, reset to only current user
    selectedMembers.clear();
    selectedMembers.add(currentUser);
    assignees.clear();
    assignees.add(currentUser);
    if (grid) { grid.style.pointerEvents = 'none'; grid.style.opacity = '0.7'; }
    renderMembers();
    build();
  }
}

// ---------- Save / View saved mail (Lead only — cloud) ----------

function saveFinalMail() {
  const outbox    = document.getElementById('outbox');
  const plainText = outbox.dataset.plain || outbox.innerText;
  const htmlBody  = outbox.innerHTML;
  if (!plainText || plainText.includes('[no tasks added yet]')) {
    alert('Please add tasks before saving the report.');
    return;
  }
  const entry = {
    id:        Date.now(),
    savedAt:   new Date().toLocaleString('en-GB'),
    plain:     plainText,
    html:      htmlBody,
    date:      document.getElementById('date').value,
    recipient: document.getElementById('recipient').value,
  };
  saveMailToCloud(entry);
  showSaveConfirm();
}

function showSaveConfirm() {
  document.getElementById('saveConfirmModal').classList.add('open');
}

function hideSaveConfirm() {
  document.getElementById('saveConfirmModal').classList.remove('open');
}

function viewSavedMails() {
  const modal = document.getElementById('viewSavedModal');
  const list  = document.getElementById('savedMailList');
  list.innerHTML = '<div style="text-align:center;padding:20px;color:#888;font-size:13px">Loading...</div>';
  modal.classList.add('open');

  getSavedMails(saved => {
    if (!saved.length) {
      list.innerHTML = '<div style="text-align:center;padding:24px;color:#888;font-size:13px">No saved reports yet.</div>';
      return;
    }
    list.innerHTML = saved.map(m => {
      const dateLabel = m.date
        ? new Date(m.date).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
        : 'No date';
      return `
        <div class="saved-mail-item">
          <div class="saved-mail-meta">
            <span class="saved-mail-date">${dateLabel}</span>
            <span class="saved-mail-time">Saved: ${m.savedAt}</span>
            <span class="saved-mail-to">To: ${m.recipient || 'Jenny'}</span>
          </div>
          <div class="saved-mail-preview">${m.html}</div>
          <div class="saved-mail-actions">
            <button class="saved-del-btn" onclick="deleteSavedMail(${m.id})">Delete</button>
          </div>
        </div><div class="saved-divider"></div>`;
    }).join('');
  });
}

function deleteSavedMail(id) {
  deleteMailFromCloud(id, () => viewSavedMails());
}

function hideViewSaved() {
  document.getElementById('viewSavedModal').classList.remove('open');
}

function logout() {
  stopAllListeners();
  try { sessionStorage.removeItem('qa-session'); } catch(e) {}
  currentUser        = null;
  isLead             = false;
  giveTaskEnabled   = false;
  leadTaskAssignees.clear();
  const giveBtn = document.getElementById('giveTaskToggleBtn');
  if (giveBtn) giveBtn.classList.remove('toggle-on');
  const giveBody = document.getElementById('giveTaskBody');
  if (giveBody) giveBody.style.display = 'none';
  commonMailEnabled  = false;
  selectedMembers.clear();
  assignees.clear();
  tasks = [];

  // Reset toggle UI
  const btn   = document.getElementById('commonToggleBtn');
  const label = document.getElementById('commonToggleLabel');
  if (btn)   btn.classList.remove('toggle-on');
  if (label) label.textContent = 'Common mail — include other members in this report';

  document.getElementById('loginBadge').style.display = 'none';
  document.getElementById('loginName').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginErr').textContent = '';

  restorePermissions();
  showLogin();
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
try {
  const savedTheme = localStorage.getItem('qa-theme');
  if (savedTheme) applyTheme(savedTheme);
} catch(e) {}

initFirebase();

// Restore session if user was already logged in (page refresh)
(function restoreSession() {
  try {
    const raw = sessionStorage.getItem('qa-session');
    if (!raw) { showLogin(); return; }
    const session = JSON.parse(raw);
    if (!session || !session.user) { showLogin(); return; }

    // Re-apply session without re-validating password
    currentUser = session.user;
    isLead      = session.isLead;

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display         = 'flex';
    document.getElementById('loginBadge').textContent    = currentUser + (isLead ? ' (Lead)' : '');
    document.getElementById('loginBadge').style.display  = 'flex';

    selectedMembers.add(currentUser);
    if (!isLead) assignees.add(currentUser);

    applyPermissions();
    applyLeadTaskUI();
    if (isLead) renderLeadPermsPanel();
    startReportDetailsListener();
    startPermissionsListener();
    startLeadTasksListener(() => { renderAssignedTasks(); });

    let firstLoad = true;
    showSkeleton();
    startTasksListener(() => {
      tasks.forEach(t => t.members.forEach(m => selectedMembers.add(m)));
      selectedMembers.add(currentUser);
      if (!isLead && !assignees.size) assignees.add(currentUser);

      if (firstLoad) {
        firstLoad = false;
        hideSkeleton();
        renderDayStrip();
        renderMembers();
      } else {
        showSyncPulse();
      }
      renderTasks();
      build();
    });

    if (!isLead) {
      setTimeout(() => {
        const grid = document.getElementById('mgrid');
        if (grid && !commonMailEnabled) { grid.style.pointerEvents = 'none'; grid.style.opacity = '0.7'; }
      }, 100);
    }
  } catch(e) {
    console.warn('Session restore failed:', e);
    showLogin();
  }
})();