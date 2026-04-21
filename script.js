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

// Ctrl+Enter shortcut
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('tinput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addTask();
  });
});

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

    return `
      <div class="tcard">
        <div class="tbody">
          <div class="towner">${ownerHtml}</div>
          <div class="ttext-row">
            <div class="tbullet"></div>
            <div class="ttext">${esc(t.text)}</div>
          </div>
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

  // Task block — plain bullets, no name prefix (names shown once in header)
  const taskBlock = tasks.length
    ? tasks.map(t => `${BULLET} ${t.text}`).join('\n')
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

// ---------- Init ----------
renderMembers();
renderTasks();
build();