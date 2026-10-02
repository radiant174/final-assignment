/* 自习室页：筛选、搜索、预约登记与本地存储
   本页用原生 DOM 写法（课堂五的思路：事件委托 + 数组 filter + createElement），
   与首页 js/home.js 的 jQuery 写法形成对照，两种写法的对比见 docs/jQuery改造说明.md。 */

const BOOKING_KEY = 'campus.bookings.v1';

const roomState = {
  data: null,          // rooms.json 的内容
  building: '全部',
  floor: '全部',
  status: '全部',
  socketOnly: false,
  keyword: '',
  bookings: []         // 本机预约记录
};

const els = {
  status: document.querySelector('#room-status'),
  buildingGroup: document.querySelector('#filter-building'),
  floorGroup: document.querySelector('#filter-floor'),
  statusGroup: document.querySelector('#filter-status'),
  socket: document.querySelector('#filter-socket'),
  search: document.querySelector('#search-input'),
  searchClear: document.querySelector('#search-clear'),
  summary: document.querySelector('#room-summary'),
  items: document.querySelector('#room-items'),
  form: document.querySelector('#booking-form'),
  bookingStatus: document.querySelector('#booking-status'),
  roomSelect: document.querySelector('#booking-room'),
  dateInput: document.querySelector('#booking-date'),
  bookingCount: document.querySelector('#booking-count'),
  bookingItems: document.querySelector('#booking-items'),
  clearBookings: document.querySelector('#clear-bookings')
};

const fields = [
  { key: 'name', input: '#booking-name', error: 'error-name' },
  { key: 'studentId', input: '#booking-student-id', error: 'error-studentId' },
  { key: 'room', input: '#booking-room', error: 'error-room' },
  { key: 'date', input: '#booking-date', error: 'error-date' },
  { key: 'slot', input: '#booking-slot', error: 'error-slot' },
  { key: 'people', input: '#booking-people', error: 'error-people' }
];

/* ---------- 本地存储：读写都做异常保护，本地存储被禁用时页面也不崩 ---------- */
const loadBookings = () => {
  try {
    const raw = localStorage.getItem(BOOKING_KEY);
    const parsed = raw === null ? [] : JSON.parse(raw);
    roomState.bookings = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    roomState.bookings = [];
    Campus.setStatus(els.bookingStatus, '无法读取本机预约记录（浏览器可能禁用了本地存储）：' + error.message, 'warning');
  }
};

const saveBookings = () => {
  try {
    localStorage.setItem(BOOKING_KEY, JSON.stringify(roomState.bookings));
    return true;
  } catch (error) {
    Campus.setStatus(els.bookingStatus, '预约无法保存到本机（本地存储不可用）：' + error.message, 'danger');
    return false;
  }
};

/* ---------- 筛选 ---------- */
const visibleRooms = () => {
  if (roomState.data === null) {
    return [];
  }
  const keyword = roomState.keyword.trim().toLowerCase();

  return roomState.data.rooms.filter(room =>
    (roomState.building === '全部' || room.building === roomState.building) &&
    (roomState.floor === '全部' || room.floor === roomState.floor) &&
    (roomState.status === '全部' || (roomState.status === '开放中') === room.open) &&
    (!roomState.socketOnly || room.hasSocket) &&
    (keyword === '' || (room.name + room.building + room.floor).toLowerCase().includes(keyword))
  );
};

const totalOf = (room) => Campus.sum(room.weekly);

/* ---------- 自习室列表 ---------- */
const renderList = () => {
  els.items.innerHTML = '';

  if (roomState.data === null) {
    els.summary.textContent = '—';
    els.items.appendChild(emptyItem('自习室数据未加载，请查看上方提示。'));
    return;
  }

  const rooms = visibleRooms();
  els.summary.textContent = '筛选后 ' + rooms.length + ' 间 / 共 ' + roomState.data.rooms.length + ' 间';

  if (rooms.length === 0) {
    els.items.appendChild(emptyItem('没有符合条件的自习室，请调整筛选条件或关键字。'));
    return;
  }

  rooms.forEach(room => {
    const item = document.createElement('div');
    item.className = 'list-group-item d-flex justify-content-between align-items-center gap-3 flex-wrap';

    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'fw-semibold';
    name.textContent = room.name;

    const meta = document.createElement('div');
    meta.className = 'text-muted small';
    meta.textContent = [
      room.building,
      room.floor,
      room.seats + ' 个座位',
      room.hasSocket ? '有插座' : '无插座',
      '累计 ' + Campus.formatNumber(totalOf(room)) + ' 人次'
    ].join(' · ');
    info.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'd-flex align-items-center gap-2';

    const badge = document.createElement('span');
    badge.className = room.open ? 'badge text-bg-success' : 'badge text-bg-secondary';
    badge.textContent = room.open ? '开放中' : '已关闭';
    actions.appendChild(badge);

    const bookButton = document.createElement('button');
    bookButton.type = 'button';
    bookButton.className = 'btn btn-sm ' + (room.open ? 'btn-outline-primary' : 'btn-outline-secondary');
    bookButton.dataset.roomId = room.id;
    bookButton.textContent = room.open ? '预约' : '不可预约';
    bookButton.disabled = !room.open;
    if (!room.open) {
      bookButton.title = '该自习室当前已关闭';
    }
    actions.appendChild(bookButton);

    item.append(info, actions);
    els.items.appendChild(item);
  });
};

const emptyItem = (text) => {
  const div = document.createElement('div');
  div.className = 'list-group-item text-muted';
  div.textContent = text;
  return div;
};

/* ---------- 预约记录 ---------- */
const renderBookings = () => {
  els.bookingItems.innerHTML = '';
  els.bookingCount.textContent = '共 ' + roomState.bookings.length + ' 条';

  if (roomState.bookings.length === 0) {
    els.bookingItems.appendChild(emptyItem('还没有预约记录，可在上方表单登记一条。'));
    return;
  }

  roomState.bookings
    .slice()
    .sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot))
    .forEach(booking => {
      const item = document.createElement('div');
      item.className = 'list-group-item d-flex justify-content-between align-items-center gap-3 flex-wrap';

      const info = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'fw-semibold';
      title.textContent = booking.roomName + ' · ' + Campus.formatDate(booking.date) + ' · ' + booking.slot;

      const meta = document.createElement('div');
      meta.className = 'text-muted small';
      meta.textContent = booking.name + '（学号 ' + booking.studentId + '） · ' + booking.people + ' 人';
      info.append(title, meta);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-sm btn-outline-danger';
      remove.dataset.bookingId = String(booking.id);
      remove.textContent = '删除';

      item.append(info, remove);
      els.bookingItems.appendChild(item);
    });
};

/* ---------- 表单校验 ---------- */
const readForm = () => ({
  name: document.querySelector('#booking-name').value,
  studentId: document.querySelector('#booking-student-id').value,
  room: els.roomSelect.value,
  date: els.dateInput.value,
  slot: document.querySelector('#booking-slot').value,
  people: document.querySelector('#booking-people').value
});

const validate = (values) => {
  const errors = {};
  const name = values.name.trim();
  const studentId = values.studentId.trim();
  const today = Campus.todayISO();

  if (name === '') {
    errors.name = '请填写姓名';
  } else if (name.length < 2 || name.length > 10) {
    errors.name = '姓名长度需在 2—10 个字符之间';
  }

  if (studentId === '') {
    errors.studentId = '请填写学号';
  } else if (!/^\d{8,12}$/.test(studentId)) {
    errors.studentId = '学号需为 8—12 位数字';
  }

  if (values.room === '') {
    errors.room = '请选择自习室';
  } else {
    const room = roomState.data.rooms.find(item => item.id === values.room);
    if (room === undefined) {
      errors.room = '所选自习室不存在';
    } else if (!room.open) {
      errors.room = '该自习室已关闭，不能预约';
    }
  }

  if (values.date === '') {
    errors.date = '请选择预约日期';
  } else if (values.date < today) {
    errors.date = '预约日期不能早于今天（' + today + '）';
  }

  if (values.slot === '') {
    errors.slot = '请选择时段';
  }

  const people = Number(values.people);
  if (!Number.isInteger(people) || people < 1 || people > 4) {
    errors.people = '人数需为 1—4 的整数';
  }

  const duplicated = roomState.bookings.some(booking =>
    booking.studentId === studentId && booking.roomId === values.room &&
    booking.date === values.date && booking.slot === values.slot
  );
  if (errors.studentId === undefined && duplicated) {
    errors.studentId = '同一学号在同一时段已预约过该自习室';
  }

  return errors;
};

const showErrors = (errors) => {
  fields.forEach(field => {
    const input = document.querySelector(field.input);
    const box = document.getElementById(field.error);
    const message = errors[field.key];
    input.classList.toggle('is-invalid', message !== undefined);
    box.textContent = message === undefined ? '' : message;
  });
};

/* ---------- 预约表单提交 ---------- */
els.form.addEventListener('submit', (event) => {
  event.preventDefault();

  if (roomState.data === null) {
    Campus.setStatus(els.bookingStatus, '自习室数据尚未加载，暂时无法预约。', 'warning');
    return;
  }

  const values = readForm();
  const errors = validate(values);
  showErrors(errors);

  const errorCount = Object.keys(errors).length;
  if (errorCount > 0) {
    Campus.setStatus(els.bookingStatus, '提交失败：有 ' + errorCount + ' 处需要修改，请查看表单中的红字提示。', 'danger');
    document.querySelector('.is-invalid').focus();
    return;
  }

  const room = roomState.data.rooms.find(item => item.id === values.room);
  const booking = {
    id: Date.now(),
    name: values.name.trim(),
    studentId: values.studentId.trim(),
    roomId: room.id,
    roomName: room.name,
    date: values.date,
    slot: values.slot,
    people: Number(values.people)
  };

  roomState.bookings.push(booking);
  if (!saveBookings()) {
    roomState.bookings.pop();
    return;
  }

  // 先重置表单（reset 事件会清掉提示），再显示成功信息，顺序反了成功提示会被清掉
  els.form.reset();
  els.dateInput.value = Campus.todayISO();

  Campus.setStatus(
    els.bookingStatus,
    '预约成功：' + booking.roomName + ' · ' + Campus.formatDate(booking.date) + ' · ' + booking.slot + ' · ' + booking.people + ' 人。',
    'success'
  );

  renderBookings();
});

/* ---------- 删除与清空 ---------- */
els.bookingItems.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-booking-id]');
  if (button === null) {
    return;
  }
  const id = Number(button.dataset.bookingId);
  roomState.bookings = roomState.bookings.filter(booking => booking.id !== id);
  saveBookings();
  renderBookings();
  Campus.setStatus(els.bookingStatus, '已删除 1 条预约记录。', 'warning');
});

els.clearBookings.addEventListener('click', () => {
  if (roomState.bookings.length === 0) {
    Campus.setStatus(els.bookingStatus, '当前没有可清空的预约记录。', 'warning');
    return;
  }
  if (!window.confirm('确定清空全部 ' + roomState.bookings.length + ' 条预约记录吗？此操作不可撤销。')) {
    return;
  }
  roomState.bookings = [];
  saveBookings();
  renderBookings();
  Campus.setStatus(els.bookingStatus, '已清空全部预约记录。', 'warning');
});

/* ---------- 列表里的“预约”按钮：把选中的自习室带进表单 ---------- */
els.items.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-room-id]');
  if (button === null || button.disabled) {
    return;
  }
  els.roomSelect.value = button.dataset.roomId;
  els.roomSelect.classList.remove('is-invalid');
  document.getElementById('error-room').textContent = '';
  document.querySelector('#booking').scrollIntoView({ block: 'start' });
  document.querySelector('#booking-name').focus();
});

/* ---------- 筛选与搜索的事件 ---------- */
const bindGroup = (group, key) => {
  group.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (button === null) {
      return;
    }
    roomState[key] = button.dataset.value;
    group.querySelectorAll('button[data-value]').forEach(item => {
      const isCurrent = item === button;
      item.classList.toggle('active', isCurrent);
      item.setAttribute('aria-pressed', String(isCurrent));
    });
    renderList();
  });
};

bindGroup(els.buildingGroup, 'building');
bindGroup(els.floorGroup, 'floor');
bindGroup(els.statusGroup, 'status');

els.socket.addEventListener('change', () => {
  roomState.socketOnly = els.socket.checked;
  renderList();
});

els.search.addEventListener('input', () => {
  roomState.keyword = els.search.value;
  renderList();
});

els.searchClear.addEventListener('click', () => {
  els.search.value = '';
  roomState.keyword = '';
  renderList();
  els.search.focus();
});

els.form.addEventListener('reset', () => {
  showErrors({});
  Campus.clearStatus(els.bookingStatus);
  window.setTimeout(() => { els.dateInput.value = Campus.todayISO(); }, 0);
});

/* ---------- 初始化 ---------- */
const initRooms = async () => {
  Campus.setStatus(els.status, '数据加载中…', 'warning');
  els.dateInput.min = Campus.todayISO();
  els.dateInput.value = Campus.todayISO();
  loadBookings();
  renderBookings();

  try {
    const data = await Campus.fetchJSON('data/rooms.json');

    if (!Array.isArray(data.rooms) || data.rooms.length === 0) {
      Campus.setStatus(els.status, '暂无数据：data/rooms.json 中没有自习室记录。', 'warning');
      roomState.data = data;
      renderList();
      return;
    }

    roomState.data = data;
    Campus.clearStatus(els.status);

    // 预约下拉框只放开放中的自习室，避免用户选到已关闭的房间
    data.rooms.filter(room => room.open).forEach(room => {
      const option = document.createElement('option');
      option.value = room.id;
      option.textContent = room.name + '（' + room.floor + '，' + room.seats + ' 座）';
      els.roomSelect.appendChild(option);
    });

    renderList();
  } catch (error) {
    Campus.setStatus(
      els.status,
      '数据加载失败：' + error.message + '。请确认 data/rooms.json 存在，并用本地服务器打开本页。',
      'danger'
    );
    renderList();
  }
};

initRooms();
