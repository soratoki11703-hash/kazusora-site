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
  scene.fog = new T.FogExp2(0x07121a, 0.011);

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

  /* ---- 文字で描く仕組み（動くものは全部これで描く） ----
     1つの点 = 1文字。点ごとに数字が入れ替わり続ける。
     文字表（16×16）の並び: 0〜9, A〜F, 記号。uCount=10 なら数字だけ、16 なら16進数まで */
  var GLYPH_CHARS = '0123456789ABCDEF:.+-=/<>#%*';
  var atlasCanvas = (function () {
    var S = 64, c = document.createElement('canvas'); c.width = c.height = S * 16;
    var g = c.getContext('2d');
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 50px ui-monospace, Menlo, Consolas, "Courier New", monospace';
    for (var i = 0; i < GLYPH_CHARS.length; i++) g.fillText(GLYPH_CHARS[i], (i % 16 + 0.5) * S, (Math.floor(i / 16) + 0.54) * S);
    return c;
  })();
  var atlas = new T.CanvasTexture(atlasCanvas);
  // 床用（マス目の境目に線が出ないよう、ミップマップなし）
  var atlasFlat = new T.CanvasTexture(atlasCanvas);
  atlasFlat.generateMipmaps = false; atlasFlat.minFilter = T.LinearFilter;

  var GU = { uTime: { value: 0 }, uScale: { value: 800 }, uFogD: { value: 0.011 } };
  var GLYPH_VS = [
    'attribute float aSeed; attribute float aBright; attribute vec3 aColor; attribute float aSize; attribute vec4 aData;',
    'uniform float uTime; uniform float uScale; uniform float uFogD; uniform float uSize; uniform float uRate; uniform float uCount; uniform float uOpacity;',
    'varying vec2 vCell; varying vec3 vCol;',
    'float h1(float x){ return fract(sin(x*12.9898)*43758.5453); }',
    'void main(){',
    '  vec3 p = position; float b = aBright; vec3 col = aColor; float rate = uRate; float sz = aSize;',
    '  /*CUSTOM*/',
    '  vec4 mv = modelViewMatrix * vec4(p,1.0);',
    '  float d = -mv.z;',
    '  b *= exp(-uFogD*uFogD*d*d) * uOpacity;',
    '  float gi = floor(h1(aSeed + floor(uTime*rate + aSeed)*0.137) * uCount);',
    '  vCell = vec2(mod(gi,16.0), floor(gi/16.0));',
    '  vCol = col * b;',
    '  gl_PointSize = (b < 0.004 || d <= 0.0) ? 0.0 : uSize * sz * uScale / d;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');
  var GLYPH_FS = [
    'uniform sampler2D uAtlas; varying vec2 vCell; varying vec3 vCol;',
    'void main(){',
    '  vec2 uv = vec2((vCell.x + gl_PointCoord.x)/16.0, 1.0 - (vCell.y + gl_PointCoord.y)/16.0);',
    '  float a = texture2D(uAtlas, uv).a;',
    '  if (a < 0.03) discard;',
    '  gl_FragColor = vec4(vCol * a, 1.0);',
    '}'
  ].join('\n');
  // n 文字ぶんの点をつくる。A.pos などを埋めてから done() を呼ぶ
  function glyphs(n, o) {
    o = o || {};
    var A = { pos: new Float32Array(n * 3), seed: new Float32Array(n), bright: new Float32Array(n), col: new Float32Array(n * 3), size: new Float32Array(n), data: new Float32Array(n * 4) };
    var c = new T.Color(o.color === undefined ? CYAN : o.color);
    for (var i = 0; i < n; i++) {
      A.seed[i] = Math.random() * 1000; A.bright[i] = 1; A.size[i] = 1;
      A.col[i * 3] = c.r; A.col[i * 3 + 1] = c.g; A.col[i * 3 + 2] = c.b;
    }
    var geo = new T.BufferGeometry();
    var at = {};
    [['position', A.pos, 3], ['aSeed', A.seed, 1], ['aBright', A.bright, 1], ['aColor', A.col, 3], ['aSize', A.size, 1], ['aData', A.data, 4]].forEach(function (d) {
      at[d[0]] = new T.BufferAttribute(d[1], d[2]); geo.setAttribute(d[0], at[d[0]]);
    });
    var mat = new T.ShaderMaterial({
      uniforms: { uTime: GU.uTime, uScale: GU.uScale, uFogD: GU.uFogD, uAtlas: { value: atlas }, uSize: { value: o.size || 0.3 }, uRate: { value: o.rate === undefined ? 2 : o.rate }, uCount: { value: o.count || 10 }, uOpacity: { value: 1 } },
      vertexShader: GLYPH_VS.replace('/*CUSTOM*/', o.custom || ''), fragmentShader: GLYPH_FS,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    var pts = new T.Points(geo, mat);
    return {
      points: pts, A: A, at: at, mat: mat, n: n,
      done: function (pad) {
        for (var k in at) at[k].needsUpdate = true;
        geo.computeBoundingSphere(); geo.boundingSphere.radius += (pad || 0);
        return pts;
      }
    };
  }
  function setRgb(arr, i, c) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  // 円周上に count 文字並べる（XY 平面）。aData.x に 0〜1 の角度
  function glyphRing(r, count, o) {
    var G = glyphs(count, o);
    for (var i = 0; i < count; i++) {
      var a = i / count * Math.PI * 2;
      G.A.pos[i * 3] = Math.cos(a) * r; G.A.pos[i * 3 + 1] = Math.sin(a) * r; G.A.data[i * 4] = i / count;
    }
    G.done();
    return G;
  }
  // 球の表面に count 文字（フィボナッチ球）
  function glyphSphere(r, count, o) {
    var G = glyphs(count, o), ga = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < count; i++) {
      var y = 1 - (i + 0.5) / count * 2, rr = Math.sqrt(1 - y * y), th = ga * i;
      G.A.pos[i * 3] = Math.cos(th) * rr * r; G.A.pos[i * 3 + 1] = y * r; G.A.pos[i * 3 + 2] = Math.sin(th) * rr * r;
      G.A.data[i * 4] = Math.atan2(Math.sin(th), Math.cos(th)); G.A.data[i * 4 + 1] = Math.asin(y);
    }
    G.done();
    return G;
  }

  /* ---- 遠景の空（Blender / Cycles でレンダリングした360°パノラマ） ----
     画像の中央が正面（three.js の -Z）。カメラと一緒に動かして「無限に遠い」ように見せる */
  var skyTex = loader.load('./assets/world/sky.jpg', function (tex) {
    // 同じ画像を建物の映り込み（環境マップ）にも使う
    try {
      var pm = new T.PMREMGenerator(renderer);
      tex.mapping = T.EquirectangularReflectionMapping;
      scene.environment = pm.fromEquirectangular(tex).texture;
      pm.dispose();
    } catch (e) { /* 映り込みが無くても表示はできる */ }
  });
  skyTex.encoding = T.sRGBEncoding;
  var sky = new T.Mesh(new T.SphereGeometry(800, 48, 24), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { uSky: { value: skyTex } },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'varying vec3 vD; uniform sampler2D uSky;',
      'void main(){',
      '  vec3 d = normalize(vD);',
      '  vec2 uv = vec2(atan(d.x, -d.z) / 6.28318 + 0.5, asin(clamp(d.y,-1.0,1.0)) / 3.14159 + 0.5);',
      '  vec3 c = texture2D(uSky, uv).rgb;',
      '  gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0);', // sRGB の画像を線形に戻す（出力側でまた sRGB にする）
      '}'
    ].join('\n')
  }));
  sky.renderOrder = -1;
  scene.add(sky);

  /* ---- 床（Blender で描いた回路パターン。光のパルスが奥へ走る） ---- */
  var circuit = loader.load('./assets/world/circuit.png');
  circuit.wrapS = circuit.wrapT = T.RepeatWrapping;
  circuit.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  var FOG_RGB = new T.Color(0x07121a);
  var POOLS = ZONE_Z.map(function (z, i) { return new T.Vector3(sideX(i), 0, z - 6); });
  var floorMat = new T.ShaderMaterial({
    transparent: false,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: camera.position },
      uPools: { value: POOLS },
      uCyan: { value: CYAN }, uHeat: { value: HEAT },
      uCircuit: { value: circuit },
      uAtlas: { value: atlasFlat },
      uFog: { value: FOG_RGB }
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: [
      'varying vec3 vW; uniform float uTime; uniform vec3 uCam; uniform vec3 uPools[6]; uniform vec3 uCyan; uniform vec3 uHeat; uniform sampler2D uCircuit; uniform sampler2D uAtlas; uniform vec3 uFog;',
      'float grid(vec2 p, float s, float w){ vec2 g = abs(fract(p/s - 0.5) - 0.5) / fwidth(p/s); return 1.0 - min(min(g.x,g.y)/w, 1.0); }',
      'float hh(vec2 v){ return fract(sin(dot(v, vec2(12.9898,78.233)))*43758.5453); }',
      // 床に敷きつめた数字（マスごとに入れ替わる）。奥が文字の上になる向き
      'float glyph(vec2 p, float cell, float rate){',
      '  vec2 g = p / cell; vec2 id = floor(g); vec2 f = fract(g);',
      '  float h = hh(id);',
      '  float gi = floor(hh(id + floor(uTime*rate*(0.4+h) + h*9.0)*0.731) * 10.0);',
      '  return texture2D(uAtlas, vec2((gi + f.x)/16.0, 1.0 - f.y/16.0)).a;',
      '}',
      'void main(){',
      '  vec2 p = vW.xz;',
      '  float d = length(vW - uCam);',
      '  float c = texture2D(uCircuit, p / 32.0).r;',
      '  float c2 = texture2D(uCircuit, p / 96.0 + 0.37).r;',
      '  float g2 = grid(p, 10.0, 1.2);',
      // 遠くは文字がつぶれてチラつくので、平均の明るさに置きかえる
      '  float gv = 1.0 - smoothstep(0.12, 0.35, length(fwidth(p / 0.8)));',
      '  float n1 = mix(0.16, glyph(p, 0.8, 1.2), gv);',
      '  float gvS = 1.0 - smoothstep(0.12, 0.35, length(fwidth(p / 0.4)));',
      '  float n2 = mix(0.16, glyph(p + 0.2, 0.4, 2.5), gvS);',
      // 奥へ流れる光のパルス（通ったところの数字が光る）
      '  float wave = pow(fract(-p.y / 48.0 - uTime * 0.35), 10.0);',
      '  float wave2 = pow(fract((p.x + p.y) / 70.0 + uTime * 0.18), 14.0);',
      '  vec3 col = vec3(0.006,0.01,0.016);',
      '  col += uCyan * c * 0.05;',
      '  col += uCyan * c2 * 0.025;',
      '  col += uCyan * g2 * 0.06;',
      '  col += uCyan * n1 * (0.035 + wave * 0.9 + wave2 * 0.4);',
      '  col += uCyan * n2 * c * (0.06 + wave * 0.8);',
      '  for(int i=0;i<6;i++){',
      '    float r = length(p - uPools[i].xz);',
      '    vec3 pc = (i==1 || i==2) ? uHeat : uCyan;',
      '    col += pc * exp(-r*r/70.0) * 0.08;',
      '    col += pc * n1 * exp(-r*r/180.0) * 0.45;',
      '    col += pc * n2 * exp(-r*r/60.0) * 0.4;',
      '  }',
      // 道の真ん中を手前へ流れてくる数字の列
      '  float lane = 1.0 - smoothstep(0.22, 0.3, abs(p.x));',
      '  float ln = glyph(vec2(p.x + 0.25, p.y + uTime * 6.0), 0.5, 0.0);',
      '  col += uCyan * lane * mix(0.25, ln * 1.3, gvS);',
      '  float fog = 1.0 - exp(-d*d*0.00018);',
      '  col = mix(col, uFog, clamp(fog,0.0,1.0));',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),
    extensions: { derivatives: true }
  });
  var floor = new T.Mesh(new T.PlaneGeometry(600, 900), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -200;
  scene.add(floor);

  /* ---- Blender でつくった街（データタワー・六角形のゲート・データの雨・ボクセル） ----
     元の場面は ~/kazusora.com/blender/build_world.py（素材の名前で役割を見分ける） */
  if (T.GLTFLoader) {
    new T.GLTFLoader(manager).load('./assets/world/world.glb', function (gltf) {
      gltf.scene.traverse(function (o) {
        if (!o.isMesh) return;
        var m = o.material, name = m.name || '';
        if (name === 'tower') {
          m.emissiveIntensity = 1.5;
          m.envMapIntensity = 1.2;
          // 斜めから見た窓がザラザラしないように
          if (m.emissiveMap) m.emissiveMap.anisotropy = circuit.anisotropy;
        } else if (name === 'dataRain') {
          o.visible = false; // データの雨は下の「数字の雨」で描く
        } else if (/^glow|^voxel$/.test(name)) {
          // 光るパーツは照明に左右されない単色にする（にじんで見えるよう少し明るめ）
          var k = name === 'voxel' ? 0.45 : 1.6;
          o.material = new T.MeshBasicMaterial({ color: m.emissive.clone().multiplyScalar(k) });
        }
      });
      scene.add(gltf.scene);
    });
  }

  scene.add(new T.HemisphereLight(0x6fbfff, 0x05070c, 0.5));

  /* ---- 漂う数字（空中のちり） ---- */
  var ND = mobile ? 700 : 1800;
  var DUST = glyphs(ND, { size: 0.17, count: 16, rate: 0.8, color: 0x9fdcff, custom: 'p.y = mod(p.y + uTime * aData.x, 30.0); b = 0.45;' });
  for (var k = 0; k < ND; k++) {
    DUST.A.pos[k * 3] = (Math.random() - 0.5) * 120;
    DUST.A.pos[k * 3 + 1] = Math.random() * 30;
    DUST.A.pos[k * 3 + 2] = 30 - Math.random() * 420;
    DUST.A.data[k * 4] = 0.15 + Math.random() * 0.6;
  }
  scene.add(DUST.done(30));

  /* ---- 数字の雨（街のあいだを落ちてくる縦の列） ---- */
  (function () {
    var COLS = mobile ? 150 : 360, STEP = 0.55, lens = [], total = 0;
    for (var c = 0; c < COLS; c++) { var L = 22 + Math.floor(Math.random() * 50); lens.push(L); total += L; }
    var G = glyphs(total, { size: 0.44, count: 16, rate: 1.2, custom: [
      'float L = aData.y;',
      'float head = mod(uTime * aData.z + aData.w, L + 30.0);',
      'float dist = head - (L - 1.0 - aData.x);', // 落ちてくる先頭からどれだけ上か
      'b = dist < 0.0 ? 0.0 : exp(-dist * 0.15);',
      'if (dist >= 0.0 && dist < 1.0) { col = vec3(0.9,1.0,1.0); b = 1.7; }',
      'rate = dist < 4.0 ? 16.0 : 1.2;',
      'b += 0.035;'
    ].join('\n') });
    var n = 0;
    for (c = 0; c < COLS; c++) {
      var side = Math.random() < 0.5 ? -1 : 1;
      var x = side * (15 + Math.pow(Math.random(), 1.3) * 48);
      var z = 25 - Math.random() * 440;
      var y0 = Math.random() < 0.3 ? Math.random() * 16 : 0;
      var speed = 8 + Math.random() * 16, ph = Math.random() * 100;
      var heat = Math.random() < 0.12;
      for (var k = 0; k < lens[c]; k++, n++) {
        G.A.pos[n * 3] = x; G.A.pos[n * 3 + 1] = y0 + k * STEP; G.A.pos[n * 3 + 2] = z;
        G.A.data[n * 4] = k; G.A.data[n * 4 + 1] = lens[c]; G.A.data[n * 4 + 2] = speed; G.A.data[n * 4 + 3] = ph;
        if (heat) setRgb(G.A.col, n, HEAT);
      }
    }
    scene.add(G.done());
  })();

  /* ---- ゾーンのあいだの六角形ゲートを、ぐるっと走る数字 ---- */
  (function () {
    var list = [];
    [[10.5, CYAN], [9.7, HEAT]].forEach(function (rc) {
      var R = rc[0], cz = R * Math.sin(Math.PI / 3) + 0.05, per = Math.round(R / 0.38);
      for (var gi = 0; gi < ZONE_Z.length - 1; gi++) {
        var gz = -(SPACING / 2 + gi * SPACING) + 0.4;
        for (var e = 0; e < 6; e++) for (var s = 0; s < per; s++) {
          var a0 = e * Math.PI / 3, a1 = (e + 1) * Math.PI / 3, u = s / per;
          list.push([R * ((1 - u) * Math.cos(a0) + u * Math.cos(a1)), cz + R * ((1 - u) * Math.sin(a0) + u * Math.sin(a1)), gz, (e + u) / 6, gi * 0.37, rc[1]]);
        }
      }
    });
    var G = glyphs(list.length, { size: 0.42, rate: 2.5, custom: 'b = 0.2 + 1.4 * pow(fract(aData.x * 2.0 - uTime * 0.22 + aData.y), 10.0);' });
    list.forEach(function (v, i) {
      G.A.pos[i * 3] = v[0]; G.A.pos[i * 3 + 1] = v[1]; G.A.pos[i * 3 + 2] = v[2];
      G.A.data[i * 4] = v[3]; G.A.data[i * 4 + 1] = v[4]; setRgb(G.A.col, i, v[5]);
    });
    scene.add(G.done());
  })();

  var updaters = [];
  var imgLoader = new T.ImageLoader(manager);
  // 画像を w×h のマスに縮めて、マスごとの色を返す
  function sampleImage(img, w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data;
  }

  /* ===== 00 入口：数字でできたコアと輪 ===== */
  (function () {
    var g = new T.Group(); g.position.set(0, 7.5, ZONE_Z[0] - 16);
    var shell = glyphSphere(2.3, mobile ? 420 : 700, { size: 0.27, rate: 3, custom: 'b = 0.3 + 1.0 * pow(0.5 + 0.5 * sin(aData.y * 6.0 - uTime * 2.0), 4.0);' });
    var inner = glyphSphere(1.2, 220, { size: 0.22, color: WHITE, count: 16, rate: 7, custom: 'b = 0.7;' });
    var chase = 'b = 0.3 + 1.2 * pow(fract(aData.x * 2.0 - uTime * 0.4), 6.0);';
    var ringA = glyphRing(4.2, 150, { size: 0.32, custom: chase });
    var ringB = glyphRing(5.4, 190, { size: 0.3, color: HEAT, custom: chase.replace('- uTime', '+ uTime') });
    var ringC = glyphRing(6.6, 280, { size: 0.22, color: WHITE, count: 2, rate: 4, custom: 'b = 0.4;' }); // 0 と 1 だけの輪
    g.add(shell.points, inner.points, ringA.points, ringB.points, ringC.points, glow(CYAN, 16, 0.3));
    var light = new T.PointLight(0x7cf7ff, 2.2, 60); g.add(light);
    scene.add(g);
    updaters.push(function (t) {
      shell.points.rotation.set(t * 0.2, t * 0.3, 0); inner.points.rotation.set(-t * 0.4, t * 0.2, 0);
      ringA.points.rotation.set(t * 0.5, t * 0.2, 0); ringB.points.rotation.set(Math.PI / 2 + Math.sin(t * 0.3) * 0.6, t * 0.35, 0);
      ringC.points.rotation.set(t * 0.1, Math.PI / 3, t * 0.15);
      g.position.y = 7.5 + Math.sin(t * 0.8) * 0.3;
    });
  })();

  /* ===== 01 ラジオ：アンテナから広がる数字の電波、数字を積んだレベルメーター ===== */
  (function () {
    var x = sideX(1), z = ZONE_Z[1] - 6;
    var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = -SIDE[1] * 0.35;
    var mast = new T.Mesh(new T.CylinderGeometry(0.05, 0.18, 12, 8), new T.MeshStandardMaterial({ color: 0x1a2230, metalness: 0.9, roughness: 0.3 }));
    mast.position.y = 6; g.add(mast);
    var tip = glow(HEAT, 3, 0.9); tip.position.y = 12.1; g.add(tip);
    var tipLight = new T.PointLight(0xff5a36, 2, 40); tipLight.position.y = 12; g.add(tipLight);
    var waves = [];
    for (var i = 0; i < 6; i++) {
      var w = glyphRing(1, 120, { size: 0.34, color: HEAT, rate: 4 });
      w.points.position.y = 12; g.add(w.points); waves.push(w);
    }
    var B = 28, H = 14, STEP = 0.42;
    var EQ = glyphs(B * H, { size: 0.38, rate: 6 });
    var eqCol = new T.Color(0x3fc4d8);
    for (var b = 0; b < B; b++) {
      var a = (b / (B - 1) - 0.5) * Math.PI * 0.9;
      for (var k = 0; k < H; k++) {
        var n = b * H + k;
        EQ.A.pos[n * 3] = Math.sin(a) * 7; EQ.A.pos[n * 3 + 1] = 0.3 + k * STEP; EQ.A.pos[n * 3 + 2] = Math.cos(a) * 3 + 2;
        setRgb(EQ.A.col, n, b % 7 === 0 ? HEAT : eqCol);
      }
    }
    g.add(EQ.done());
    scene.add(g);
    updaters.push(function (t) {
      waves.forEach(function (w, i) {
        var p = ((t * 0.35 + i / waves.length) % 1);
        var s = 0.5 + p * 10; w.points.scale.set(s, s, s); w.mat.uniforms.uOpacity.value = (1 - p) * 0.9;
      });
      for (var b = 0; b < B; b++) {
        var h = (0.4 + Math.abs(Math.sin(t * 2.3 + b * 0.7) * Math.cos(t * 1.1 + b * 0.31)) * 5.5) / STEP;
        for (var k = 0; k < H; k++) EQ.A.bright[b * H + k] = k < h - 1 ? 0.7 : (k < h ? 1.7 : 0.03);
      }
      EQ.at.aBright.needsUpdate = true;
      tip.material.opacity = 0.6 + Math.sin(t * 6) * 0.3;
    });
  })();

  /* ===== 02 ゲーム：照明塔と、数字でできたボール（通ったあとに数字が残る） ===== */
  (function () {
    var x = sideX(2), z = ZONE_Z[2] - 6;
    var g = new T.Group(); g.position.set(x, 0, z);
    var ball = glyphSphere(0.62, 150, { size: 0.2, color: 0xf4f1ea, rate: 8 });
    var red = new T.Color(0xff4a36);
    for (var i = 0; i < ball.n; i++) {
      var lon = ball.A.data[i * 4], lat = ball.A.data[i * 4 + 1];
      if (Math.abs(Math.abs(lat) - Math.abs(Math.sin(lon) * 0.75)) < 0.16) setRgb(ball.A.col, i, red);
    }
    ball.at.aColor.needsUpdate = true;
    ball.points.frustumCulled = false;
    g.add(ball.points);
    var TR = 80, trail = glyphs(TR, { size: 0.3, color: HEAT, rate: 10, count: 16 });
    trail.points.frustumCulled = false;
    for (i = 0; i < TR; i++) { trail.A.bright[i] = 0; }
    trail.done(); g.add(trail.points);
    // 内野のひし形（塁のあいだを数字が走る）
    var corners = [[0, 5], [5, 0], [0, -5], [-5, 0]], PER = 26;
    var dia = glyphs(4 * PER, { size: 0.32, color: WHITE, rate: 3, custom: 'b = 0.22 + 1.3 * pow(fract(aData.x - uTime * 0.45), 8.0);' });
    for (var e = 0; e < 4; e++) for (var s = 0; s < PER; s++) {
      var n = e * PER + s, u = s / PER, c0 = corners[e], c1 = corners[(e + 1) % 4];
      dia.A.pos[n * 3] = c0[0] + (c1[0] - c0[0]) * u; dia.A.pos[n * 3 + 1] = 0.18; dia.A.pos[n * 3 + 2] = c0[1] + (c1[1] - c0[1]) * u;
      dia.A.data[n * 4] = (e + u) / 4;
    }
    g.add(dia.done());
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
    var last = 0;
    updaters.push(function (t) {
      var p = (t * 0.28) % 1;
      ball.points.position.set(Math.sin(p * Math.PI * 2) * 2.5, 0.6 + Math.sin(p * Math.PI) * 11, 6 - p * 10);
      ball.points.rotation.set(t * 6, t * 4, 0);
      // 0.03秒ごとに、ボールのいた場所へ数字を1つ置いていく
      if (t - last > 0.03 || t < last) {
        last = t;
        var P = trail.A.pos, Bn = trail.A.bright;
        for (var k = TR - 1; k > 0; k--) { P[k * 3] = P[k * 3 - 3]; P[k * 3 + 1] = P[k * 3 - 2]; P[k * 3 + 2] = P[k * 3 - 1]; Bn[k] = Bn[k - 1] * 0.955; }
        var bp = ball.points.position;
        P[0] = bp.x + (Math.random() - 0.5) * 0.5; P[1] = bp.y + (Math.random() - 0.5) * 0.5; P[2] = bp.z + (Math.random() - 0.5) * 0.5;
        Bn[0] = p < 0.03 ? 0 : 1.2;
        trail.at.position.needsUpdate = true; trail.at.aBright.needsUpdate = true;
      }
    });
  })();

  /* ===== 03 アプリ：数字のモザイクでできたアイコン ===== */
  (function () {
    var x = sideX(3), z = ZONE_Z[3] - 8;
    var g = new T.Group(); g.position.set(x, 5.5, z);
    var files = ['battle-phase', 'sukatto-boxing', 'gong-ippatsu', 'fight-map', 'yomiyomi'];
    var GRID = mobile ? 24 : 32, SIZE = 2.6, CELL = SIZE / GRID, NB = 72;
    var tiles = files.map(function (f, i) {
      var tile = new T.Group();
      var G = glyphs(GRID * GRID + NB, { size: CELL * 1.45, rate: 1.2, custom: 'if (aData.z > 0.5) b *= 0.25 + 1.5 * pow(fract(aData.x - uTime * 0.35), 6.0);' });
      for (var cy = 0; cy < GRID; cy++) for (var cx = 0; cx < GRID; cx++) {
        var n = cy * GRID + cx;
        G.A.pos[n * 3] = -SIZE / 2 + (cx + 0.5) * CELL; G.A.pos[n * 3 + 1] = SIZE / 2 - (cy + 0.5) * CELL;
        G.A.bright[n] = 0;
      }
      // 外枠（角の丸い四角に沿って光が回る）
      for (var k = 0; k < NB; k++) {
        var m = GRID * GRID + k, th = k / NB * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
        G.A.pos[m * 3] = Math.sign(cs) * Math.pow(Math.abs(cs), 0.25) * 1.55; G.A.pos[m * 3 + 1] = Math.sign(sn) * Math.pow(Math.abs(sn), 0.25) * 1.55;
        G.A.data[m * 4] = k / NB; G.A.data[m * 4 + 2] = 1; G.A.size[m] = 0.8 / 1.45 * 0.18 / CELL;
      }
      tile.add(G.done(0.5));
      imgLoader.load('./assets/img/apps/' + f + '.jpg', function (img) {
        var d = sampleImage(img, GRID, GRID), rr = GRID * 0.225;
        for (var cy = 0; cy < GRID; cy++) for (var cx = 0; cx < GRID; cx++) {
          var n = cy * GRID + cx;
          // 角を丸く切る
          var qx = Math.max(0, Math.abs(cx + 0.5 - GRID / 2) - (GRID / 2 - rr)), qy = Math.max(0, Math.abs(cy + 0.5 - GRID / 2) - (GRID / 2 - rr));
          if (qx * qx + qy * qy > rr * rr) continue;
          var r = d[n * 4] / 255, gg = d[n * 4 + 1] / 255, bb = d[n * 4 + 2] / 255;
          G.A.col[n * 3] = r; G.A.col[n * 3 + 1] = gg; G.A.col[n * 3 + 2] = bb;
          G.A.bright[n] = 0.25 + 1.25 * Math.max(r, gg, bb);
        }
        G.at.aColor.needsUpdate = true; G.at.aBright.needsUpdate = true;
      });
      var a = (i - 2) * 0.55;
      tile.userData = { bx: Math.sin(a) * 5.2, bz: -Math.cos(a) * 3 + 3, by: (i % 2 ? 1.6 : -1.2), ph: i * 1.3 };
      g.add(tile);
      return tile;
    });
    g.add(glow(CYAN, 18, 0.14));
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

  /* ===== 04 プロフィール：写真を数字で描いたホログラム ===== */
  (function () {
    var x = sideX(4), z = ZONE_Z[4] - 8;
    var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = -SIDE[4] * 0.3;
    var PW = mobile ? 90 : 132, PH = Math.round(PW * 533 / 800), W = 9, Hh = W * PH / PW, CELL = W / PW;
    var P = glyphs(PW * PH, { size: CELL * 1.5, rate: 1.4, custom: [
      'float band = mod(uTime * 1.1, 9.0) - 4.5;',
      'float q = (p.y - band) * 2.2; b *= 0.7 + 1.4 * exp(-q * q);', // 上へ流れる走査線
      'float gl = step(0.985, fract(sin(floor(uTime * 12.0)) * 43758.5));',
      'p.x += gl * 0.15 * sin(p.y * 20.0);' // ときどき横にずれる
    ].join('\n') });
    for (var cy = 0; cy < PH; cy++) for (var cx = 0; cx < PW; cx++) {
      var n = cy * PW + cx;
      P.A.pos[n * 3] = -W / 2 + (cx + 0.5) * CELL; P.A.pos[n * 3 + 1] = Hh / 2 - (cy + 0.5) * CELL;
      P.A.bright[n] = 0;
    }
    var holo = P.done(1);
    holo.position.y = 6.2; g.add(holo);
    imgLoader.load('./assets/img/portrait-800.jpg', function (img) {
      var d = sampleImage(img, PW, PH);
      for (var cy = 0; cy < PH; cy++) for (var cx = 0; cx < PW; cx++) {
        var n = cy * PW + cx, r = d[n * 4] / 255, gg = d[n * 4 + 1] / 255, bb = d[n * 4 + 2] / 255;
        var l = 0.3 * r + 0.59 * gg + 0.11 * bb;
        var ex = Math.min(cx, PW - 1 - cx) / (PW * 0.04), ey = Math.min(cy, PH - 1 - cy) / (PH * 0.04);
        var edge = Math.min(1, ex) * Math.min(1, ey);
        P.A.col[n * 3] = 0.25 * 0.65 + r * 0.35; P.A.col[n * 3 + 1] = 0.85 * 0.65 + gg * 0.35; P.A.col[n * 3 + 2] = 1.0 * 0.65 + bb * 0.35;
        P.A.bright[n] = (0.06 + Math.pow(l, 1.1) * 2.6) * edge;
      }
      P.at.aColor.needsUpdate = true; P.at.aBright.needsUpdate = true;
    });
    var border = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(9.3, Hh + 0.3)), new T.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.6 }));
    border.position.copy(holo.position); g.add(border);
    // 足元の投影装置と光の柱
    var disc = new T.Mesh(new T.CylinderGeometry(2.2, 2.6, 0.3, 48), new T.MeshStandardMaterial({ color: 0x111826, metalness: 0.9, roughness: 0.3, emissive: CYAN, emissiveIntensity: 0.15 }));
    disc.position.y = 0.15; g.add(disc);
    var beam = new T.Mesh(new T.CylinderGeometry(4.6, 2.1, 3, 48, 1, true), new T.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.08, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    beam.position.y = 1.8; g.add(beam);
    var l = new T.PointLight(0x7cf7ff, 1.6, 30); l.position.set(0, 4, 3); g.add(l);
    scene.add(g);
    updaters.push(function (t) {
      holo.position.y = 6.2 + Math.sin(t * 0.9) * 0.15; border.position.y = holo.position.y;
    });
  })();

  /* ===== 05 連絡先：数字の渦でできた出口のゲート ===== */
  (function () {
    var z = ZONE_Z[5] - 18;
    // 連絡先の窓を囲むくらい大きく。遠くからは霧に溶けるよう uOpacity で薄くする
    var g = new T.Group(); g.position.set(0, 9, z);
    var ring = glyphRing(11, mobile ? 220 : 320, { size: 0.44, custom: 'b = 0.45 + 1.1 * pow(fract(aData.x * 4.0 - uTime * 0.3), 5.0);' });
    var ring2 = glyphRing(12, 280, { size: 0.3, color: HEAT, count: 2, rate: 3, custom: 'b = 0.7;' });
    var list = [];
    for (var r = 0.5; r < 10.7; r += 0.42) {
      var cnt = Math.max(6, Math.round(Math.PI * 2 * r / 0.42));
      for (var j = 0; j < cnt; j++) list.push([r, j / cnt * Math.PI * 2 + r * 0.3]);
    }
    var disk = glyphs(list.length, { size: 0.36, custom: [
      'float rn = aData.x; float a = aData.y;',
      'float sw = sin(a * 6.0 + rn * 14.0 - uTime * 2.5) * 0.5 + 0.5;',
      'float core = exp(-rn * rn * 3.0);',
      'col = mix(vec3(0.3,0.9,1.0), vec3(1.0,0.4,0.25), sw * 0.45);',
      'b = (sw * sw * 0.75 + core * 0.55) * smoothstep(1.0, 0.85, rn);',
      'rate = 1.0 + sw * 6.0;'
    ].join('\n') });
    list.forEach(function (v, i) {
      disk.A.pos[i * 3] = Math.cos(v[1]) * v[0]; disk.A.pos[i * 3 + 1] = Math.sin(v[1]) * v[0];
      disk.A.data[i * 4] = v[0] / 10.9; disk.A.data[i * 4 + 1] = Math.atan2(Math.sin(v[1]), Math.cos(v[1]));
    });
    disk.done();
    var halo = glow(CYAN, 44, 0.25);
    g.add(disk.points, ring.points, ring2.points, halo);
    var l = new T.PointLight(0x7cf7ff, 2.5, 60); l.position.z = 4; g.add(l);
    scene.add(g);
    updaters.push(function (t) {
      var d = camera.position.z - g.position.z;
      var fade = Math.min(1, Math.max(0, (150 - d) / 100));
      disk.mat.uniforms.uOpacity.value = ring.mat.uniforms.uOpacity.value = ring2.mat.uniforms.uOpacity.value = fade;
      halo.material.opacity = 0.25 * fade;
      ring.points.rotation.z = -t * 0.05;
      ring2.points.rotation.z = t * 0.2; ring2.points.rotation.x = Math.sin(t * 0.4) * 0.15;
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
    // 文字の大きさ（世界の長さ → 画面のピクセル）
    GU.uScale.value = window.innerHeight * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360));
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
    sky.position.copy(camera.position);
    GU.uTime.value = t;
    for (var i = 0; i < updaters.length; i++) updaters[i](t);

    renderer.render(scene, camera);
    updateHud(f, camZ);
    requestAnimationFrame(frame);
  }

  // 画像の読み込みが遅くても、空間ができたら幕は上げられる
  window.addEventListener('load', function () { measure(); setTimeout(finishBoot, 600); });
  requestAnimationFrame(frame);
})();
