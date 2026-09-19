const API = (window.location.port === '8084' || window.location.port === '81') && window.location.protocol !== 'file:' ? '' : 'http://localhost:8089';

async function api(path) {
    const res = await fetch(API + path, { credentials: 'include' });
    const data = await res.json();
    if (data.code === 401) { showToast('请先登录', 'error'); setTimeout(() => location.href = 'login.html', 1000); return null; }
    if (data.code !== 200) { showToast(data.msg || '操作失败', 'error'); return null; }
    return (data.data !== null && data.data !== undefined) ? data.data : true;
}

function showConfirm(msg, onOk) {
    const id = 'cfm' + Date.now();
    const div = document.createElement('div');
    div.className = 'confirm-overlay';
    div.id = id;
    div.innerHTML =
        '<div class="confirm-box">' +
            '<div class="confirm-icon-wrap"><i class="fas fa-exclamation-circle"></i></div>' +
            '<div class="confirm-text">' + msg + '</div>' +
            '<div class="confirm-btns">' +
                '<button class="confirm-btn-cancel" id="' + id + 'c">取消</button>' +
                '<button class="confirm-btn-ok" id="' + id + 'k">确认</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(div);
    document.getElementById(id + 'c').onclick = () => div.remove();
    document.getElementById(id + 'k').onclick = () => { div.remove(); onOk && onOk(); };
    div.onclick = (e) => { if (e.target === div) div.remove(); };
}

function getParam(key) {
    return new URLSearchParams(location.search).get(key);
}

/* ==================== 仪表盘数据总览：时间范围 / 下钻 ==================== */

const DASH_RANGE_OPTIONS = [
    { value: '7',    label: '近7天' },
    { value: '30',   label: '近30天' },
    { value: '90',   label: '近90天' },
    { value: 'all',  label: '全部' }
];

const DASH_RANGE_STORAGE = 'dashRange';

function getDashRange() {
    const r = localStorage.getItem(DASH_RANGE_STORAGE);
    return DASH_RANGE_OPTIONS.some(o => o.value === r) ? r : '7';
}

function setDashRange(range) {
    if (DASH_RANGE_OPTIONS.some(o => o.value === range)) localStorage.setItem(DASH_RANGE_STORAGE, range);
}

function dashRangeLabel(range) {
    const o = DASH_RANGE_OPTIONS.find(x => x.value === String(range));
    return o ? o.label : '近7天';
}

/**
 * 相对天数 => [yyyy-MM-dd, yyyy-MM-dd]（本地时区，含今天）。
 * 与后端近 N 天口径一致（N=7 时从 6 天前 00:00 到今天 23:59:59）。
 */
function rangeToDates(days) {
    const d = parseInt(days, 10);
    if (!d || d <= 0) return ['', ''];
    const pad = n => String(n).padStart(2, '0');
    const fmt = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (d - 1));
    return [fmt(start), fmt(end)];
}

/** 仪表盘分块 → 对应管理列表页 */
const DASH_PAGES = {
    spot:  'spots.html',
    route: 'routes.html',
    hotel: 'hotels.html',
    food:  'foods.html'
};

/**
 * 跳转到下钻列表页，携带 type 与时间范围；列表页会自行持久化，
 * 返回仪表盘时仪表盘再从 localStorage 读取，从而保留原时间范围。
 */
function drillToList(type, range) {
    const page = DASH_PAGES[type];
    if (!page) return;
    if (range) setDashRange(range);
    const params = new URLSearchParams();
    params.set('from', 'dashboard');
    if (range) params.set('range', range || getDashRange());
    location.href = page + '?' + params.toString();
}

/**
 * 列表页初始化时间范围：优先 URL 参数（来自仪表盘下钻），其次上次使用值，默认近7天。
 * 同时写回 localStorage，保证重新打开仍保留。
 */
function initListRange(pageType) {
    const fromUrl = getParam('range');
    const key = 'dashRange:' + pageType;
    let range = fromUrl || localStorage.getItem(key) || getDashRange();
    if (!DASH_RANGE_OPTIONS.some(o => o.value === range)) range = '7';
    localStorage.setItem(key, range);
    return range;
}

function saveListRange(pageType, range) {
    localStorage.setItem('dashRange:' + pageType, range);
}

function buildListQuery(pageType, page, size, extra) {
    const range = localStorage.getItem('dashRange:' + pageType) || '7';
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('size', size);
    if (extra && extra.keyword) params.set('keyword', extra.keyword);
    if (range !== 'all') {
        const [startDate, endDate] = rangeToDates(range);
        params.set('startDate', startDate);
        params.set('endDate', endDate);
    }
    return params.toString();
}

/** 列表页时间范围下拉 + 关键字检索工具栏 */
function renderListFilterBar(containerId, opts) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
        <div class="filter-bar">
            <a href="index.html" class="btn btn-default btn-sm" title="返回仪表盘（保留时间范围）"><i class="fas fa-arrow-left"></i> 返回仪表盘</a>
            <span class="filter-divider"></span>
            <label class="filter-label"><i class="far fa-clock"></i> 创建时间</label>
            <select class="form-control range-select">
                ${DASH_RANGE_OPTIONS.map(o => `<option value="${o.value}" ${o.value === opts.range ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
            <input type="text" class="form-control keyword-input" placeholder="${opts.placeholder || '输入关键字检索'}" value="${escHtml(opts.keyword || '')}">
            <button class="btn btn-primary btn-search"><i class="fas fa-search"></i> 检索</button>
            <button class="btn btn-default btn-reset">重置</button>
            <span class="list-total-hint" id="${containerId}Hint"></span>
        </div>`;
    el.querySelector('.range-select').addEventListener('change', e => opts.onRangeChange(e.target.value));
    const doSearch = () => opts.onKeyword(el.querySelector('.keyword-input').value.trim());
    el.querySelector('.btn-search').addEventListener('click', doSearch);
    el.querySelector('.keyword-input').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    el.querySelector('.btn-reset').addEventListener('click', () => opts.onReset());
}

/** 空结果提示：区分「时间范围内无新增明细」与「关键字无结果」，均给出补充数据入口 */
function renderEmptyRow(cols, opts) {
    const isRangeEmpty = opts.range && opts.range !== 'all' && !opts.keyword;
    const icon = isRangeEmpty ? 'far fa-folder-open' : 'fas fa-inbox';
    const reason = isRangeEmpty
        ? `${dashRangeLabel(opts.range)}内暂无新增${opts.entityLabel || '明细'}，明细可能尚未生成`
        : (opts.keyword ? `未找到与「${escHtml(opts.keyword)}」匹配的${opts.entityLabel || '明细'}` : `暂无${opts.entityLabel || '明细'}数据`);
    return `<tr><td colspan="${cols}" class="empty-state">
        <i class="${icon}"></i>
        <p>${reason}</p>
        <button class="btn btn-primary btn-sm" onclick="${opts.addHandler}"><i class="fas fa-plus"></i> 立即补充${opts.entityLabel || '数据'}</button>
    </td></tr>`;
}

function saveUser(u) {
    localStorage.setItem('user', JSON.stringify(u));
}

function getUser() {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}

function clearUser() {
    localStorage.removeItem('user');
}

function showToast(msg, type = 'success') {
    let c = document.querySelector('.toast-container');
    if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 2500);
}

function imgError(el) {
    el.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" fill="%23ccc"><rect width="60" height="40" fill="%23f5f5f5"/><text x="50%" y="55%" text-anchor="middle" font-size="10" fill="%23ccc">暂无图</text></svg>';
}

function renderPagination(containerId, current, total, callback) {
    const c = document.getElementById(containerId);
    if (!c || total <= 1) { if (c) c.innerHTML = ''; return; }
    let h = '';
    h += `<button ${current <= 1 ? 'disabled' : ''} onclick="${callback}(${current - 1})">上一页</button>`;
    const show = [];
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - 2 && i <= current + 2)) show.push(i);
    }
    let last = 0;
    show.forEach(i => {
        if (last && i - last > 1) h += `<button disabled>...</button>`;
        h += `<button class="${i === current ? 'active' : ''}" onclick="${callback}(${i})">${i}</button>`;
        last = i;
    });
    h += `<button ${current >= total ? 'disabled' : ''} onclick="${callback}(${current + 1})">下一页</button>`;
    c.innerHTML = h;
}

function formatDate(str) {
    if (!str) return '-';
    const d = new Date(str);
    if (isNaN(d)) return str;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function requireAdmin() {
    const u = getUser();
    if (!u || (u.role !== 'ADMIN' && u.role !== 'STAFF')) {
        showToast('请先以管理员或工作人员身份登录', 'error');
        setTimeout(() => location.href = 'login.html', 800);
        return false;
    }
    const nameEl = document.getElementById('adminName');
    if (nameEl) {
        const roleLabel = u.role === 'STAFF' ? '工作人员' : '管理员';
        nameEl.textContent = (u.nickname || u.username || roleLabel) + '（' + roleLabel + '）';
    }
    return true;
}

function renderSidebar() {
    const nav = document.querySelector('.sidebar-nav');
    if (nav) nav.classList.add('permission-pending');
    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar-nav a').forEach(a => {
        const href = a.getAttribute('href');
        if (href === page) a.classList.add('active');
        else a.classList.remove('active');
    });
    applyRoleMenuVisibility();
}

const MENU_KEY_BY_HREF = {
    'index.html': 'dashboard',
    'users.html': 'user_manage',
    'spots.html': 'spot_manage',
    'routes.html': 'route_manage',
    'culture.html': 'culture_manage',
    'hotels.html': 'hotel_manage',
    'foods.html': 'food_manage',
    'comments.html': 'comment_manage',
    'orders.html': 'order_manage',
    'faqs.html': 'faq_manage',
    'feedbacks.html': 'feedback_manage',
    'route-review.html': 'route_review',
    'spot-review.html': 'spot_review',
    'permissions.html': 'role_manage',
    'customer-service.html': 'customer_service'
};

async function applyRoleMenuVisibility() {
    const u = getUser();
    const nav = document.querySelector('.sidebar-nav');
    if (!u) {
        if (nav) nav.classList.remove('permission-pending');
        return;
    }
    if (u.role === 'ADMIN') {
        if (nav) nav.classList.remove('permission-pending');
        return;
    }
    const links = Array.from(document.querySelectorAll('.sidebar-nav a'));
    if (!links.length) {
        if (nav) nav.classList.remove('permission-pending');
        return;
    }

    let allowed = new Set();
    const roleMenus = await api('/api/admin/role/menu/list?roleCode=' + encodeURIComponent(u.role));
    if (Array.isArray(roleMenus)) {
        roleMenus
            .filter(m => m && Number(m.enabled) === 1 && m.menuKey)
            .forEach(m => allowed.add(m.menuKey));
    }
    if (!allowed.size && u.role === 'STAFF') {
        allowed = new Set(['dashboard', 'spot_manage']);
    }

    const allMenuLinks = Array.from(document.querySelectorAll('a[href]'));
    allMenuLinks.forEach(link => {
        const href = link.getAttribute('href');
        const menuKey = MENU_KEY_BY_HREF[href];
        if (!menuKey) return;
        if (link.closest('.sidebar-nav')) {
            link.style.display = allowed.has(menuKey) ? '' : 'none';
            return;
        }
        if (link.classList.contains('btn')) {
            link.style.display = allowed.has(menuKey) ? '' : 'none';
        }
    });

    const page = location.pathname.split('/').pop() || 'index.html';
    const currentMenuKey = MENU_KEY_BY_HREF[page];
    if (currentMenuKey && !allowed.has(currentMenuKey)) {
        const fallback = allowed.has('dashboard') ? 'index.html' : (allowed.has('spot_manage') ? 'spots.html' : 'login.html');
        if (page !== fallback) location.href = fallback;
    }
    if (nav) nav.classList.remove('permission-pending');
}

async function uploadFile(inputEl) {
    const file = inputEl.files[0];
    if (!file) return null;
    const fd = new FormData();
    fd.append('file', file);
    try {
        const res = await fetch(API + '/api/file/upload', { method: 'POST', body: fd, credentials: 'include' });
        const data = await res.json();
        if (data.code !== 200) { showToast(data.msg || '上传失败', 'error'); return null; }
        return data.data;
    } catch (e) {
        showToast('上传失败', 'error');
        return null;
    }
}

function doLogout() {
    clearUser();
    showToast('已退出登录');
    setTimeout(() => location.href = 'login.html', 500);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function imgSrc(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return API + url;
}

function renderStars(n) {
    n = parseInt(n) || 0;
    let h = '';
    for (let i = 1; i <= 5; i++) h += `<i class="fas fa-star ${i <= n ? '' : 'empty'}"></i>`;
    return `<span class="stars">${h}</span>`;
}

/**
 * 统一修正后台所有表格的“操作列”对齐问题：
 * 1) 自动识别表头文本为“操作”的列索引；
 * 2) 给该列 th/td 添加 action-col；
 * 3) 若 td 内存在多个按钮但未包裹 .action-btns，则自动包裹，避免换行错位。
 */
function normalizeTableActionColumns(root = document) {
    const tables = root.querySelectorAll('table');
    tables.forEach(table => {
        const headRow = table.querySelector('thead tr');
        if (!headRow) return;
        const ths = Array.from(headRow.children || []);
        const actionIdx = ths.findIndex(th => (th.textContent || '').trim() === '操作');
        if (actionIdx < 0) return;

        // header col
        if (ths[actionIdx]) ths[actionIdx].classList.add('action-col');

        // body cols
        table.querySelectorAll('tbody tr').forEach(tr => {
            const tds = tr.children;
            if (!tds || !tds[actionIdx]) return;
            const td = tds[actionIdx];
            td.classList.remove('action-btns'); // 防止 td 被当成 flex 容器导致错位
            td.classList.add('action-col');

            const hasWrapper = td.querySelector('.action-btns');
            if (!hasWrapper) {
                const controls = Array.from(td.children).filter(el =>
                    el.tagName === 'BUTTON' || el.tagName === 'A'
                );
                if (controls.length >= 1) {
                    const wrap = document.createElement('div');
                    wrap.className = 'action-btns';
                    controls.forEach(c => wrap.appendChild(c));
                    td.appendChild(wrap);
                }
            }
        });
    });
}

// 监听动态渲染（列表页大量通过 innerHTML 异步更新）
document.addEventListener('DOMContentLoaded', () => {
    normalizeTableActionColumns(document);
    const mo = new MutationObserver(() => normalizeTableActionColumns(document));
    mo.observe(document.body, { childList: true, subtree: true });
});

/* Session 超时检测 */
setInterval(async () => {
    const u = getUser();
    if (!u) return;
    try {
        const res = await fetch(API + '/api/auth/currentUser', { credentials: 'include' });
        const data = await res.json();
        if (data.code === 401) {
            clearUser();
            showToast('登录已超时，请重新登录', 'error');
            setTimeout(() => location.href = 'login.html', 1200);
        }
    } catch (e) {}
}, 300000);
