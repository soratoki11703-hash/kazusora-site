/* =========================================================
   KAZUSORA — virtual space
   スクロールに合わせてカメラが奥へ進み、各セクションの「展示物」の前で止まる。
   three.js（r128）は assets/js/vendor/three.min.js を自前で配信している。
   ========================================================= */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) document.documentElement.classList.add('reduce');

  var $ = function (id) { return document.getElementById(id); };
  var zones = Array.prototype.slice.call(document.querySelectorAll('.zone'));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.hud-nav a'));
  var boot = $('boot'), bootBar = $('bootBar'), bootLog = $('bootLog');

  $('year').textContent = new Date().getFullYear();

  /* ---------- 起動画面 ---------- */
  var bootDone = false;
  function setBoot(p, msg) {
    if (bootBar) bootBar.style.width = Math.round(p * 100) + '%';
    if (msg && bootLog) bootLog.textContent = msg;
  }
  function finishBoot() {
    if (bootDone) return;
    bootDone = true;
    setBoot(1, 'READY');
    setTimeout(function () { boot.classList.add('is-done'); }, reduce ? 0 : 350);
  }
  setTimeout(finishBoot, 3500); // 何があっても3.5秒で幕を上げる

  /* ---------- 窓が見えたらふわっと出す ---------- */
  var wins = document.querySelectorAll('.win');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    wins.forEach(function (w) { io.observe(w); });
  } else {
    wins.forEach(function (w) { w.classList.add('is-in'); });
  }

  /* ---------- 東京の時計 ---------- */
  var clock = $('hudClock');
  var fmt;
  try { fmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); } catch (e) { fmt = null; }
  function tick() { if (fmt) clock.textContent = fmt.format(new Date()); }
  tick(); setInterval(tick, 1000);

  /* ---------- タイトルのグリッチ ---------- */
  var title = document.querySelector('.hero__title_en');
  if (title && !reduce) {
    (function glitch() {
      title.classList.add('is-glitch');
      setTimeout(function () { title.classList.remove('is-glitch'); }, 90 + Math.random() * 120);
      setTimeout(glitch, 2200 + Math.random() * 3800);
    })();
  }

  /* ---------- スクロール位置 → どのゾーンにいるか（小数） ---------- */
  var anchors = [];
  function measure() {
    var vh = window.innerHeight;
    anchors = zones.map(function (z, i) {
      if (i === 0) return 0;
      var r = z.getBoundingClientRect();
      var top = r.top + window.scrollY;
      return Math.max(0, top + r.height / 2 - vh / 2);
    });
  }
  function zoneFloat() {
    var y = window.scrollY;
    if (y <= anchors[0]) return 0;
    for (var i = 0; i < anchors.length - 1; i++) {
      if (y < anchors[i + 1]) return i + (y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]);
    }
    return anchors.length - 1;
  }

  var hudSector = $('hudSector'), hudDepth = $('hudDepth'), hudRail = $('hudRail');
  var lastSector = -1;
  function updateHud(f, camZ) {
    var idx = Math.min(zones.length - 1, Math.round(f));
    if (idx !== lastSector) {
      lastSector = idx;
      hudSector.textContent = zones[idx].getAttribute('data-sector');
      var id = zones[idx].id;
      navLinks.forEach(function (a) { a.classList.toggle('is-current', a.getAttribute('href') === '#' + id); });
    }
    hudDepth.textContent = (Math.max(0, 14 - camZ)).toFixed(1).padStart(6, '0') + ' m';
    var max = document.documentElement.scrollHeight - window.innerHeight;
    hudRail.style.height = (max > 0 ? Math.min(1, window.scrollY / max) * 100 : 0) + '%';
  }

  /* ---------- three.js が使えないときはここまで（CSS の背景のまま） ---------- */
  var canvas = $('world');
  var renderer;
  try {
    if (!window.THREE) throw new Error('no three');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.style.display = 'none';
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', function () { updateHud(zoneFloat(), 14); }, { passive: true });
    updateHud(0, 14);
    finishBoot();
    return;
  }

  var T = THREE;
  var mobile = window.innerWidth < 900;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  var BG = 0x05070c;
  var CYAN = new T.Color(0x7cf7ff), HEAT = new T.Color(0xff5a36), WHITE = new T.Color(0xffffff);
  var scene = new T.Scene();
  scene.background = new T.Color(BG);
  scene.fog = new T.FogExp2(BG, 0.016);

  var camera = new T.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 3.2, 14);

  var SPACING = 70;
  var ZONE_Z = zones.map(function (_, i) { return -i * SPACING; });
  // 本文の窓と反対側に展示物を置く（窓が右なら展示物は左）
  var SIDE = zones.map(function (z) {
    if (z.classList.contains('zone--right')) return -1;
    if (z.classList.contains('zone--left')) return 1;
    return 0;
  });
  function sideX(i) { return SIDE[i] * (mobile ? 2.5 : 7.5); }

  var manager = new T.LoadingManager();
  manager.onProgress = function (_, loaded, total) { setBoot(0.3 + 0.7 * loaded / total, 'LOADING ASSETS ' + loaded + '/' + total); };
  manager.onLoad = finishBoot;
  manager.onError = function () { /* 画像が無くても空間は出す */ };
  var loader = new T.TextureLoader(manager);
  setBoot(0.2, 'BUILDING SPACE');

  /* ---- 共通：光のにじみ（ブルームの代わりに加算スプライト） ---- */
  var glowTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  })();
  function glow(color, size, opacity) {
    var s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: color, transparent: true, opacity: opacity || 0.6, blending: T.AdditiveBlending, depthWrite: false }));
    s.scale.set(size, size, 1);
    return s;
  }

  /* ---- 空（地平線が少し光るグラデーション） ---- */
  var sky = new T.Mesh(new T.SphereGeometry(600, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'varying vec3 vP; uniform float uTime;',
      'void main(){',
      '  float h = vP.y;',
      '  vec3 top = vec3(0.012,0.016,0.03);',
      '  vec3 hor = vec3(0.04,0.13,0.18);',
      '  vec3 heat = vec3(0.35,0.08,0.04);',
      '  float band = exp(-abs(h)*14.0);',
      '  vec3 col = mix(top, hor, band);',
      '  col += heat * exp(-abs(h-0.01)*60.0) * smoothstep(0.2,1.0,-vP.z) * 0.6;',
      '  gl_FragColor = vec4(col,1.0);',
      '}'
    ].join('\n')
  }));
  scene.add(sky);

  /* ---- 床（遠くへ消えていくグリッド＋展示物の下の光だまり） ---- */
  var POOLS = ZONE_Z.map(function (z, i) { return new T.Vector3(sideX(i), 0, z - 6); });
  var floorMat = new T.ShaderMaterial({
    transparent: false,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: camera.position },
      uPools: { value: POOLS },
      uCyan: { value: CYAN }, uHeat: { value: HEAT }
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: [
      'varying vec3 vW; uniform float uTime; uniform vec3 uCam; uniform vec3 uPools[6]; uniform vec3 uCyan; uniform vec3 uHeat;',
      'float grid(vec2 p, float s, float w){ vec2 g = abs(fract(p/s - 0.5) - 0.5) / fwidth(p/s); return 1.0 - min(min(g.x,g.y)/w, 1.0); }',
      'void main(){',
      '  vec2 p = vW.xz;',
      '  float d = length(vW - uCam);',
      '  float g1 = grid(p, 2.0, 1.0) * 0.35;',
      '  float g2 = grid(p, 10.0, 1.4) * 0.8;',
      '  float scan = smoothstep(0.0, 1.0, 1.0 - abs(fract((p.y + uTime*6.0)/60.0) - 0.5)*2.0);',
      '  scan = pow(scan, 24.0);',
      '  vec3 col = vec3(0.008,0.012,0.02);',
      '  col += uCyan * (g1 + g2) * 0.22;',
      '  col += uCyan * g2 * scan * 0.9;',
      '  for(int i=0;i<6;i++){',
      '    float r = length(p - uPools[i].xz);',
      '    vec3 pc = (i==1 || i==2) ? uHeat : uCyan;',
      '    col += pc * exp(-r*r/60.0) * 0.18;',
      '    col += pc * (g1+g2) * exp(-r*r/120.0) * 0.5;',
      '  }',
      '  float fog = 1.0 - exp(-d*d*0.00022);',
      '  col = mix(col, vec3(0.02,0.027,0.047), clamp(fog,0.0,1.0));',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),
    extensions: { derivatives: true }
  });
  var floor = new T.Mesh(new T.PlaneGeometry(600, 900), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -200;
  scene.add(floor);

  /* ---- 両脇に並ぶ黒いモノリス（データセンターのような街並み） ---- */
  var monoGeo = new T.BoxGeometry(1, 1, 1);
  var monoMat = new T.MeshStandardMaterial({ color: 0x0b1018, roughness: 0.35, metalness: 0.85 });
  var edgeGeo = new T.EdgesGeometry(monoGeo);
  var edgeMat = new T.LineBasicMaterial({ color: 0x3fa9c9, transparent: true, opacity: 0.35 });
  var rnd = (function () { var s = 7; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  var count = mobile ? 34 : 70;
  for (var m = 0; m < count; m++) {
    var side = m % 2 ? 1 : -1;
    var w = 2 + rnd() * 5, h = 6 + Math.pow(rnd(), 2) * 46, dz = 2 + rnd() * 6;
    var g = new T.Group();
    var body = new T.Mesh(monoGeo, monoMat); body.scale.set(w, h, dz);
    var edge = new T.LineSegments(edgeGeo, edgeMat); edge.scale.set(w, h, dz);
    g.add(body, edge);
    g.position.set(side * (22 + rnd() * 60), h / 2, 30 - rnd() * 430);
    scene.add(g);
    if (rnd() > 0.6) { // 窓のような細い光の筋
      var strip = new T.Mesh(new T.PlaneGeometry(w * 0.8, 0.12), new T.MeshBasicMaterial({ color: rnd() > 0.7 ? HEAT : CYAN, transparent: true, opacity: 0.7 }));
      strip.position.set(g.position.x, 2 + rnd() * (h - 3), g.position.z + dz / 2 + 0.01);
      scene.add(strip);
    }
  }

  scene.add(new T.HemisphereLight(0x6fbfff, 0x05070c, 0.5));

  /* ---- 漂う粒子 ---- */
  var N = mobile ? 900 : 2200;
  var pos = new Float32Array(N * 3);
  for (var k = 0; k < N; k++) {
    pos[k * 3] = (Math.random() - 0.5) * 120;
    pos[k * 3 + 1] = Math.random() * 30;
    pos[k * 3 + 2] = 30 - Math.random() * 420;
  }
  var dustGeo = new T.BufferGeometry(); dustGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
  var dust = new T.Points(dustGeo, new T.PointsMaterial({ color: 0x9fdcff, size: 0.09, map: glowTex, transparent: true, opacity: 0.7, depthWrite: false, blending: T.AdditiveBlending }));
  scene.add(dust);

  var updaters = [];

  /* ===== 00 入口：光るコアと輪 ===== */
  (function () {
    var g = new T.Group(); g.position.set(0, 7.5, ZONE_Z[0] - 16);
    var core = new T.Mesh(new T.IcosahedronGeometry(2.2, 1), new T.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: 0.85 }));
    var inner = new T.Mesh(new T.IcosahedronGeometry(1.3, 0), new T.MeshStandardMaterial({ color: 0x0a1a24, emissive: CYAN, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3, flatShading: true }));
    var ringA = new T.Mesh(new T.TorusGeometry(4.2, 0.03, 8, 160), new T.MeshBasicMaterial({ color: CYAN }));
    var ringB = new T.Mesh(new T.TorusGeometry(5.4, 0.02, 8, 160), new T.MeshBasicMaterial({ color: HEAT }));
    var ringC = new T.Mesh(new T.TorusGeometry(6.6, 0.012, 8, 200), new T.MeshBasicMaterial({ color: WHITE, transparent: true, opacity: 0.4 }));
    g.add(core, inner, ringA, ringB, ringC, glow(CYAN, 16, 0.35));
    var light = new T.PointLight(0x7cf7ff, 2.2, 60); g.add(light);
    scene.add(g);
    updaters.push(function (t) {
      core.rotation.set(t * 0.2, t * 0.3, 0); inner.rotation.set(-t * 0.4, t * 0.2, 0);
      ringA.rotation.set(t * 0.5, t * 0.2, 0); ringB.rotation.set(Math.PI / 2 + Math.sin(t * 0.3) * 0.6, t * 0.35, 0);
      ringC.rotation.set(t * 0.1, Math.PI / 3, t * 0.15);
      g.position.y = 7.5 + Math.sin(t * 0.8) * 0.3;
    });
  })();

  /* ===== 01 ラジオ：アンテナと広がる電波、イコライザー ===== */
  (function () {
    var x = sideX(1), z = ZONE_Z[1] - 6;
    var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = -SIDE[1] * 0.35;
    var mast = new T.Mesh(new T.CylinderGeometry(0.05, 0.18, 12, 8), new T.MeshStandardMaterial({ color: 0x1a2230, metalness: 0.9, roughness: 0.3 }));
    mast.position.y = 6; g.add(mast);
    var tip = glow(HEAT, 3, 0.9); tip.position.y = 12.1; g.add(tip);
    var tipLight = new T.PointLight(0xff5a36, 2, 40); tipLight.position.y = 12; g.add(tipLight);
    var waves = [];
    for (var i = 0; i < 6; i++) {
      var r = new T.Mesh(new T.RingGeometry(0.96, 1, 96), new T.MeshBasicMaterial({ color: HEAT, transparent: true, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }));
      r.position.y = 12; g.add(r); waves.push(r);
    }
    var bars = [], B = 28;
    for (var b = 0; b < B; b++) {
      var bar = new T.Mesh(new T.BoxGeometry(0.22, 1, 0.22), new T.MeshBasicMaterial({ color: b % 7 === 0 ? HEAT : 0x3fc4d8, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false }));
      var a = (b / (B - 1) - 0.5) * Math.PI * 0.9;
      bar.position.set(Math.sin(a) * 7, 0.5, Math.cos(a) * 3 + 2);
      g.add(bar); bars.push(bar);
    }
    scene.add(g);
    updaters.push(function (t) {
      waves.forEach(function (w, i) {
        var p = ((t * 0.35 + i / waves.length) % 1);
        var s = 0.5 + p * 10; w.scale.set(s, s, s); w.material.opacity = (1 - p) * 0.7;
      });
      bars.forEach(function (bar, i) {
        var h = 0.4 + Math.abs(Math.sin(t * 2.3 + i * 0.7) * Math.cos(t * 1.1 + i * 0.31)) * 5.5;
        bar.scale.y = h; bar.position.y = h / 2;
      });
      tip.material.opacity = 0.6 + Math.sin(t * 6) * 0.3;
    });
  })();

  /* ===== 02 ゲーム：照明塔と、打ち上がっては落ちるボール ===== */
  (function () {
    var x = sideX(2), z = ZONE_Z[2] - 6;
    var g = new T.Group(); g.position.set(x, 0, z);
    var ballTex = (function () {
      var c = document.createElement('canvas'); c.width = 512; c.height = 256;
      var ctx = c.getContext('2d'); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, 512, 256);
      ctx.strokeStyle = '#d23a2a'; ctx.lineWidth = 6;
      for (var s = 0; s < 2; s++) {
        ctx.beginPath();
        for (var u = 0; u <= 512; u += 4) { var v = 128 + Math.sin(u / 512 * Math.PI * 2 + s * Math.PI) * 70; u === 0 ? ctx.moveTo(u, v) : ctx.lineTo(u, v); }
        ctx.stroke();
      }
      return new T.CanvasTexture(c);
    })();
    ballTex.encoding = T.sRGBEncoding;
    var ball = new T.Mesh(new T.SphereGeometry(0.55, 32, 16), new T.MeshStandardMaterial({ map: ballTex, roughness: 0.6 }));
    var trail = glow(WHITE, 2.4, 0.35); ball.add(trail);
    g.add(ball);
    // 内野のひし形
    var dia = new T.LineLoop(new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0.02, 5), new T.Vector3(5, 0.02, 0), new T.Vector3(0, 0.02, -5), new T.Vector3(-5, 0.02, 0)]), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    g.add(dia);
    // 照明塔
    [-1, 1].forEach(function (s) {
      var tower = new T.Group(); tower.position.set(s * 8, 0, -6);
      var pole = new T.Mesh(new T.BoxGeometry(0.25, 16, 0.25), new T.MeshStandardMaterial({ color: 0x1a2230, metalness: 0.8, roughness: 0.4 }));
      pole.position.y = 8; tower.add(pole);
      for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) {
        var lamp = new T.Mesh(new T.PlaneGeometry(0.5, 0.4), new T.MeshBasicMaterial({ color: 0xfff6dd }));
        lamp.position.set(-0.9 + c * 0.6, 15.6 + r * 0.5, 0.2); tower.add(lamp);
      }
      var gl = glow(new T.Color(0xfff2d0), 9, 0.55); gl.position.set(0, 16.1, 0.5); tower.add(gl);
      tower.lookAt(0, 0, 6); tower.rotation.x = 0;
      var spot = new T.PointLight(0xfff0d0, 1.6, 40); spot.position.set(0, 15, 2); tower.add(spot);
      g.add(tower);
    });
    scene.add(g);
    updaters.push(function (t) {
      var p = (t * 0.28) % 1;
      ball.position.set(Math.sin(p * Math.PI * 2) * 2.5, 0.6 + Math.sin(p * Math.PI) * 11, 6 - p * 10);
      ball.rotation.set(t * 6, t * 4, 0);
    });
  })();

  /* ===== 03 アプリ：浮かぶアイコンのタイル ===== */
  (function () {
    var x = sideX(3), z = ZONE_Z[3] - 8;
    var g = new T.Group(); g.position.set(x, 5.5, z);
    var roundMask = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 256;
      var ctx = c.getContext('2d'), r = 58;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 256); ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(r, 0); ctx.arcTo(256, 0, 256, 256, r); ctx.arcTo(256, 256, 0, 256, r); ctx.arcTo(0, 256, 0, 0, r); ctx.arcTo(0, 0, 256, 0, r); ctx.fill();
      return new T.CanvasTexture(c);
    })();
    var files = ['battle-phase', 'sukatto-boxing', 'gong-ippatsu', 'fight-map', 'yomiyomi'];
    var tiles = files.map(function (f, i) {
      var tex = loader.load('./assets/img/apps/' + f + '.jpg');
      tex.encoding = T.sRGBEncoding;
      var tile = new T.Group();
      var face = new T.Mesh(new T.PlaneGeometry(2.6, 2.6), new T.MeshBasicMaterial({ map: tex, alphaMap: roundMask, transparent: true }));
      var frame = new T.Mesh(new T.PlaneGeometry(2.9, 2.9), new T.MeshBasicMaterial({ color: CYAN, alphaMap: roundMask, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false }));
      frame.position.z = -0.05;
      tile.add(frame, face);
      var a = (i - 2) * 0.55;
      tile.userData = { bx: Math.sin(a) * 5.2, bz: -Math.cos(a) * 3 + 3, by: (i % 2 ? 1.6 : -1.2), ph: i * 1.3 };
      g.add(tile);
      return tile;
    });
    g.add(glow(CYAN, 18, 0.18));
    scene.add(g);
    updaters.push(function (t) {
      tiles.forEach(function (tile) {
        var u = tile.userData;
        tile.position.set(u.bx, u.by + Math.sin(t * 0.9 + u.ph) * 0.35, u.bz);
        tile.rotation.y = Math.sin(t * 0.5 + u.ph) * 0.25 - SIDE[3] * 0.25;
        tile.rotation.x = Math.sin(t * 0.7 + u.ph) * 0.08;
      });
    });
  })();

  /* ===== 04 プロフィール：写真のホログラム ===== */
  (function () {
    var x = sideX(4), z = ZONE_Z[4] - 8;
    var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = -SIDE[4] * 0.3;
    var tex = loader.load('./assets/img/portrait-800.jpg');
    var holoMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
      uniforms: { uTex: { value: tex }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'varying vec2 vUv; uniform sampler2D uTex; uniform float uTime;',
        'void main(){',
        '  vec2 uv = vUv;',
        '  float jitter = step(0.985, fract(sin(floor(uTime*12.0))*43758.5)) * 0.02;',
        '  uv.x += jitter * sin(uv.y*80.0);',
        '  vec3 c = texture2D(uTex, uv).rgb;',
        '  float l = dot(c, vec3(0.3,0.59,0.11));',
        '  vec3 holo = mix(vec3(0.25,0.85,1.0)*l*1.5, c, 0.35);',
        '  float scan = 0.75 + 0.25*sin(vUv.y*420.0 - uTime*8.0);',
        '  float band = smoothstep(0.0,0.02, abs(fract(vUv.y - uTime*0.15) - 0.5)) ;',
        '  float edge = smoothstep(0.0,0.04,vUv.x)*smoothstep(1.0,0.96,vUv.x)*smoothstep(0.0,0.04,vUv.y)*smoothstep(1.0,0.96,vUv.y);',
        '  float flick = 0.9 + 0.1*sin(uTime*40.0);',
        '  vec3 col = holo * scan * flick + vec3(0.3,0.9,1.0)*(1.0-band)*0.25;',
        '  gl_FragColor = vec4(col, edge*0.92);',
        '}'
      ].join('\n')
    });
    var holo = new T.Mesh(new T.PlaneGeometry(9, 6), holoMat);
    holo.position.y = 6.2; g.add(holo);
    var border = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(9.3, 6.3)), new T.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.6 }));
    border.position.copy(holo.position); g.add(border);
    // 足元の投影装置と光の柱
    var disc = new T.Mesh(new T.CylinderGeometry(2.2, 2.6, 0.3, 48), new T.MeshStandardMaterial({ color: 0x111826, metalness: 0.9, roughness: 0.3, emissive: CYAN, emissiveIntensity: 0.15 }));
    disc.position.y = 0.15; g.add(disc);
    var beam = new T.Mesh(new T.CylinderGeometry(4.6, 2.1, 3, 48, 1, true), new T.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.08, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    beam.position.y = 1.8; g.add(beam);
    var l = new T.PointLight(0x7cf7ff, 1.6, 30); l.position.set(0, 4, 3); g.add(l);
    scene.add(g);
    updaters.push(function (t) {
      holoMat.uniforms.uTime.value = t;
      holo.position.y = 6.2 + Math.sin(t * 0.9) * 0.15; border.position.y = holo.position.y;
    });
  })();

  /* ===== 05 連絡先：出口のゲート ===== */
  (function () {
    var z = ZONE_Z[5] - 18;
    // 連絡先の窓を囲むくらい大きく。遠くからは霧に溶けるよう uFade で薄くする
    var g = new T.Group(); g.position.set(0, 9, z);
    var ringMat = new T.MeshBasicMaterial({ color: CYAN, transparent: true });
    var ring2Mat = new T.MeshBasicMaterial({ color: HEAT, transparent: true });
    var ring = new T.Mesh(new T.TorusGeometry(11, 0.16, 16, 240), ringMat);
    var ring2 = new T.Mesh(new T.TorusGeometry(12, 0.04, 8, 240), ring2Mat);
    var portalMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uFade: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'varying vec2 vUv; uniform float uTime; uniform float uFade;',
        'void main(){',
        '  vec2 p = vUv - 0.5; float r = length(p)*2.0; float a = atan(p.y,p.x);',
        '  float sw = sin(a*6.0 + r*14.0 - uTime*2.5)*0.5+0.5;',
        '  float core = exp(-r*r*3.0);',
        '  vec3 col = mix(vec3(0.15,0.7,0.9), vec3(1.0,0.35,0.2), sw*0.4) * (sw*0.35 + core*0.9);',
        '  gl_FragColor = vec4(col, smoothstep(1.0,0.85,r) * 0.6 * uFade);',
        '}'
      ].join('\n')
    });
    var portal = new T.Mesh(new T.CircleGeometry(10.9, 128), portalMat);
    var halo = glow(CYAN, 44, 0.25);
    g.add(portal, ring, ring2, halo);
    var l = new T.PointLight(0x7cf7ff, 2.5, 60); l.position.z = 4; g.add(l);
    scene.add(g);
    updaters.push(function (t) {
      var d = camera.position.z - g.position.z;
      var fade = Math.min(1, Math.max(0, (150 - d) / 100));
      portalMat.uniforms.uFade.value = fade;
      ringMat.opacity = ring2Mat.opacity = fade; halo.material.opacity = 0.25 * fade;
      portalMat.uniforms.uTime.value = t;
      ring2.rotation.z = t * 0.2; ring2.rotation.x = Math.sin(t * 0.4) * 0.15;
    });
  })();

  /* ---------- 動き ---------- */
  var mouse = { x: 0, y: 0 }, mouseS = { x: 0, y: 0 };
  window.addEventListener('pointermove', function (e) {
    mouse.x = e.clientX / window.innerWidth - 0.5;
    mouse.y = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  var camZ = camera.position.z, camX = 0, f = 0;
  function targetCam(fl) {
    var i = Math.floor(fl), fr = fl - i;
    var zA = ZONE_Z[i] + 14, zB = ZONE_Z[Math.min(i + 1, ZONE_Z.length - 1)] + 14;
    // 展示物の前ではゆっくり、間は速く（イーズ）
    var e = fr < 0.5 ? 4 * fr * fr * fr : 1 - Math.pow(-2 * fr + 2, 3) / 2;
    return zA + (zB - zA) * e;
  }

  function onResize() {
    mobile = window.innerWidth < 900;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = window.innerWidth < 600 ? 70 : 58;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    measure();
  }
  window.addEventListener('resize', onResize);
  onResize();

  var clockT = new T.Clock(), t = 0, running = true;
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) { clockT.getDelta(); requestAnimationFrame(frame); }
  });

  function frame() {
    if (!running) return;
    var dt = Math.min(clockT.getDelta(), 0.05);
    if (!reduce) t += dt;

    f = zoneFloat();
    var tz = targetCam(f);
    var k = reduce ? 1 : 1 - Math.pow(0.0015, dt); // フレームレートに依らない追従
    camZ += (tz - camZ) * k;
    mouseS.x += (mouse.x - mouseS.x) * k; mouseS.y += (mouse.y - mouseS.y) * k;
    // 区間の真ん中で少し横に流れる（歩いているような揺れ）
    var drift = Math.sin((f % 1) * Math.PI) * 1.5 * (Math.floor(f) % 2 ? 1 : -1);
    camX += ((mouseS.x * 2.2 + drift) - camX) * k;
    camera.position.set(camX, 3.2 - mouseS.y * 1.2 + Math.sin(t * 0.7) * 0.08, camZ);
    camera.lookAt(camX * 0.4, 4.2 - mouseS.y * 0.8, camZ - 24);

    floorMat.uniforms.uTime.value = t;
    dust.rotation.y = Math.sin(t * 0.05) * 0.02;
    dust.position.y = Math.sin(t * 0.2) * 0.4;
    for (var i = 0; i < updaters.length; i++) updaters[i](t);

    renderer.render(scene, camera);
    updateHud(f, camZ);
    requestAnimationFrame(frame);
  }

  // 画像の読み込みが遅くても、空間ができたら幕は上げられる
  window.addEventListener('load', function () { measure(); setTimeout(finishBoot, 600); });
  requestAnimationFrame(frame);
})();
