'use strict';

/* ════════════════════════════════════════════════════════
   app.js  ─  Flask(/api) 연동 버전
   새로고침해도 efs_data에 저장된 데이터 유지
   ════════════════════════════════════════════════════════ */

const API = '/api';

/* ── 아이콘 & 색상 ──────────────────────────────────────── */
const EXT_ICON = {
  folder:'📁', pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊',
  ppt:'📋', pptx:'📋', png:'🖼️', jpg:'🖼️', jpeg:'🖼️', gif:'🖼️',
  webp:'🖼️', svg:'🎨', mp4:'🎬', mov:'🎬', avi:'🎬', mp3:'🎵',
  wav:'🎵', zip:'🗜️', rar:'🗜️', tar:'🗜️', js:'⚡', ts:'⚡',
  py:'🐍', json:'📋', html:'🌐', css:'🎨', txt:'📃', md:'📃',
  default:'📄',
};
const EXT_BG = ext => ({
  folder:'rgba(68,136,255,.16)', pdf:'rgba(255,85,102,.14)',
  xls:'rgba(34,221,170,.13)',    xlsx:'rgba(34,221,170,.13)',
  png:'rgba(34,221,170,.13)',    jpg:'rgba(34,221,170,.13)',
  jpeg:'rgba(34,221,170,.13)',   gif:'rgba(34,221,170,.13)',
  mp4:'rgba(255,170,51,.14)',    mov:'rgba(255,170,51,.14)',
  py:'rgba(68,136,255,.13)',
}[ext] || 'rgba(255,255,255,.05)');

const TYPE_META = {
  doc:   { name:'문서',         ext:'.doc',  mime:'text/plain' },
  sheet: { name:'스프레드시트', ext:'.xlsx', mime:'text/plain' },
  slide: { name:'프레젠테이션', ext:'.pptx', mime:'text/plain' },
};

/* ── 정규화 ─────────────────────────────────────────────── */
function normalize(f) {
  const name = f.name || '';
  const ext  = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  return {
    id:          f.id,
    name,
    type:        f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
    mimeType:    f.mimeType || '',
    size:        f.size ? parseInt(f.size) : 0,
    starred:     !!f.starred,
    shared:      !!f.shared,
    createdAt:   f.modifiedTime ? new Date(f.modifiedTime).getTime() : Date.now(),
    webViewLink: f.webViewLink || null,
    _ext: ext,
  };
}

function getExt(f)  { return f._ext || (f.type === 'folder' ? 'folder' : 'default'); }
function getIcon(f) { return EXT_ICON[getExt(f)] || EXT_ICON.default; }
function getBg(f)   { return EXT_BG(getExt(f)); }

function fmtSize(b) {
  if (!b) return '-';
  if (b < 1024)    return b + ' B';
  if (b < 1 << 20) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1 << 30) return (b / (1 << 20)).toFixed(1) + ' MB';
  return (b / (1 << 30)).toFixed(2) + ' GB';
}
function fmtDate(ts) {
  if (!ts) return '-';
  const diff = Date.now() - ts;
  if (diff < 60000)        return '방금 전';
  if (diff < 3600000)      return Math.floor(diff / 60000) + '분 전';
  if (diff < 86400000)     return Math.floor(diff / 3600000) + '시간 전';
  if (diff < 86400000 * 7) return Math.floor(diff / 86400000) + '일 전';
  return new Date(ts).toLocaleDateString('ko-KR', { month:'short', day:'numeric' });
}
function esc(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── 상태 ─────────────────────────────────────────────────── */
const S = {
  view:        'home',
  search:      '',
  gridMode:    true,
  ctxTarget:   null,
  folderStack: [],  // [{id, name}]
  files:       [],  // 현재 뷰 파일 목록
  homeRecent:  [],  // 홈 최근 파일
};

/* ── DOM ──────────────────────────────────────────────────── */
const $       = id => document.getElementById(id);
const ctxMenu = $('context-menu');
const toastCont = $('toast-container');

/* ════════════════════════════════════════════════════════
   API
   ════════════════════════════════════════════════════════ */
async function apiFetch(path, opts = {}) {
  try {
    const res  = await fetch(API + path, opts);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'API 오류');
    return data.data;
  } catch (e) {
    const msg = e.message === 'Failed to fetch'
      ? '서버에 연결할 수 없습니다. app.py를 먼저 실행하세요.'
      : e.message;
    toast(msg, 'error');
    throw e;
  }
}

/* ── 뷰에 맞는 파일 로드 ─────────────────────────────────── */
async function loadFiles() {
  showLoading(true);
  try {
    const p = new URLSearchParams({ pageSize: 100 });
    if (S.view === 'starred') p.set('starred', 'true');
    if (S.view === 'trash')   p.set('trashed',  'true');
    if (S.view === 'shared')  p.set('shared',   'true');
    if (S.view === 'recent')  p.set('orderBy',  'modifiedTime desc');
    if (S.view === 'folder' && S.folderStack.length)
      p.set('folderId', S.folderStack[S.folderStack.length - 1].id);
    if (S.search) p.set('q', S.search);

    const raw  = await apiFetch('/files?' + p);
    S.files    = (raw || []).map(normalize);

    // 홈: 최근 파일 별도 로드
    if (S.view === 'home') {
      const rp = new URLSearchParams({ pageSize: 6, orderBy: 'modifiedTime desc' });
      if (S.search) rp.set('q', S.search);
      const recent = await apiFetch('/files?' + rp);
      S.homeRecent = (recent || []).filter(f => f.mimeType !== 'application/vnd.google-apps.folder').slice(0, 6).map(normalize);
    }
  } catch (_) {
    S.files = []; S.homeRecent = [];
  } finally {
    showLoading(false);
  }
}

/* ════════════════════════════════════════════════════════
   렌더링
   ════════════════════════════════════════════════════════ */
async function render() {
  await loadFiles();
  updateNav();
  updateBreadcrumb();
  updateSectionTitle();
  updateTrashBtn();
  loadStorage();

  if (S.view === 'home') {
    $('view-home').style.display  = '';
    $('view-files').style.display = 'none';
    renderHome();
  } else {
    $('view-home').style.display  = 'none';
    $('view-files').style.display = '';
    renderFiles();
  }
}

/* ── 홈 ──────────────────────────────────────────────────── */
function renderHome() {
  const grid  = $('recent-grid');
  const empty = $('recent-empty');
  grid.innerHTML = '';

  if (!S.homeRecent.length) {
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
    S.homeRecent.forEach(file => {
      const card = document.createElement('div');
      card.className = 'recent-card';
      card.innerHTML = `
        <span class="rc-icon">${getIcon(file)}</span>
        <div class="rc-info">
          <div class="rc-name" title="${esc(file.name)}">${esc(file.name)}</div>
          <div class="rc-time">${fmtDate(file.createdAt)}</div>
        </div>`;
      card.addEventListener('click',       () => handleOpen(file));
      card.addEventListener('contextmenu', e  => openCtx(e, file));
      grid.appendChild(card);
    });
  }

  const hg = $('home-file-grid');
  hg.innerHTML = '';
  hg.className = S.gridMode ? 'file-grid' : 'file-grid list-view';
  S.files.slice(0, 8).forEach((f, i) =>
    hg.appendChild(S.gridMode ? buildCard(f, i) : buildRow(f, i)));
}

/* ── 파일 뷰 ─────────────────────────────────────────────── */
function renderFiles() {
  const grid    = $('file-grid');
  const empty   = $('empty-state');
  const listHdr = $('list-header');

  grid.innerHTML = '';
  grid.className = S.gridMode ? 'file-grid' : 'file-grid list-view';
  listHdr.style.display = S.gridMode ? 'none' : 'flex';

  if (!S.files.length) {
    empty.style.display = 'flex';
    $('empty-hint').textContent = S.view === 'trash' ? '휴지통이 비어 있습니다' : '새로 만들기로 파일을 추가해 보세요';
    return;
  }
  empty.style.display = 'none';
  S.files.forEach((f, i) => grid.appendChild(S.gridMode ? buildCard(f, i) : buildRow(f, i)));
}

/* ── 카드 / 로우 ─────────────────────────────────────────── */
function buildCard(file, idx) {
  const div = document.createElement('div');
  div.className = 'file-card';
  div.dataset.id = file.id;
  div.style.animationDelay = (idx * 0.025) + 's';
  div.innerHTML = `
    <div class="fc-icon" style="background:${getBg(file)}">${getIcon(file)}</div>
    <div class="fc-name" title="${esc(file.name)}">${esc(file.name)}</div>
    <div class="fc-meta">${fmtSize(file.size)}</div>
    ${file.starred ? '<span class="fc-star">★</span>' : ''}
    ${file.shared  ? `<span class="fc-shared"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg></span>` : ''}`;
  div.addEventListener('dblclick',    () => handleOpen(file));
  div.addEventListener('contextmenu', e  => openCtx(e, file));
  return div;
}

function buildRow(file, idx) {
  const div = document.createElement('div');
  div.className = 'file-row';
  div.dataset.id = file.id;
  div.style.animationDelay = (idx * 0.018) + 's';
  div.innerHTML = `
    <span class="fr-icon">${getIcon(file)}</span>
    <span class="fr-name" title="${esc(file.name)}">${esc(file.name)}</span>
    ${file.starred ? '<span class="fr-star">★</span>' : ''}
    <span class="fr-date">${fmtDate(file.createdAt)}</span>
    <span class="fr-size">${fmtSize(file.size)}</span>`;
  div.addEventListener('dblclick',    () => handleOpen(file));
  div.addEventListener('contextmenu', e  => openCtx(e, file));
  return div;
}

/* ════════════════════════════════════════════════════════
   파일 열기 / 미리보기
   ════════════════════════════════════════════════════════ */
function handleOpen(file) {
  // 폴더: 폴더 안으로 이동
  if (file.type === 'folder') {
    S.folderStack.push({ id: file.id, name: file.name });
    S.view = 'folder';
    setActiveNav('my-drive');
    render();
    return;
  }
  // 파일: 항상 미리보기 모달로 열기 (다운로드 대신)
  openPreview(file);
}

/* ── 미리보기 모달 ───────────────────────────────────────── */
async function openPreview(file) {
  $('preview-icon-lg').textContent = getIcon(file);
  $('preview-name').textContent    = file.name;
  $('preview-meta').textContent    = `${fmtSize(file.size)} · ${fmtDate(file.createdAt)}`;
  $('preview-dl').onclick = () => { window.location.href = `${API}/download/${file.id}`; };

  const body = $('preview-body');
  body.innerHTML = `<div class="preview-loading"><div class="spinner"></div><span>불러오는 중…</span></div>`;
  body.style = '';
  openModal('modal-preview');

  try {
    const data = await apiFetch(`/preview/${file.id}`);
    renderPreviewBody(data, file);
  } catch (_) {
    renderPreviewFallback(file);
  }
}

function renderPreviewBody(data, file) {
  const body = $('preview-body');

  /* 이미지 */
  if (data.type === 'image') {
    body.style.cssText = 'padding:0;background:#111;display:flex;align-items:center;justify-content:center;';
    const img = document.createElement('img');
    img.src = data.dataUrl;
    img.style.cssText = 'max-width:100%;max-height:65vh;object-fit:contain;border-radius:6px;';
    body.innerHTML = '';
    body.appendChild(img);
    return;
  }

  /* 텍스트 */
  if (data.type === 'text') {
    body.style.cssText = 'padding:0;background:var(--bg-3);display:block;text-align:left;overflow:auto;';
    const ext = (data.ext || '').toLowerCase();

    if (ext === 'md') {
      body.innerHTML = `<div class="preview-md">${renderMd(data.content)}</div>`;
      return;
    }
    if (ext === 'csv') {
      body.style.overflowX = 'auto';
      body.innerHTML = renderCsv(data.content);
      return;
    }
    const codeExts = ['py','js','ts','html','css','json','xml','yaml','yml','toml',
                      'sh','bat','c','cpp','h','java','kt','rs','go','rb','php',
                      'swift','sql','ini','cfg','log'];
    const isCode = codeExts.includes(ext);

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    if (isCode) {
      const badge = document.createElement('span');
      badge.className = 'preview-lang-badge';
      badge.textContent = ext.toUpperCase();
      wrap.appendChild(badge);
    }
    const pre = document.createElement('pre');
    pre.className = 'preview-code';
    if (!isCode) { pre.style.fontFamily = 'inherit'; pre.style.whiteSpace = 'pre-wrap'; }
    pre.textContent = data.content;
    wrap.appendChild(pre);
    body.innerHTML = '';
    body.appendChild(wrap);
    return;
  }

  renderPreviewFallback(file);
}

function renderPreviewFallback(file) {
  const body = $('preview-body');
  body.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;';
  const msgs = {
    pdf:'다운로드 후 열거나 브라우저에서 직접 열어보세요',
    docx:'Word 문서는 다운로드 후 열 수 있습니다', doc:'Word 문서는 다운로드 후 열 수 있습니다',
    xlsx:'Excel 파일은 다운로드 후 열 수 있습니다', xls:'Excel 파일은 다운로드 후 열 수 있습니다',
    pptx:'PowerPoint 파일은 다운로드 후 열 수 있습니다',
    mp4:'동영상 파일입니다', mov:'동영상 파일입니다',
    mp3:'오디오 파일입니다', wav:'오디오 파일입니다',
    zip:'압축 파일입니다', rar:'압축 파일입니다',
  };
  const ext = getExt(file);
  body.innerHTML = `
    <span style="font-size:52px;margin-bottom:12px">${getIcon(file)}</span>
    <span style="color:var(--text);font-size:14px;font-weight:500">${esc(file.name)}</span>
    <span style="color:var(--text-3);font-size:12px;margin-top:6px">${msgs[ext] || '이 파일 형식은 미리보기를 지원하지 않습니다'}</span>
    <button class="btn-primary" style="margin-top:20px"
      onclick="window.location.href='${API}/download/${file.id}'">⬇ 다운로드</button>`;
}

/* ── 마크다운 렌더러 ─────────────────────────────────────── */
function renderMd(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^#{6}\s+(.+)$/gm,'<h6>$1</h6>').replace(/^#{5}\s+(.+)$/gm,'<h5>$1</h5>')
    .replace(/^#{4}\s+(.+)$/gm,'<h4>$1</h4>').replace(/^#{3}\s+(.+)$/gm,'<h3>$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm,'<h2>$1</h2>').replace(/^#{1}\s+(.+)$/gm,'<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code style="background:var(--bg-4);padding:1px 5px;border-radius:3px;font-size:12px">$1</code>')
    .replace(/^[-*]\s+(.+)$/gm,'<li>$1</li>')
    .replace(/^>\s+(.+)$/gm,'<blockquote style="border-left:3px solid var(--accent);padding-left:12px;color:var(--text-2);margin:4px 0">$1</blockquote>')
    .replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2" target="_blank" style="color:var(--accent)">$1</a>')
    .replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br>');
}

/* ── CSV 렌더러 ──────────────────────────────────────────── */
function renderCsv(text) {
  const rows = text.trim().split('\n').slice(0, 100);
  if (!rows.length) return '<span style="color:var(--text-3)">데이터 없음</span>';
  const parse = row => row.split(',').map(c => c.trim().replace(/^"|"$/g,''));
  const header = parse(rows[0]);
  const body   = rows.slice(1).map(parse);
  const th = header.map(h => `<th>${esc(h)}</th>`).join('');
  const td = body.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<table class="preview-table"><thead><tr>${th}</tr></thead><tbody>${td}</tbody></table>`;
}

/* ════════════════════════════════════════════════════════
   파일 액션 (API 연동)
   ════════════════════════════════════════════════════════ */
async function handleStar(file) {
  await apiFetch(`/files/${file.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ starred: !file.starred }),
  });
  toast(file.starred ? '즐겨찾기에서 제거됐습니다' : '즐겨찾기에 추가됐습니다', 'info');
  render();
}

async function handleTrash(file) {
  await apiFetch(`/files/${file.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
  toast(`"${file.name}"을(를) 휴지통으로 이동했습니다`, 'info');
  render();
}

async function handleRestore(file) {
  await apiFetch(`/files/${file.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: false }),
  });
  toast(`"${file.name}"이(가) 복원됐습니다`, 'success');
  render();
}

async function handleDelete(file) {
  if (!confirm(`"${file.name}"을(를) 영구 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return;
  await apiFetch(`/files/${file.id}`, { method: 'DELETE' });
  toast(`"${file.name}"이(가) 삭제됐습니다`, 'error');
  render();
}

/* ════════════════════════════════════════════════════════
   이름 변경
   ════════════════════════════════════════════════════════ */
function openRenameModal(file) {
  $('rename-input').value = file.name;
  openModal('modal-rename');
  setTimeout(() => $('rename-input').select(), 50);
  $('btn-rename-confirm').onclick = async () => {
    const name = $('rename-input').value.trim();
    if (!name) return;
    await apiFetch(`/files/${file.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    closeModal('modal-rename');
    toast('이름이 변경됐습니다', 'success');
    render();
  };
}
$('rename-input').addEventListener('keydown', e => {
  if (e.key === 'Enter')  $('btn-rename-confirm').click();
  if (e.key === 'Escape') closeModal('modal-rename');
});

/* ════════════════════════════════════════════════════════
   공유 모달
   ════════════════════════════════════════════════════════ */
let curShareFile = null;

async function openShareModal(file) {
  curShareFile = file;
  $('chk-link-share').checked  = file.shared;
  $('share-link-input').value  = file.shared ? `${location.origin}${API}/download/${file.id}` : '';
  $('share-email-input').value = '';
  openModal('modal-share');
  await loadPerms(file.id);
}

async function loadPerms(fileId) {
  try {
    const perms = await apiFetch(`/files/${fileId}/permissions`);
    const el = $('perm-list');
    el.innerHTML = '';
    if (!perms.length) {
      el.innerHTML = '<div style="color:var(--text-3);font-size:12px;padding:8px 0">공유된 사용자가 없습니다</div>';
      return;
    }
    const labels = { reader:'보기', commenter:'댓글', writer:'편집' };
    perms.forEach(p => {
      const row = document.createElement('div');
      row.className = 'perm-item';
      row.innerHTML = `
        <span class="perm-email">${esc(p.emailAddress || p.displayName || p.type)}</span>
        <span class="perm-role">${labels[p.role] || p.role}</span>
        <button class="perm-rm" data-pid="${p.id}">×</button>`;
      el.appendChild(row);
    });
    el.querySelectorAll('.perm-rm').forEach(btn => {
      btn.addEventListener('click', async () => {
        await apiFetch(`/files/${fileId}/permissions/${btn.dataset.pid}`, { method:'DELETE' });
        toast('권한이 제거됐습니다', 'info');
        loadPerms(fileId);
      });
    });
  } catch (_) {}
}

$('chk-link-share').addEventListener('change', async () => {
  if (!curShareFile) return;
  if ($('chk-link-share').checked) {
    await apiFetch(`/files/${curShareFile.id}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type:'anyone', role:'reader' }),
    });
    $('share-link-input').value = `${location.origin}${API}/download/${curShareFile.id}`;
    toast('링크 공유가 활성화됐습니다', 'success');
    loadPerms(curShareFile.id);
  } else {
    $('share-link-input').value = '';
    toast('링크 공유가 비활성화됐습니다', 'info');
  }
});

$('btn-copy-link').addEventListener('click', () => {
  const v = $('share-link-input').value;
  if (!v) { toast('먼저 링크 공유를 활성화하세요', 'warn'); return; }
  navigator.clipboard.writeText(v).catch(() => {});
  toast('링크가 복사됐습니다', 'success');
});

$('btn-share-add').addEventListener('click', async () => {
  const email = $('share-email-input').value.trim();
  const role  = $('share-role-select').value;
  if (!email || !curShareFile) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('유효한 이메일을 입력하세요', 'error'); return; }
  await apiFetch(`/files/${curShareFile.id}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role, type:'user' }),
  });
  $('share-email-input').value = '';
  toast(`${email}에게 공유됐습니다`, 'success');
  loadPerms(curShareFile.id);
});

/* ════════════════════════════════════════════════════════
   새로 만들기 드롭다운
   ════════════════════════════════════════════════════════ */
let newFileType = null;

$('btn-new').addEventListener('click', e => {
  e.stopPropagation();
  $('btn-new').classList.toggle('open');
  $('new-dropdown').classList.toggle('open');
});
document.addEventListener('click', () => {
  $('btn-new').classList.remove('open');
  $('new-dropdown').classList.remove('open');
});

$('new-dropdown').addEventListener('click', e => {
  const btn = e.target.closest('[data-new]');
  if (!btn) return;
  e.stopPropagation();
  $('btn-new').classList.remove('open');
  $('new-dropdown').classList.remove('open');
  const type = btn.dataset.new;
  if (type === 'upload') {
    $('file-input').click();
  } else if (type === 'folder') {
    $('folder-name-input').value = '새 폴더';
    openModal('modal-folder');
    setTimeout(() => $('folder-name-input').select(), 50);
  } else {
    newFileType = type;
    const meta = TYPE_META[type];
    $('newfile-title').textContent = meta.name + ' 만들기';
    $('newfile-name-input').value  = '제목 없는 ' + meta.name;
    openModal('modal-newfile');
    setTimeout(() => $('newfile-name-input').select(), 50);
  }
});

/* ── 폴더 만들기 ─────────────────────────────────────────── */
$('btn-folder-confirm').addEventListener('click', async () => {
  const name = $('folder-name-input').value.trim();
  if (!name) return;
  const pid = S.folderStack.length ? S.folderStack[S.folderStack.length - 1].id : null;
  await apiFetch('/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId: pid }),
  });
  closeModal('modal-folder');
  if (!['my-drive','folder'].includes(S.view)) { S.view = 'my-drive'; setActiveNav('my-drive'); }
  toast(`"${name}" 폴더가 생성됐습니다`, 'success');
  render();
});
$('folder-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter')  $('btn-folder-confirm').click();
  if (e.key === 'Escape') closeModal('modal-folder');
});

/* ── 새 파일 만들기 ─────────────────────────────────────── */
$('btn-newfile-confirm').addEventListener('click', async () => {
  const rawName = $('newfile-name-input').value.trim();
  if (!rawName || !newFileType) return;
  const meta = TYPE_META[newFileType];
  const name = rawName.includes('.') ? rawName : rawName + meta.ext;
  const blob = new Blob([''], { type: 'text/plain' });
  const file = new File([blob], name, { type: 'text/plain' });
  const fd   = new FormData();
  fd.append('file', file);
  const pid = S.folderStack.length ? S.folderStack[S.folderStack.length - 1].id : null;
  if (pid) fd.append('folderId', pid);
  await apiFetch('/upload', { method: 'POST', body: fd });
  closeModal('modal-newfile');
  if (!['my-drive','folder'].includes(S.view)) { S.view = 'my-drive'; setActiveNav('my-drive'); }
  toast(`"${name}"이(가) 생성됐습니다`, 'success');
  render();
  newFileType = null;
});
$('newfile-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter')  $('btn-newfile-confirm').click();
  if (e.key === 'Escape') closeModal('modal-newfile');
});

/* ════════════════════════════════════════════════════════
   업로드
   ════════════════════════════════════════════════════════ */
$('file-input').addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  for (const file of files) {
    const t  = toastProg(`⬆ "${file.name}" 업로드 중…`);
    const fd = new FormData();
    fd.append('file', file);
    const pid = S.folderStack.length ? S.folderStack[S.folderStack.length - 1].id : null;
    if (pid) fd.append('folderId', pid);
    try { await apiFetch('/upload', { method:'POST', body:fd }); t.remove(); toast(`✅ "${file.name}" 업로드 완료`, 'success'); }
    catch (_) { t.remove(); }
  }
  e.target.value = '';
  if (!['my-drive','folder'].includes(S.view)) { S.view = 'my-drive'; setActiveNav('my-drive'); }
  render();
});

/* ── 드래그 앤 드롭 ─────────────────────────────────────── */
const dropZone = $('drop-zone');
let dragCnt = 0;
document.addEventListener('dragenter', e => { e.preventDefault(); dragCnt++; dropZone.classList.add('active'); });
document.addEventListener('dragleave', () => { if (--dragCnt <= 0) { dragCnt=0; dropZone.classList.remove('active','dragover'); } });
document.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragover'); });
document.addEventListener('drop', async e => {
  e.preventDefault(); dragCnt=0; dropZone.classList.remove('active','dragover');
  const files = Array.from(e.dataTransfer.files);
  if (!files.length) return;
  for (const file of files) {
    const t  = toastProg(`⬆ "${file.name}" 업로드 중…`);
    const fd = new FormData(); fd.append('file', file);
    const pid = S.folderStack.length ? S.folderStack[S.folderStack.length - 1].id : null;
    if (pid) fd.append('folderId', pid);
    try { await apiFetch('/upload', { method:'POST', body:fd }); t.remove(); toast(`✅ "${file.name}" 완료`, 'success'); }
    catch (_) { t.remove(); }
  }
  if (!['my-drive','folder'].includes(S.view)) { S.view = 'my-drive'; setActiveNav('my-drive'); }
  render();
});

/* ════════════════════════════════════════════════════════
   휴지통 비우기
   ════════════════════════════════════════════════════════ */
$('btn-empty-trash').addEventListener('click', async () => {
  if (!S.files.length) return;
  if (!confirm('휴지통을 완전히 비울까요? 복구할 수 없습니다.')) return;
  await apiFetch('/trash', { method:'DELETE' });
  toast('휴지통을 비웠습니다', 'info');
  render();
});

/* ════════════════════════════════════════════════════════
   컨텍스트 메뉴
   ════════════════════════════════════════════════════════ */
function openCtx(e, file) {
  e.preventDefault();
  S.ctxTarget = file;
  const inTrash = S.view === 'trash';
  ctxMenu.querySelector('[data-action="trash"]').style.display   = inTrash ? 'none' : '';
  ctxMenu.querySelector('[data-action="restore"]').style.display = inTrash ? '' : 'none';
  ctxMenu.querySelector('[data-action="delete"]').style.display  = inTrash ? '' : 'none';
  $('ctx-star-label').textContent = file.starred ? '즐겨찾기 해제' : '즐겨찾기 추가';
  ctxMenu.style.left = Math.min(e.clientX, innerWidth  - 190) + 'px';
  ctxMenu.style.top  = Math.min(e.clientY, innerHeight - 300) + 'px';
  ctxMenu.classList.add('open');
}
function closeCtx() { ctxMenu.classList.remove('open'); S.ctxTarget = null; }

ctxMenu.addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]');
  if (!btn || !S.ctxTarget) return;
  const file = S.ctxTarget, action = btn.dataset.action;
  closeCtx();
  if (action === 'open')     handleOpen(file);
  if (action === 'download') window.location.href = `${API}/download/${file.id}`;
  if (action === 'rename')   openRenameModal(file);
  if (action === 'star')     await handleStar(file);
  if (action === 'share')    openShareModal(file);
  if (action === 'copy')     toast('복사 기능은 준비 중입니다', 'warn');
  if (action === 'trash')    await handleTrash(file);
  if (action === 'restore')  await handleRestore(file);
  if (action === 'delete')   await handleDelete(file);
});
document.addEventListener('click', e => { if (!ctxMenu.contains(e.target)) closeCtx(); });

/* ════════════════════════════════════════════════════════
   검색
   ════════════════════════════════════════════════════════ */
$('search-input').addEventListener('input', e => {
  S.search = e.target.value;
  $('search-clear').style.display = S.search ? '' : 'none';
  if (S.search && S.view === 'home') { S.view = 'my-drive'; setActiveNav('my-drive'); }
  render();
});
$('search-clear').addEventListener('click', () => {
  $('search-input').value = ''; S.search = '';
  $('search-clear').style.display = 'none';
  render();
});

/* ── 보기 전환 ──────────────────────────────────────────── */
$('btn-view-toggle').addEventListener('click', () => {
  S.gridMode = !S.gridMode;
  $('icon-grid').style.display = S.gridMode ? '' : 'none';
  $('icon-list').style.display = S.gridMode ? 'none' : '';
  render();
});

/* ── 사이드바 토글 ──────────────────────────────────────── */
$('sidebar-toggle').addEventListener('click', () => $('sidebar').classList.toggle('collapsed'));

/* ════════════════════════════════════════════════════════
   내비게이션
   ════════════════════════════════════════════════════════ */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    S.view = item.dataset.view;
    S.folderStack = [];
    S.search = '';
    $('search-input').value = '';
    $('search-clear').style.display = 'none';
    render();
  });
});

function updateNav() {
  const active = S.view === 'folder' ? 'my-drive' : S.view;
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.view === active));
}
function setActiveNav(v) {
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.view === v));
}

/* ════════════════════════════════════════════════════════
   브레드크럼
   ════════════════════════════════════════════════════════ */
function updateBreadcrumb() {
  const bc = $('breadcrumb');
  if (S.view !== 'folder' || !S.folderStack.length) { bc.style.display = 'none'; return; }
  bc.style.display = 'flex';
  $('bc-root').onclick = () => { S.folderStack = []; S.view = 'my-drive'; setActiveNav('my-drive'); render(); };
  const list = $('bc-list');
  list.innerHTML = '';
  S.folderStack.forEach((item, i) => {
    const sep = document.createElement('span'); sep.className = 'bc-sep'; sep.textContent = '›';
    list.appendChild(sep);
    if (i === S.folderStack.length - 1) {
      const cur = document.createElement('span'); cur.className = 'bc-current'; cur.textContent = item.name;
      list.appendChild(cur);
    } else {
      const span = document.createElement('span'); span.className = 'bc-item'; span.textContent = item.name;
      span.onclick = () => { S.folderStack = S.folderStack.slice(0, i+1); S.view = 'folder'; render(); };
      list.appendChild(span);
    }
  });
}

function updateSectionTitle() {
  const titles = { home:'홈', 'my-drive':'내 드라이브', shared:'공유 문서함',
    recent:'최근 문서함', starred:'즐겨찾기', trash:'휴지통',
    folder: S.folderStack.length ? S.folderStack[S.folderStack.length-1].name : '내 드라이브' };
  $('section-title').textContent = S.search ? `검색 결과: "${S.search}"` : (titles[S.view] || '');
}

function updateTrashBtn() {
  $('trash-actions').style.display = S.view === 'trash' && S.files.length ? '' : 'none';
}

/* ════════════════════════════════════════════════════════
   저장 용량
   ════════════════════════════════════════════════════════ */
async function loadStorage() {
  try {
    const s   = await apiFetch('/storage');
    const pct = s.total ? Math.min(s.used / s.total * 100, 100) : 0;
    $('storage-fill').style.width      = pct.toFixed(1) + '%';
    $('storage-used-text').textContent = fmtSize(s.used);
    if (s.displayName) {
      document.querySelector('.user-avatar').textContent = s.displayName.charAt(0).toUpperCase();
    }
  } catch (_) {}
}

/* ════════════════════════════════════════════════════════
   모달 유틸
   ════════════════════════════════════════════════════════ */
function openModal(id)  { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }

document.querySelectorAll('[data-close]').forEach(btn =>
  btn.addEventListener('click', () => closeModal(btn.dataset.close)));
document.querySelectorAll('.modal-overlay').forEach(ov =>
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); }));

/* ── 로딩 ─────────────────────────────────────────────── */
function showLoading(on) {
  const el = $('loading');
  if (el) el.style.display = on ? 'flex' : 'none';
}

/* ════════════════════════════════════════════════════════
   토스트
   ════════════════════════════════════════════════════════ */
function toast(msg, type = 'info', dur = 3000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  toastCont.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once:true });
  }, dur);
}
function toastProg(msg) {
  const el = document.createElement('div');
  el.className = 'toast info';
  el.textContent = msg;
  toastCont.appendChild(el);
  return el;
}

/* ════════════════════════════════════════════════════════
   키보드
   ════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeCtx();
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
  if ((e.ctrlKey||e.metaKey) && e.key === 'f') { e.preventDefault(); $('search-input').focus(); }
  if (e.key === 'Backspace' && S.view === 'folder' &&
      !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    if (S.folderStack.length > 1) S.folderStack.pop();
    else { S.folderStack = []; S.view = 'my-drive'; }
    render();
  }
});

/* ════════════════════════════════════════════════════════
   초기화
   ════════════════════════════════════════════════════════ */
render();