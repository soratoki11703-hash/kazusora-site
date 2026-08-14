/* =========================================================
   燃焼トランジション（オープニング）
   赤い幕が焦げて燃え抜け、その先にサイト本体が現れる。

   仕組み：
     1. 幕の絵（赤地＋ロゴ）を実寸のキャンバスに1枚描いておく
     2. ノイズを1枚作り、しきい値を上げていく
     3. しきい値を大きく超えた画素は destination-out でくり抜く（＝燃え抜け）
     4. 境目には炭と熾火を上から重ねる
   文字も幕の絵に含めてあるので、ロゴごと焦げて落ちる。
   ========================================================= */
window.KZBurn = (function () {
  'use strict';

  var canvas, ctx;              // 画面に出る実寸のキャンバス
  var curtain;                  // 幕の絵（実寸・使い回す）
  var maskC, maskCtx, maskData; // くり抜く形（粗い）
  var edgeC, edgeCtx, edgeData; // 炭と熾火（粗い）
  var noise, W = 0, H = 0;
  var built = false, visible = false;
  var look = null;              // 幕の見た目（DOMから写し取る）

  /* --- 乱数の格子をなめらかに補間して雲状のノイズを作る --- */
  function grid(gw, gh) {
    var a = new Float32Array(gw * gh);
    for (var i = 0; i < a.length; i++) a[i] = Math.random();
    return a;
  }
  function sample(g, gw, gh, u, v) {
    var x = u * (gw - 1), y = v * (gh - 1);
    var x0 = Math.floor(x), y0 = Math.floor(y);
    var x1 = Math.min(x0 + 1, gw - 1), y1 = Math.min(y0 + 1, gh - 1);
    var fx = x - x0, fy = y - y0;
    fx = fx * fx * (3 - 2 * fx);           // なめらかに（エルミート補間）
    fy = fy * fy * (3 - 2 * fy);
    var a = g[y0 * gw + x0], b = g[y0 * gw + x1];
    var c = g[y1 * gw + x0], d = g[y1 * gw + x1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }

  function makeNoise() {
    var g1 = grid(9, 6), g2 = grid(21, 13), g3 = grid(41, 25);
    var arr = new Float32Array(W * H);
    var ix = W * 0.72, iy = H * 0.44;      // 発火点
    var mx = Math.max(ix, W - ix), my = Math.max(iy, H - iy);
    var maxd = Math.sqrt(mx * mx + my * my);
    var min = Infinity, max = -Infinity, i = 0;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var u = x / (W - 1), v = y / (H - 1);
        var n = 0.55 * sample(g1, 9, 6, u, v)
              + 0.30 * sample(g2, 21, 13, u, v)
              + 0.15 * sample(g3, 41, 25, u, v);
        var dx = x - ix, dy = y - iy;
        var d = Math.sqrt(dx * dx + dy * dy) / maxd;
        // 距離の比重を上げすぎると真円になり、面積が二乗で増えて
        // 進み方が偏る。ノイズ側を多めにして所々から燃えるようにする
        var val = 0.58 * n + 0.42 * d;
        arr[i++] = val;
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
    var span = (max - min) || 1;
    for (i = 0; i < arr.length; i++) arr[i] = (arr[i] - min) / span;
    return arr;
  }

  /* --- 幕の絵を実寸で焼き込む。文字はDOMの幕から見た目を写し取る --- */
  function drawCurtain() {
    var g = curtain.getContext('2d');
    g.clearRect(0, 0, curtain.width, curtain.height);
    g.fillStyle = (look && look.bg) || '#d62b21';
    g.fillRect(0, 0, curtain.width, curtain.height);
    if (look && look.text) {
      g.fillStyle = look.color;
      g.font = look.font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if ('letterSpacing' in g) g.letterSpacing = look.letterSpacing;
      g.fillText(look.text, curtain.width / 2, curtain.height / 2);
    }
  }

  function resize() {
    var vw = window.innerWidth, vh = window.innerHeight;
    if (!vw || !vh) return;
    canvas.width = vw; canvas.height = vh;
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    curtain.width = vw; curtain.height = vh;

    // 粗い解像度で計算し、拡大時のにじみを炎の揺らぎとして使う
    W = 320;
    H = Math.max(80, Math.round(W * vh / vw));
    maskC.width = edgeC.width = W;
    maskC.height = edgeC.height = H;
    maskData = maskCtx.createImageData(W, H);
    edgeData = edgeCtx.createImageData(W, H);
    noise = makeNoise();
    drawCurtain();
  }

  function build() {
    canvas = document.createElement('canvas');
    canvas.className = 'cBurn';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    curtain = document.createElement('canvas');
    maskC = document.createElement('canvas');
    edgeC = document.createElement('canvas');
    maskCtx = maskC.getContext('2d');
    edgeCtx = edgeC.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    built = true;
  }

  function render(p) {
    if (!built || !noise) return;
    // 燃え広がる面積は序盤ほどゆっくり増えるので、進行度を持ち上げて均す
    p = Math.pow(Math.max(0, Math.min(1, p)), 0.78);
    var t = p * 1.24 - 0.04;   // 端まで燃え切るよう 1 を少し超えるまで動かす

    var m = maskData.data, e = edgeData.data;
    for (var i = 0, j = 0; i < noise.length; i++, j += 4) {
      var k = t - noise[i];
      if (k > 0.11) {                     // 燃え抜けた
        m[j + 3] = 255; e[j + 3] = 0;
      } else if (k > 0.09) {              // 抜ける直前。縁をやわらげる
        m[j + 3] = ((k - 0.09) / 0.02 * 255) | 0;
        e[j] = 46; e[j + 1] = 28; e[j + 2] = 20; e[j + 3] = 255;
      } else if (k > 0.048) {             // 炭
        m[j + 3] = 0;
        e[j] = 46; e[j + 1] = 28; e[j + 2] = 20; e[j + 3] = 255;
      } else if (k > 0.008) {             // 熾火。内側ほど白熱する
        m[j + 3] = 0;
        var u = (k - 0.008) / 0.04;
        e[j] = 255;
        e[j + 1] = (70 + 215 * (1 - u)) | 0;
        e[j + 2] = (10 + 90 * (1 - u)) | 0;
        e[j + 3] = 255;
      } else if (k > -0.035) {            // 焦げかけ
        m[j + 3] = 0;
        e[j] = 60; e[j + 1] = 30; e[j + 2] = 18;
        e[j + 3] = ((k + 0.035) / 0.043 * 190) | 0;
      } else {                            // まだ燃えていない
        m[j + 3] = 0; e[j + 3] = 0;
      }
    }
    maskCtx.putImageData(maskData, 0, 0);
    edgeCtx.putImageData(edgeData, 0, 0);

    var w = canvas.width, h = canvas.height;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(curtain, 0, 0);                 // 幕（文字は実寸のまま鮮明）
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(maskC, 0, 0, w, h);             // 燃え抜けた分をくり抜く
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(edgeC, 0, 0, w, h);             // 炭と熾火を重ねる
  }

  return {
    /* DOMの幕から色・書体を写し取ってから使う */
    prepare: function (curtainEl, markEl) {
      if (!built) build();
      if (curtainEl) {
        var cs = getComputedStyle(curtainEl);
        var ms = markEl ? getComputedStyle(markEl) : null;
        look = {
          bg: cs.backgroundColor,
          text: markEl ? markEl.textContent.trim() : '',
          color: ms ? ms.color : '#fff',
          font: ms ? (ms.fontWeight + ' ' + ms.fontSize + ' ' + ms.fontFamily) : '',
          letterSpacing: ms ? ms.letterSpacing : 'normal'
        };
        drawCurtain();
      }
    },
    show: function () {
      if (!built) build();
      if (!visible) { canvas.classList.add('is-active'); visible = true; }
    },
    hide: function () {
      if (built && visible) { canvas.classList.remove('is-active'); visible = false; }
    },
    render: render
  };
})();
