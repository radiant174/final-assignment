/* 校园三维导览：Three.js r128 + OrbitControls
   场景中的三栋楼与 data/rooms.json 里的楼栋名称一一对应：
   点击楼栋 → 信息面板显示该楼自习室的使用情况（间数、开放座位、累计人次），并可跳到统计页。
   支持 campus-3d.html#lib 这样的地址直接定位到某栋楼。 */

const BUILDINGS = [
  { id: 'lib', name: '图书馆', x: -16, z: -6, width: 16, height: 9, depth: 10, roof: 0xb71c1c },
  { id: 'b2', name: '二号教学楼', x: 2, z: -12, width: 12, height: 7, depth: 9, roof: 0x0b5ed7 },
  { id: 'b3', name: '三号教学楼', x: 20, z: -2, width: 12, height: 7, depth: 9, roof: 0x2e7d32 }
];

const stage = document.querySelector('#scene-stage');
const statusEl = document.querySelector('#scene-status');
const infoBox = document.querySelector('#building-info');
const nameEl = document.querySelector('#building-name');
const statsEl = document.querySelector('#building-stats');

const roomData = { data: null };

/* ---------- 场景、相机、渲染器 ---------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaee3f7);
scene.fog = new THREE.Fog(0xaee3f7, 60, 160);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(26, 17, 34);

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (error) {
  console.warn('WebGL 初始化失败：', error);
  Campus.setStatus(statusEl, '当前浏览器无法显示三维画面，请更换新版浏览器再试。', 'danger');
}

/* ---------- 小工具 ---------- */
const box = (width, height, depth, color, x, y, z) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 })
  );
  mesh.position.set(x, y, z);
  return mesh;
};

const cylinder = (top, bottom, height, color, x, y, z) => {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(top, bottom, height, 20),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 })
  );
  mesh.position.set(x, y, z);
  return mesh;
};

/* ---------- 教学楼：楼体 + 屋顶 + 窗户阵列 + 大门，整组挂一个 buildingId ---------- */
const buildBlock = (config) => {
  const group = new THREE.Group();
  group.userData.buildingId = config.id;
  group.userData.buildingName = config.name;

  group.add(box(config.width, config.height, config.depth, 0xefeeee, 0, config.height / 2, 0));
  group.add(box(config.width + 1, 0.6, config.depth + 1, config.roof, 0, config.height + 0.3, 0));
  group.add(box(2.4, 3.2, 0.4, 0x8d6e63, 0, 1.6, config.depth / 2 + 0.2));

  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x90caf9, roughness: 0.3, metalness: 0.2 });
  const columns = Math.floor(config.width / 2.6);
  const rows = Math.max(2, Math.floor(config.height / 2.6));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.2), windowMaterial);
      win.position.set(
        -config.width / 2 + 1.6 + col * 2.6,
        2.2 + row * 2.4,
        config.depth / 2 + 0.15
      );
      group.add(win);
    }
  }

  group.position.set(config.x, 0, config.z);
  group.traverse(child => { child.userData.buildingId = config.id; });
  return group;
};

let buildingGroups = [];
let selectionBox = null;

const decorations = { lamps: [], flag: null };

/* ---------- 搭场景 ---------- */
const buildScene = () => {
  // 地面与道路
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x7cb342, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 8),
    new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 1 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, 12);
  scene.add(road);

  // 三栋楼
  buildingGroups = BUILDINGS.map(config => {
    const group = buildBlock(config);
    scene.add(group);
    return group;
  });

  // 旗杆与旗帜（旗帜绕杆摆动）
  scene.add(cylinder(0.1, 0.12, 10, 0xcfd8dc, -2, 5, 6));
  scene.add(cylinder(0.6, 0.7, 0.4, 0xb0bec5, -2, 0.2, 6));
  const flagGeometry = new THREE.PlaneGeometry(3, 2);
  flagGeometry.translate(1.5, 0, 0);
  decorations.flag = new THREE.Mesh(
    flagGeometry,
    new THREE.MeshStandardMaterial({ color: 0xe53935, side: THREE.DoubleSide, roughness: 0.7 })
  );
  decorations.flag.position.set(-1.9, 8.4, 6);
  scene.add(decorations.flag);

  // 路灯：灯杆 + 发光灯头 + 点光源
  [[-26, 8], [0, 6], [24, 10]].forEach(([x, z]) => {
    scene.add(cylinder(0.14, 0.16, 6, 0x616161, x, 3, z));
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xfff59d, emissive: 0xfff59d, emissiveIntensity: 0.8 })
    );
    glow.position.set(x, 6.2, z);
    scene.add(glow);
    decorations.lamps.push(glow);

    const light = new THREE.PointLight(0xfff59d, 0.6, 26);
    light.position.set(x, 6.3, z);
    scene.add(light);
  });

  // 绿化树
  [[-28, 18], [-14, 22], [10, 20], [30, 16], [34, -8], [-32, -10], [12, -20]].forEach(([x, z], index) => {
    const scale = 0.85 + (index % 3) * 0.15;
    scene.add(cylinder(0.2, 0.26, 2.2, 0x8d6e63, x, 1.1 * scale, z));
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(1.7, 3.8, 18),
      new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.9 })
    );
    canopy.position.set(x, 3.8 * scale, z);
    scene.add(canopy);
  });

  // 光照
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.05);
  sun.position.set(30, 40, 26);
  scene.add(sun);
};

/* ---------- 楼栋信息面板 ---------- */
const showBuildingInfo = (buildingName) => {
  if (roomData.data === null) {
    nameEl.textContent = buildingName;
    statsEl.textContent = '自习室数据未加载，暂时无法显示使用情况。';
    infoBox.hidden = false;
    return;
  }

  const rooms = roomData.data.rooms.filter(room => room.building === buildingName);
  if (rooms.length === 0) {
    nameEl.textContent = buildingName;
    statsEl.textContent = '该楼暂未登记自习室。';
    infoBox.hidden = false;
    return;
  }

  const open = rooms.filter(room => room.open);
  const seats = Campus.sum(open.map(room => room.seats));
  const total = Campus.sum(rooms.map(room => Campus.sum(room.weekly)));
  const busiest = rooms.slice().sort((a, b) => Campus.sum(b.weekly) - Campus.sum(a.weekly))[0];

  nameEl.textContent = buildingName;
  statsEl.textContent =
    '自习室 ' + rooms.length + ' 间（开放 ' + open.length + ' 间）· 开放座位 ' + seats + ' 个 · ' +
    '累计 ' + Campus.formatNumber(total) + ' ' + roomData.data.unit +
    '；使用最多：' + busiest.name + '（' + Campus.formatNumber(Campus.sum(busiest.weekly)) + '）';
  infoBox.hidden = false;
};

const selectBuilding = (groupId) => {
  const group = buildingGroups.find(item => item.userData.buildingId === groupId);
  if (group === undefined) {
    return false;
  }

  if (selectionBox !== null) {
    scene.remove(selectionBox);
    selectionBox.geometry.dispose();
  }
  selectionBox = new THREE.BoxHelper(group, 0xffc107);
  scene.add(selectionBox);

  showBuildingInfo(group.userData.buildingName);
  return true;
};

/* ---------- 交互：点击楼栋 ---------- */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const onClick = (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(buildingGroups, true);

  if (hits.length === 0) {
    infoBox.hidden = true;
    if (selectionBox !== null) {
      scene.remove(selectionBox);
      selectionBox.geometry.dispose();
      selectionBox = null;
    }
    return;
  }

  let object = hits[0].object;
  while (object !== null && object.userData.buildingId === undefined) {
    object = object.parent;
  }
  if (object !== null) {
    selectBuilding(object.userData.buildingId);
  }
};

const onPointerMove = (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  renderer.domElement.style.cursor = raycaster.intersectObjects(buildingGroups, true).length > 0 ? 'pointer' : 'grab';
};

/* ---------- 渲染循环：页面隐藏时暂停，避免返回本页卡顿 ---------- */
const startRendering = () => {
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 4, -4);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 14;
  controls.maxDistance = 90;
  controls.maxPolarAngle = Math.PI * 0.49;

  let frameId = null;
  let elapsed = 0;

  const loop = () => {
    frameId = requestAnimationFrame(loop);
    elapsed += 1 / 60;

    decorations.flag.rotation.y = Math.sin(elapsed * 1.8) * 0.28;
    decorations.flag.rotation.z = Math.sin(elapsed * 2.6) * 0.05;
    const pulse = 0.7 + Math.sin(elapsed * 1.5) * 0.15;
    decorations.lamps.forEach(lamp => { lamp.material.emissiveIntensity = pulse; });

    controls.update();
    renderer.render(scene, camera);
  };

  const play = () => { if (frameId === null) loop(); };
  const pause = () => { if (frameId !== null) { cancelAnimationFrame(frameId); frameId = null; } };

  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
  window.addEventListener('beforeunload', pause);

  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', '校园三维场景：图书馆、二号教学楼与三号教学楼，可旋转、缩放并点击楼栋查看自习室使用情况');

  play();
};

/* ---------- 窗口自适应 ---------- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (renderer !== null) {
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
});

/* ---------- 初始化 ---------- */
const initScene = async () => {
  if (renderer === null) {
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  stage.appendChild(renderer.domElement);

  buildScene();
  startRendering();

  // 地址里带 #lib / #b2 / #b3 时直接定位到对应楼栋
  const hash = location.hash.replace('#', '');
  if (hash !== '') {
    selectBuilding(hash);
  }

  try {
    roomData.data = await Campus.fetchJSON('data/rooms.json');
    // 已经选过楼栋的话，用真实数据补一次面板
    if (selectionBox !== null) {
      const selected = buildingGroups.find(group => selectionBox.object === group);
      if (selected !== undefined) {
        showBuildingInfo(selected.userData.buildingName);
      }
    }
  } catch (error) {
    console.warn('三维页数据加载失败：', error);
    Campus.setStatus(statusEl, '暂时无法获取自习室数据：三维场景仍可浏览，但点击楼栋时看不到使用情况。', 'warning');
  }
};

initScene();
