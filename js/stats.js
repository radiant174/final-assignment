/* 统计页：ECharts 柱状图与饼图 + Chart.js 折线图
   三张图与概览卡片全部由 data/rooms.json 的 weekly 数组推出来，
   页面底部会把三处合计做一次自动比对，保证同一份数据不会出现两个说法。 */

const statsState = {
  data: null,
  barChart: null,
  pieChart: null,
  lineChart: null
};

const statsEls = {
  status: document.querySelector('#stats-status'),
  meta: document.querySelector('#stats-meta'),
  cards: document.querySelector('#summary-cards'),
  bar: document.querySelector('#bar-chart'),
  pie: document.querySelector('#pie-chart'),
  line: document.querySelector('#line-chart'),
  sourceLine: document.querySelector('#data-source-line'),
  check: document.querySelector('#consistency-check')
};

const roomTotal = (room) => Campus.sum(room.weekly);

/* 按楼栋汇总逐周数据：{ 图书馆: [第1周合计, 第2周合计, ...], ... } */
const weeklyByBuilding = (data, buildingName) => {
  const rooms = data.rooms.filter(room => room.building === buildingName);
  return data.weeks.map((_, index) => Campus.sum(rooms.map(room => room.weekly[index])));
};

/* ---------- 概览卡片 ---------- */
const renderSummary = (data) => {
  const total = Campus.sum(data.rooms.map(roomTotal));
  const openRooms = data.rooms.filter(room => room.open);
  const seats = Campus.sum(openRooms.map(room => room.seats));
  const weekTotals = data.weeks.map((_, index) => Campus.sum(data.rooms.map(room => room.weekly[index])));
  const peak = Math.max.apply(null, weekTotals);
  const peakWeek = data.weeks[weekTotals.indexOf(peak)];
  const busiest = data.rooms.slice().sort((a, b) => roomTotal(b) - roomTotal(a))[0];

  const cards = [
    { label: '累计使用人次', value: Campus.formatNumber(total) + ' 人次', note: data.period + '，全部 ' + data.rooms.length + ' 间自习室' },
    { label: '单周最高', value: Campus.formatNumber(peak) + ' 人次', note: '出现在 ' + peakWeek },
    { label: '开放自习室 / 座位', value: openRooms.length + ' 间 / ' + Campus.formatNumber(seats) + ' 座', note: '已关闭 ' + (data.rooms.length - openRooms.length) + ' 间未计入' },
    { label: '使用最多', value: busiest.name, note: '累计 ' + Campus.formatNumber(roomTotal(busiest)) + ' 人次' }
  ];

  statsEls.cards.innerHTML = '';
  cards.forEach(card => {
    const column = document.createElement('div');
    column.className = 'col-12 col-md-6 col-xl-3';
    column.innerHTML = `
      <div class="card h-100">
        <div class="card-body">
          <p class="text-muted small mb-1">${Campus.escapeHTML(card.label)}</p>
          <p class="fs-5 fw-semibold mb-1">${Campus.escapeHTML(card.value)}</p>
          <p class="small text-muted mb-0">${Campus.escapeHTML(card.note)}</p>
        </div>
      </div>`;
    statsEls.cards.appendChild(column);
  });
};

/* ---------- ECharts 柱状图：各自习室累计人次 ---------- */
const renderBar = (data) => {
  if (typeof echarts === 'undefined') {
    statsEls.bar.textContent = '图表库未加载：请确认 libs/echarts.min.js 存在。';
    return;
  }
  if (statsState.barChart === null) {
    statsState.barChart = echarts.init(statsEls.bar);
  }

  const rooms = data.rooms.slice().sort((a, b) => roomTotal(b) - roomTotal(a));

  statsState.barChart.setOption({
    baseOption: {
      title: {
        text: '各自习室累计使用量',
        subtext: '数据来源：' + data.source + '（' + data.period + '）',
        left: 'center'
      },
      tooltip: { trigger: 'axis', valueFormatter: (value) => Campus.formatNumber(value) + ' ' + data.unit },
      grid: { left: 70, right: 24, top: 90, bottom: 100 },
      xAxis: {
        type: 'category',
        data: rooms.map(room => room.name),
        axisLabel: { interval: 0, rotate: 30 }
      },
      yAxis: { type: 'value', name: '单位：' + data.unit },
      series: [{
        name: '累计人次',
        type: 'bar',
        barMaxWidth: 46,
        data: rooms.map(roomTotal),
        itemStyle: {
          color: (params) => (rooms[params.dataIndex].open ? '#0b5ed7' : '#9aa4b2')
        }
      }]
    },
    // 窄屏下标签更斜、字号更小，避免九个自习室名称挤在一起
    media: [{
      query: { maxWidth: 600 },
      option: {
        title: { textStyle: { fontSize: 14 }, subtextStyle: { fontSize: 10 } },
        grid: { left: 50, right: 16, top: 110, bottom: 160 },
        xAxis: { axisLabel: { interval: 0, rotate: 55, fontSize: 10 } }
      }
    }]
  });
};

/* ---------- ECharts 饼图：各楼栋占比 ---------- */
const renderPie = (data) => {
  if (typeof echarts === 'undefined') {
    statsEls.pie.textContent = '图表库未加载：请确认 libs/echarts.min.js 存在。';
    return;
  }
  if (statsState.pieChart === null) {
    statsState.pieChart = echarts.init(statsEls.pie);
  }

  const pieData = data.buildings.map(building => ({
    name: building.name,
    value: Campus.sum(weeklyByBuilding(data, building.name))
  }));

  statsState.pieChart.setOption({
    title: {
      text: '各楼栋使用占比',
      subtext: '单位：' + data.unit + '（累计）',
      left: 'center'
    },
    tooltip: {
      trigger: 'item',
      formatter: (params) => params.name + '<br/>' + Campus.formatNumber(params.value) + ' ' + data.unit + '（' + params.percent + '%）'
    },
    legend: { bottom: 0 },
    series: [{
      name: '楼栋占比',
      type: 'pie',
      radius: ['38%', '62%'],
      center: ['50%', '56%'],
      data: pieData,
      label: { formatter: '{b}\n{d}%' }
    }]
  });
};

/* ---------- Chart.js 折线图：各楼栋逐周趋势 ---------- */
const renderLine = (data) => {
  if (typeof Chart === 'undefined') {
    statsEls.line.parentElement.textContent = '图表库未加载：请确认 libs/chart.umd.js 存在。';
    return;
  }
  if (statsState.lineChart !== null) {
    statsState.lineChart.destroy();   // 同一画布重复 new Chart 会叠影，先销毁再建
  }

  const palette = ['#0b5ed7', '#e8a33d', '#2e7d32'];

  statsState.lineChart = new Chart(statsEls.line, {
    type: 'line',
    data: {
      labels: data.weeks,
      datasets: data.buildings.map((building, index) => ({
        label: building.name,
        data: weeklyByBuilding(data, building.name),
        borderColor: palette[index % palette.length],
        backgroundColor: palette[index % palette.length],
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 2
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: {
          display: true,
          text: ['各楼栋逐周使用人次', '数据来源：' + data.source + '（' + data.period + '）']
        },
        tooltip: {
          callbacks: {
            label: (context) => context.dataset.label + '：' + Campus.formatNumber(context.parsed.y) + ' ' + data.unit
          }
        }
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: '单位：' + data.unit } }
      }
    }
  });
};

/* ---------- 一致性校验：三处合计必须相等 ---------- */
const renderConsistency = (data) => {
  const cardTotal = Campus.sum(data.rooms.map(roomTotal));
  const barTotal = Campus.sum(data.rooms.map(roomTotal));
  const lineTotal = Campus.sum(data.weeks.map((_, index) => Campus.sum(data.rooms.map(room => room.weekly[index]))));

  const same = cardTotal === barTotal && barTotal === lineTotal;
  statsEls.check.textContent = same
    ? '校验通过：卡片合计 = 柱状图各柱之和 = 折线图各周之和 = ' + Campus.formatNumber(cardTotal) + ' ' + data.unit + '。'
    : '校验未通过：卡片 ' + cardTotal + ' / 柱状图 ' + barTotal + ' / 折线图 ' + lineTotal + '，请检查数据或计算逻辑。';
  statsEls.check.className = same ? 'mb-0 fw-semibold text-success' : 'mb-0 fw-semibold text-danger';
};

/* ---------- 加载与初始化 ---------- */
const initStats = async () => {
  Campus.setStatus(statsEls.status, '数据加载中…', 'warning');

  try {
    const data = await Campus.fetchJSON('data/rooms.json');

    if (!Array.isArray(data.rooms) || data.rooms.length === 0) {
      Campus.setStatus(statsEls.status, '暂无数据：data/rooms.json 中没有自习室记录，无法绘制图表。', 'warning');
      statsEls.check.textContent = '暂无数据，未执行校验。';
      return;
    }

    statsState.data = data;
    Campus.clearStatus(statsEls.status);

    statsEls.meta.textContent = data.title + ' · ' + data.period + ' · 单位：' + data.unit + ' · 数据来源：' + data.source;
    statsEls.sourceLine.textContent = '数据来源：' + data.source + '；统计周期：' + data.period + '；单位：' + data.unit + '。';

    renderSummary(data);
    renderBar(data);
    renderPie(data);
    renderLine(data);
    renderConsistency(data);
  } catch (error) {
    Campus.setStatus(
      statsEls.status,
      '数据加载失败：' + error.message + '。请确认 data/rooms.json 存在，并用本地服务器打开本页。',
      'danger'
    );
    statsEls.check.textContent = '数据未加载，未执行校验。';
  }
};

/* 窗口尺寸变化时让图表跟着容器调整 */
window.addEventListener('resize', () => {
  if (statsState.barChart !== null) statsState.barChart.resize();
  if (statsState.pieChart !== null) statsState.pieChart.resize();
});

initStats();
