/* 公共脚本：JSON 加载、状态提示与小工具
   各页面先引入本文件，再引入自己的页面脚本（js/home.js、js/rooms.js 等）。 */

const Campus = {
  /* 统一的 JSON 加载：网络失败、HTTP 错误、JSON 解析失败都会抛出可读的错误信息 */
  async fetchJSON(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + '（' + path + '）');
    }
    return response.json();
  },

  /* 状态提示：加载中 / 空数据 / 加载失败共用一处，读屏软件也会播报 */
  setStatus(element, message, type = 'warning') {
    if (!element) return;
    element.textContent = message;
    element.className = 'alert alert-' + type;
    element.hidden = false;
  },

  clearStatus(element) {
    if (!element) return;
    element.hidden = true;
    element.textContent = '';
  },

  /* 千分位数字，图表与卡片统一使用 */
  formatNumber(value) {
    return Number(value).toLocaleString('zh-CN');
  },

  /* 取本周周一（用于预约表单的默认日期与最小可选日期） */
  mondayOfThisWeek() {
    const today = new Date();
    const day = today.getDay() === 0 ? 7 : today.getDay();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day + 1);
    return monday.toISOString().slice(0, 10);
  },

  /* 把 ISO 日期（2026-10-06）显示成 2026年10月6日 */
  formatDate(iso) {
    const [year, month, day] = String(iso).split('-');
    if (!year || !month || !day) return iso;
    return year + '年' + Number(month) + '月' + Number(day) + '日';
  },

  /* 求和：图表的"累计"与卡片必须来自同一份数据，避免两处数字对不上 */
  sum(list) {
    return list.reduce((total, item) => total + Number(item), 0);
  }
};

/* 页面打开时把导航当前项高亮（HTML 里也写了 active，脚本再兜一层） */
document.addEventListener('DOMContentLoaded', () => {
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar .nav-link').forEach(link => {
    const target = link.getAttribute('href');
    const isCurrent = target === current;
    link.classList.toggle('active', isCurrent);
    if (isCurrent) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
});
