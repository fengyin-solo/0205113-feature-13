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

/* ==================== 仪表盘时间范围 / 列表筛选 共享逻辑 ==================== */

const DASH_RANGE_KEY = 'admin.dashboard.range';
const LIST_FILTER_KEY_PREFIX = 'admin.listFilter.';
// 仪表盘四个数据块与列表页的映射
const OVERVIEW_MODULES = {
    spot:  { page: 'spots.html',  label: '景点', addText: '新增景点' },
    route: { page: 'routes.html', label: '线路', addText: '新增线路' },
    hotel: { page: 'hotels.html', label: '酒店', addText: '新增酒店' },
    food:  { page: 'foods.html',  label: '美食', addText: '新增美食' }
};

function getDashboardRange() {
    try {
        const r = JSON.parse(localStorage.getItem(DASH_RANGE_KEY));
        if (r && typeof r === 'object') return { start: r.start || '', end: r.end || '' };
    } catch {}
    return { start: '', end: '' };
}

function setDashboardRange(start, end) {
    localStorage.setItem(DASH_RANGE_KEY, JSON.stringify({ start: start || '', end: end || '' }));
}

/** 从仪表盘下钻到列表页，时间范围通过 URL 传递（返回仪表盘时范围从 localStorage 恢复） */
function drillToList(module) {
    const cfg = OVERVIEW_MODULES[module];
    if (!cfg) return;
    const r = getDashboardRange();
    const params = new URLSearchParams();
    if (r.start) params.set('start', r.start);
    if (r.end) params.set('end', r.end);
    params.set('from', 'dashboard');
    location.href = cfg.page + '?' + params.toString();
}

/**
 * 读取列表页当前筛选条件：
 * 优先 URL 参数（仪表盘下钻），其次上次在列表页使用的条件。
 * 返回 { keyword, start, end }
 */
function resolveListFilter(module) {
    const urlKeyword = getParam('keyword') || '';
    const urlStart = getParam('start') || '';
    const urlEnd = getParam('end') || '';
    if (getParam('from') === 'dashboard' || urlStart || urlEnd || urlKeyword) {
        return { keyword: urlKeyword, start: urlStart, end: urlEnd, fromUrl: true };
    }
    try {
        const saved = JSON.parse(localStorage.getItem(LIST_FILTER_KEY_PREFIX + module));
        if (saved && typeof saved === 'object') {
            return { keyword: saved.keyword || '', start: saved.start || '', end: saved.end || '', fromUrl: false };
        }
    } catch {}
    return { keyword: '', start: '', end: '', fromUrl: false };
}

function saveListFilter(module, filter) {
    localStorage.setItem(LIST_FILTER_KEY_PREFIX + module, JSON.stringify({
        keyword: filter.keyword || '', start: filter.start || '', end: filter.end || ''
    }));
}

/** 初始化列表页筛选条（关键字 + 时间范围），并把值回填到输入框；返回当前筛选条件 */
function initListFilter(module, inputIds) {
    const ids = Object.assign({ keyword: 'fKeyword', start: 'fStart', end: 'fEnd' }, inputIds || {});
    const filter = resolveListFilter(module);
    const kwEl = document.getElementById(ids.keyword);
    const startEl = document.getElementById(ids.start);
    const endEl = document.getElementById(ids.end);
    if (kwEl) kwEl.value = filter.keyword;
    if (startEl) startEl.value = filter.start;
    if (endEl) endEl.value = filter.end;
    return filter;
}

/** 从筛选条读取输入并持久化 */
function readListFilter(module, inputIds) {
    const ids = Object.assign({ keyword: 'fKeyword', start: 'fStart', end: 'fEnd' }, inputIds || {});
    const filter = {
        keyword: (document.getElementById(ids.keyword) || {}).value?.trim() || '',
        start: (document.getElementById(ids.start) || {}).value || '',
        end: (document.getElementById(ids.end) || {}).value || ''
    };
    if (filter.start && filter.end && filter.start > filter.end) {
        showToast('开始日期不能晚于结束日期', 'warning');
        return null;
    }
    saveListFilter(module, filter);
    return filter;
}

function buildListQuery(filter, page, extra) {
    const params = new URLSearchParams(Object.assign({ page: page || 1, size: 10 }, extra || {}));
    if (filter.keyword) params.set('keyword', filter.keyword);
    if (filter.start) params.set('startDate', filter.start);
    if (filter.end) params.set('endDate', filter.end);
    return params.toString();
}

/** 列表“共 X 条 / 筛选命中 X 条”文案；筛选条件与仪表盘下钻口径一致 */
function listMetaText(filter, matchedCount) {
    return isFiltered(filter)
        ? `筛选命中 <b>${matchedCount}</b> 条（时间范围/关键字与仪表盘一致）`
        : `共 <b>${matchedCount}</b> 条`;
}

function isFiltered(filter) {
    return !!(filter.keyword || filter.start || filter.end);
}

/**
 * 渲染列表空态：
 * - 全部数据为 0（明细尚未生成）：说明情况 + 补充数据入口（新增按钮）
 * - 仅筛选结果为空：提示调整筛选条件 + 清除筛选
 * @param host        容器元素或 id
 * @param opts        { colspan, total, module, onAdd, onReset, addText }
 */
function renderListEmpty(host, opts) {
    const el = typeof host === 'string' ? document.getElementById(host) : host;
    if (!el) return;
    const addText = (opts.addText || '新增数据');
    if (!opts.total) {
        el.innerHTML = `<tr><td colspan="${opts.colspan}">
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>该模块的明细数据尚未生成，仪表盘统计暂无内容可展示</p>
                <div style="margin-top:14px">
                    <button class="btn btn-primary btn-sm" onclick="${opts.onAdd}"><i class="fas fa-plus"></i> ${escHtml(addText)}</button>
                </div>
            </div></td></tr>`;
    } else {
        el.innerHTML = `<tr><td colspan="${opts.colspan}">
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>没有符合当前关键字或时间范围的数据</p>
                <p style="font-size:12px;color:#bbb">可调整检索条件，或清除筛选查看全部数据</p>
                <div style="margin-top:14px">
                    <button class="btn btn-default btn-sm" onclick="${opts.onReset}"><i class="fas fa-redo"></i> 清除筛选条件</button>
                </div>
            </div></td></tr>`;
    }
}

/** 渲染“返回仪表盘”入口条；从仪表盘下钻进入时才显示 */
function renderDashboardBackBanner(module) {
    if (getParam('from') !== 'dashboard') return;
    const r = getDashboardRange();
    let rangeText = '全部时间';
    if (r.start || r.end) rangeText = (r.start || '最早') + ' ~ ' + (r.end || '至今');
    const bar = document.getElementById('dashboardBackBar');
    if (bar) {
        bar.classList.add('back-bar');
        bar.innerHTML = `<a href="index.html?from=list" class="back-link"><i class="fas fa-arrow-left"></i> 返回仪表盘</a>
            <span class="back-range"><i class="fas fa-clock"></i> 仪表盘时间范围：${escHtml(rangeText)}（返回后保留）</span>`;
        bar.style.display = '';
    }
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

    // 带 data-perm-key 的元素（如仪表盘数据总览卡片）按菜单权限显隐
    document.querySelectorAll('[data-perm-key]').forEach(el => {
        el.style.display = allowed.has(el.getAttribute('data-perm-key')) ? '' : 'none';
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
