/* 首页：校园概览卡片 + 通知公告列表
   本页的 DOM 渲染与事件全部用 jQuery 完成（对比写法见 docs/jQuery改造说明.md）：
   - 渲染用 $('#id').empty() / .append(模板字符串)，代替原生 createElement + appendChild；
   - 筛选按钮用 $('#notice-filter').on('click', 'button', ...) 事件委托，代替原生 addEventListener + closest。 */

const overviewState = {
  rooms: null,
  notices: null,
  category: '全部'
};

const pageStatus = document.querySelector('#page-status');

/* 通知类别 → Bootstrap 徽章配色 */
const categoryBadge = (category) => {
  const palette = {
    '自习室': 'text-bg-primary',
    '讲座': 'text-bg-success',
    '维修': 'text-bg-danger',
    '场馆': 'text-bg-info',
    '交通': 'text-bg-warning',
    '食堂': 'text-bg-secondary',
    '社团': 'text-bg-dark',
    '网络': 'text-bg-primary'
  };
  return palette[category] || 'text-bg-secondary';
};

/* ---------- 概览卡片：数字全部来自 rooms.json，避免与统计页对不上 ---------- */
const renderOverview = () => {
  const rooms = overviewState.rooms;
  const notices = overviewState.notices;

  if (rooms === null) {
    $('#overview-cards').html('<div class="col-12"><div class="placeholder-note">自习室数据未加载。</div></div>');
    return;
  }

  const openRooms = rooms.rooms.filter(room => room.open);
  const openSeats = Campus.sum(openRooms.map(room => room.seats));
  const lastWeek = Campus.sum(openRooms.map(room => room.weekly[room.weekly.length - 1]));
  const latestWeek = rooms.weeks[rooms.weeks.length - 1];
  const noticeCount = notices === null ? 0 : notices.notices.length;

  const cards = [
    { label: '开放自习室', value: openRooms.length + ' 间', note: '共 ' + rooms.rooms.length + ' 间，含已关闭' },
    { label: '开放座位', value: Campus.formatNumber(openSeats) + ' 个', note: '仅统计开放中的自习室' },
    { label: latestWeek + '使用人次', value: Campus.formatNumber(lastWeek) + ' 人次', note: rooms.period + '（' + rooms.unit + '）' },
    { label: '通知公告', value: noticeCount + ' 条', note: '更新于 ' + (notices === null ? '—' : Campus.formatDate(notices.updated)) }
  ];

  $('#overview-cards').empty();
  cards.forEach(card => {
    $('#overview-cards').append(`
      <div class="col-6 col-lg-3">
        <div class="card h-100">
          <div class="card-body">
            <p class="text-muted small mb-1">${Campus.escapeHTML(card.label)}</p>
            <p class="fs-4 fw-semibold mb-1">${Campus.escapeHTML(card.value)}</p>
            <p class="small text-muted mb-0">${Campus.escapeHTML(card.note)}</p>
          </div>
        </div>
      </div>
    `);
  });
};

/* ---------- 通知列表 ---------- */
const renderNotices = () => {
  const list = $('#notice-list').empty();

  if (overviewState.notices === null) {
    list.append('<div class="col-12"><div class="placeholder-note">通知数据未加载，请查看上方提示。</div></div>');
    return;
  }

  const notices = overviewState.notices.notices.filter(notice =>
    overviewState.category === '全部' || notice.category === overviewState.category
  );

  if (notices.length === 0) {
    list.append('<div class="col-12"><div class="placeholder-note">该类别下暂无通知。</div></div>');
    return;
  }

  notices.forEach(notice => {
    list.append(`
      <div class="col-md-6">
        <article class="card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge ${categoryBadge(notice.category)}">${Campus.escapeHTML(notice.category)}</span>
              <time class="text-muted small" datetime="${Campus.escapeHTML(notice.date)}">${Campus.escapeHTML(Campus.formatDate(notice.date))}</time>
            </div>
            <h3 class="card-title h6">${Campus.escapeHTML(notice.title)}</h3>
            <p class="card-text small text-muted mb-0">${Campus.escapeHTML(notice.summary)}</p>
          </div>
        </article>
      </div>
    `);
  });
};

/* ---------- 事件：类别筛选（jQuery 事件委托，按钮动态变化也不用重新绑定） ---------- */
$('#notice-filter').on('click', 'button', function () {
  const button = $(this);
  overviewState.category = button.data('category');

  $('#notice-filter button').each(function () {
    const isCurrent = $(this).is(button);
    $(this).toggleClass('active', isCurrent).attr('aria-pressed', String(isCurrent));
  });

  renderNotices();
});

/* ---------- 加载数据：两个 JSON 并行请求，任一失败都给出明确提示 ---------- */
const loadHome = async () => {
  Campus.setStatus(pageStatus, '数据加载中…', 'warning');

  try {
    const [rooms, notices] = await Promise.all([
      Campus.fetchJSON('data/rooms.json'),
      Campus.fetchJSON('data/notices.json')
    ]);

    if (!Array.isArray(rooms.rooms) || rooms.rooms.length === 0) {
      Campus.setStatus(pageStatus, '暂无自习室数据。', 'warning');
    } else {
      Campus.clearStatus(pageStatus);
    }

    overviewState.rooms = rooms;
    overviewState.notices = notices;

    $('#notice-meta').text(
      notices.title + ' · 共 ' + notices.notices.length + ' 条 · 更新于 ' + Campus.formatDate(notices.updated) +
      ' · 数据来源：' + notices.source
    );

    renderOverview();
    renderNotices();
  } catch (error) {
    console.warn('首页数据加载失败：', error);   // 技术细节留在控制台，页面只给用户看得懂的提示
    Campus.setStatus(pageStatus, '暂时无法获取校园信息，请稍后重试。', 'danger');
    renderOverview();
    renderNotices();
  }
};

loadHome();
