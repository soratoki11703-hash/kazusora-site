/* =========================================================
   カーソルの炎
   マウスの軌跡から火の粉が立ちのぼる
   ========================================================= */
(function () {
  'use strict';

  // タッチ端末にはカーソルが無いので動かさない。
  // OS側で「視差効果を減らす」設定の人にも出さない。
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduced) return;

  var canvas = document.createElement('canvas');
  canvas.className = 'cFire';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);
  // 非表示のまま読み込まれると幅が取れずキャンバスが 0×0 になるため、
  // 表示に戻った時点で測り直す
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) resize();
  });

  /* 火の粉の絵を先に作っておく。
     毎フレーム グラデーションを作ると重くなるため、3枚を使い回す。 */
  function makeSprite(r, g, b) {
    var s = 64;
    var c = document.createElement('canvas');
    c.width = c.height = s;
    var x = c.getContext('2d');
    var grd = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
    grd.addColorStop(.45, 'rgba(' + r + ',' + g + ',' + b + ',.45)');
    grd.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    x.fillStyle = grd;
    x.fillRect(0, 0, s, s);
    return c;
  }
  var SPARK = [
    makeSprite(255, 236, 160), // 芯：黄
    makeSprite(255, 138, 42),  // 中：橙
    makeSprite(214, 43, 33)    // 外：赤
  ];

  var MAX = 260;
  var parts = [];
  var mx = -9999, my = -9999;   // 実際のカーソル位置
  var px = mx, py = my;         // 少し遅れて追う発生源
  var seen = false;

  window.addEventListener('pointermove', function (e) {
    mx = e.clientX;
    my = e.clientY;
    if (!seen) { px = mx; py = my; seen = true; }
  }, { passive: true });

  // 画面外に出たら消す
  document.addEventListener('mouseleave', function () { seen = false; mx = my = -9999; });

  /* ---------------------------------------------------
     黒地の面をカーソルで照らす（火を灯して読む感じ）
     --------------------------------------------------- */
  var lights = [];
  document.querySelectorAll('.pContact, .lFooter').forEach(function (sec) {
    var el = document.createElement('div');
    el.className = 'cLight';
    el.setAttribute('aria-hidden', 'true');
    var core = document.createElement('i');
    core.className = 'cLight__core';
    el.appendChild(core);
    sec.appendChild(el);
    lights.push({ sec: sec, el: el, core: core, size: el.offsetWidth, on: false });
  });
  window.addEventListener('resize', function () {
    lights.forEach(function (L) { L.size = L.el.offsetWidth; });
  });

  /* ---------------------------------------------------
     カーソルが近づいた文字を浮かび上がらせる
     --------------------------------------------------- */
  var blooms = [];
  document.querySelectorAll('.pContact__icons a').forEach(function (el) {
    blooms.push({ el: el, v: 0 });
  });
  var BLOOM_R = 170;   // これだけ離れると完全に沈む（アイコンは小さいので近め）

  function updateBlooms() {
    for (var i = 0; i < blooms.length; i++) {
      var B = blooms[i];
      var target = 0;
      var r = B.el.getBoundingClientRect();
      // 画面内にあるものだけ計算する
      if (seen && r.bottom > 0 && r.top < window.innerHeight) {
        // 文字の矩形までの距離。矩形の内側なら 0
        var dx = px < r.left ? r.left - px : (px > r.right ? px - r.right : 0);
        var dy = py < r.top ? r.top - py : (py > r.bottom ? py - r.bottom : 0);
        var d = Math.sqrt(dx * dx + dy * dy);
        var t = Math.max(0, 1 - d / BLOOM_R);
        target = t * t * (3 - 2 * t);       // 端をなめらかにして、ふわっと立ち上げる
      }
      // 追従を遅らせるのが「ぽわん」の正体。即座に追うと素っ気なくなる
      B.v += (target - B.v) * 0.11;
      if (B.v < 0.002 && target === 0) B.v = 0;
      B.el.style.setProperty('--lit', B.v.toFixed(3));
    }
  }

  var tick = 0;
  function updateLights() {
    if (!lights.length) return;
    tick++;
    // 周期の違う波を重ねて、炎らしい不規則な揺らぎを作る。
    // 一定の明るさだと「絵を置いた」ようにしか見えない
    var f = 0.86
          + 0.070 * Math.sin(tick * 0.081)
          + 0.045 * Math.sin(tick * 0.213 + 1.7)
          + 0.025 * Math.sin(tick * 0.514 + 3.1);
    var scale = 0.97 + (f - 0.86) * 0.55;

    for (var i = 0; i < lights.length; i++) {
      var L = lights[i];
      if (!L.size) L.size = L.el.offsetWidth;
      var r = L.sec.getBoundingClientRect();
      var pad = L.size / 2;
      // 面の外側 半径分 まで反応させる。隣り合う黒い面がそれぞれ
      // 自分の担当ぶんを描くので、境目でも光が途切れずに繋がる
      var on = seen && py > r.top - pad && py < r.bottom + pad;
      if (on) {
        L.el.style.transform =
          'translate3d(' + (px - r.left - pad) + 'px,' + (py - r.top - pad) + 'px,0)';
        L.core.style.opacity = f.toFixed(3);
        L.core.style.transform = 'scale(' + scale.toFixed(3) + ')';
      }
      if (on !== L.on) { L.el.classList.toggle('is-on', on); L.on = on; }
    }
  }

  function spawn(x, y, n, speed) {
    for (var i = 0; i < n && parts.length < MAX; i++) {
      parts.push({
        x: x + (Math.random() - .5) * 12,
        y: y + (Math.random() - .5) * 12,
        vx: (Math.random() - .5) * .8,
        vy: -(.4 + Math.random() * 1.0) - speed * .04,
        life: 1,
        decay: .013 + Math.random() * .019,
        size: 12 + Math.random() * 18
      });
    }
  }

  function frame() {
    if (seen) {
      var dx = mx - px, dy = my - py;
      var dist = Math.sqrt(dx * dx + dy * dy);
      px += dx * .35;
      py += dy * .35;
      // 速く動かすほど多く出る。止めていても少し燻る
      spawn(px, py, Math.min(6, 1 + Math.round(dist * .25)), Math.min(dist, 20));
    }

    updateLights();
    updateBlooms();
    ctx.clearRect(0, 0, W, H);

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life -= p.decay;
      if (p.life <= 0) { parts.splice(i, 1); continue; }

      p.x += p.vx;
      p.y += p.vy;
      p.vy -= .035;   // 浮力で上に加速する
      p.vx *= .98;

      // 古い粒ほど大きく広がって薄くなる（煙のように散る）
      var s = p.size * (1.4 - p.life * .6);
      var sp = p.life > .66 ? SPARK[0] : (p.life > .33 ? SPARK[1] : SPARK[2]);

      ctx.globalAlpha = p.life * p.life * .85;
      ctx.drawImage(sp, p.x - s / 2, p.y - s / 2, s, s);
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
