/* =========================================================
   kazusora.com
   GSAP + ScrollTrigger + Lenis
   ========================================================= */
(function () {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------
     慣性スクロール（このサイトの質感の大半はここ）
     --------------------------------------------------- */
  var lenis = null;
  if (!reduced && typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------------------------------------------------
     文字を1文字ずつに割る
     --------------------------------------------------- */
  function splitChars(el) {
    var text = el.textContent;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      var outer = document.createElement('span');
      outer.className = 'u-char' + (c === ' ' ? ' u-char--space' : '');
      var inner = document.createElement('i');
      inner.textContent = c;
      outer.appendChild(inner);
      frag.appendChild(outer);
    }
    el.textContent = '';
    el.appendChild(frag);
    return el.querySelectorAll('.u-char > i');
  }

  var charTargets = new Map();
  document.querySelectorAll('.js-chars').forEach(function (el) {
    charTargets.set(el, splitChars(el));
  });

  /* ---------------------------------------------------
     幕を上げて、FV を立ち上げる
     --------------------------------------------------- */
  function intro() {
    var curtain = document.getElementById('curtain');
    var tl = gsap.timeline();

    if (reduced) {
      gsap.set(curtain, { display: 'none' });
      gsap.set('.js-lines, [data-from], .pWorks__item', { opacity: 1, clearProps: 'transform' });
      return;
    }

    var mark = curtain ? curtain.querySelector('.cCurtain__mark') : null;
    var burnOK = !!window.KZBurn;
    var burnObj = { p: 0 };
    var startText;   // 本文が立ち上がり始める時刻

    if (burnOK) {
      // 幕と同じ見た目をキャンバスに焼き、DOMの幕から引き継ぐ。
      // 両者は同じ色・同じ書体なので、入れ替わりは見えない
      KZBurn.prepare(curtain, mark);
      tl.call(function () {
        KZBurn.show();
        KZBurn.render(0);
        if (curtain) curtain.style.display = 'none';
      }, null, 0.30);

      tl.to(burnObj, {
        p: 1, duration: 2.1, ease: 'power1.inOut',
        onUpdate: function () { KZBurn.render(burnObj.p); },
        onComplete: function () { KZBurn.hide(); }
      }, 0.40);

      // 燃え広がっている途中から見せ始める。
      // 焦げた穴の向こうで本文が動いていると、奥に続いている感じが出る
      startText = 1.15;
    } else {
      tl.to(curtain, {
        opacity: 0, duration: .7, ease: 'power2.out',
        onComplete: function () { if (curtain) curtain.style.display = 'none'; }
      });
      startText = 0.35;
    }

    // アイブロウ → 大見出し → リード の順に、下から抜き上げる
    var eyebrow = document.querySelector('.pFv__eyebrow');
    var title = document.querySelector('.pFv__title_line');

    if (eyebrow) {
      tl.from(charTargets.get(eyebrow), {
        yPercent: 110, duration: .9, ease: 'expo.out', stagger: .012
      }, startText);
    }
    if (title) {
      tl.from(charTargets.get(title), {
        yPercent: 115, duration: 1.6, ease: 'expo.out', stagger: .05
      }, startText + 0.12);
    }
    tl.fromTo('.pFv__lead .js-lines',
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 1.2, ease: 'power4.out', stagger: .11 },
      startText + 0.5);
  }

  /* ---------------------------------------------------
     スクロールで出てくる要素
     --------------------------------------------------- */
  function reveals() {
    if (reduced) return;

    // 見出しの英字：1文字ずつ
    document.querySelectorAll('.cHeading__en.js-chars').forEach(function (el) {
      gsap.from(charTargets.get(el), {
        yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: .035,
        scrollTrigger: { trigger: el, start: 'top 88%' }
      });
    });

    // 本文・小見出し：ふわっと上げる
    document.querySelectorAll('.js-lines').forEach(function (el) {
      if (el.closest('.pFv')) return; // FV はイントロで処理済み
      gsap.fromTo(el,
        { opacity: 0, y: 30 },
        {
          opacity: 1, y: 0, duration: 1.2, ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 88%' }
        });
    });

    // 左右から差し込む要素
    document.querySelectorAll('[data-from]').forEach(function (el, i) {
      var dir = el.getAttribute('data-from');
      var from = { opacity: 0, y: 24, x: 0 };
      if (dir === 'left') { from.x = -44; from.y = 0; }
      if (dir === 'right') { from.x = 44; from.y = 0; }
      gsap.fromTo(el, from, {
        opacity: 1, x: 0, y: 0, duration: 1.25, ease: 'power4.out',
        scrollTrigger: { trigger: el, start: 'top 90%' }
      });
    });

    // 写真はひょこっと跳ねて出す（行き過ぎてから戻る back イージング）
    var photo = document.querySelector('.pAbout__photo');
    if (photo) {
      gsap.fromTo(photo,
        { opacity: 0, scale: .78, y: 90, rotate: -9 },
        {
          opacity: 1, scale: 1, y: 0, rotate: -1.5,   // CSS の傾きに着地させる
          duration: 1.25, ease: 'back.out(1.8)',
          scrollTrigger: { trigger: photo, start: 'top 85%' }
        });
      // 枠の中で写真だけ少し動かして奥行きを出す
      gsap.fromTo(photo.querySelector('img'),
        { yPercent: -4 }, { yPercent: 4, ease: 'none',
          scrollTrigger: { trigger: photo, start: 'top bottom', end: 'bottom top', scrub: 1.2 } });
    }

    // ネームプレートは写真より一拍遅れて飛び出す
    var plate = document.querySelector('.pAbout__photo_cap');
    if (plate) {
      gsap.from(plate, {
        opacity: 0, scale: .6, y: 40, duration: .9, ease: 'back.out(2.2)', delay: .35,
        scrollTrigger: { trigger: photo || plate, start: 'top 85%' }
      });
    }

    // 奥に遠ざかる。読み終えた面が小さく沈んでいく
    document.querySelectorAll('.pAbout__inner, .pNumbers__inner, .pContact__inner').forEach(function (el) {
      gsap.to(el, {
        scale: .9, opacity: .35, ease: 'none',
        scrollTrigger: {
          trigger: el, start: 'bottom 85%', end: 'bottom 15%', scrub: 1
        }
      });
    });

    // 数字はひとつずつ跳ねさせる
    gsap.fromTo('.pNumbers__item',
      { opacity: 0, scale: .7, y: 40 },
      {
        opacity: 1, scale: 1, y: 0, duration: 1, ease: 'back.out(2)', stagger: .12,
        scrollTrigger: { trigger: '.pNumbers', start: 'top 80%' }
      });

    // 背景の視差（scrub でスクロールに遅れて追従させる）
    document.querySelectorAll('[data-parallax]').forEach(function (el) {
      var amount = parseFloat(el.getAttribute('data-parallax')) || .15;
      gsap.to(el, {
        yPercent: amount * 100, ease: 'none',
        scrollTrigger: {
          trigger: el.parentNode,
          start: 'top top', end: 'bottom top', scrub: 1.2
        }
      });
    });
  }

  /* ---------------------------------------------------
     WORKS：画面を固定して横に流す
     --------------------------------------------------- */
  function works() {
    var section = document.querySelector('.pWorks');
    var track = document.getElementById('worksTrack');
    var bar = document.getElementById('worksProgress');
    if (!section || !track) return;

    var items = gsap.utils.toArray('.pWorks__item');
    var mm = gsap.matchMedia();

    // 横スクロール（PC）
    mm.add('(min-width: 900px)', function () {
      if (reduced) { gsap.set(items, { opacity: 1 }); return; }

      var getDistance = function () {
        return Math.max(0, track.scrollWidth - window.innerWidth + parseFloat(getComputedStyle(track).paddingLeft));
      };

      // カードが画面内に収まるなら固定せず、そのまま並べて見せる
      if (getDistance() < 220) {
        section.classList.add('is-static');
        gsap.fromTo(items,
          { opacity: 0, y: 40 },
          {
            opacity: 1, y: 0, duration: 1.1, ease: 'power4.out', stagger: .09,
            scrollTrigger: { trigger: section, start: 'top 65%' }
          });
        return;
      }

      var st = gsap.to(track, {
        x: function () { return -getDistance(); },
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          // 実際の移動量より長くスクロールさせて、ゆっくり流す
          end: function () { return '+=' + Math.max(getDistance() * 1.6, window.innerHeight); },
          pin: '.pWorks__sticky',
          anticipatePin: 1,
          scrub: 1.1,
          invalidateOnRefresh: true,
          onUpdate: function (self) {
            if (bar) bar.style.width = (self.progress * 100).toFixed(2) + '%';
          }
        }
      });

      // 焦げた先から、カードがひょこっと飛び出してくる
      gsap.fromTo(items,
        { opacity: 0, y: 90, scale: .82, rotate: -5 },
        {
          opacity: 1, y: 0, scale: 1, rotate: 0,
          duration: 1.1, ease: 'back.out(1.7)', stagger: .1,
          scrollTrigger: { trigger: section, start: 'top 30%' }
        });

      return function () { st.scrollTrigger && st.scrollTrigger.kill(); };
    });

    // 縦積み（スマホ・タブレット）
    mm.add('(max-width: 899px)', function () {
      if (reduced) { gsap.set(items, { opacity: 1 }); return; }
      items.forEach(function (item) {
        gsap.fromTo(item,
          { opacity: 0, y: 40 },
          {
            opacity: 1, y: 0, duration: 1.1, ease: 'power4.out',
            scrollTrigger: { trigger: item, start: 'top 88%' }
          });
      });
    });
  }

  /* ---------------------------------------------------
     数字のカウントアップ
     --------------------------------------------------- */
  function counters() {
    document.querySelectorAll('.js-count').forEach(function (el) {
      var to = parseFloat(el.getAttribute('data-to')) || 0;
      if (reduced) { el.textContent = to; return; }
      var obj = { v: 0 };
      gsap.to(obj, {
        v: to, duration: 1.8, ease: 'power4.out',
        scrollTrigger: { trigger: el, start: 'top 90%' },
        onUpdate: function () { el.textContent = Math.round(obj.v); }
      });
    });
  }

  /* ---------------------------------------------------
     ヘッダー：下へスクロール中は隠す
     --------------------------------------------------- */
  function header() {
    var el = document.getElementById('header');
    if (!el || reduced) return;
    ScrollTrigger.create({
      start: 'top -120',
      end: 99999,
      onUpdate: function (self) {
        el.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 200);
      }
    });
  }

  /* ---------------------------------------------------
     ヘッダー：赤ベタ・黒ベタの面に乗ったら白抜きにする
     --------------------------------------------------- */
  function headerTheme() {
    var el = document.getElementById('header');
    if (!el) return;
    var bars = document.querySelectorAll('.cMarquee');
    var over = [];
    document.querySelectorAll('.pWorks, .pContact, .lFooter').forEach(function (sec) {
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 46px',
        end: 'bottom 46px',
        onToggle: function (self) {
          var i = over.indexOf(sec);
          if (self.isActive && i === -1) over.push(sec);
          if (!self.isActive && i !== -1) over.splice(i, 1);
          el.classList.toggle('is-light', over.length > 0);
        }
      });
    });

    // 帯は画面の高さ全体にかかるので、面の切り替わりを別に判定する
    if (bars.length) {
      var overM = [];
      document.querySelectorAll('.pWorks, .pContact, .lFooter').forEach(function (sec) {
        ScrollTrigger.create({
          trigger: sec,
          start: 'top 50%',
          end: 'bottom 50%',
          onToggle: function (self) {
            var i = overM.indexOf(sec);
            if (self.isActive && i === -1) overM.push(sec);
            if (!self.isActive && i !== -1) overM.splice(i, 1);
            bars.forEach(function (b) { b.classList.toggle('is-light', overM.length > 0); });
          }
        });
      });
    }
  }

  /* ---------------------------------------------------
     右端の帯：1周分が画面の高さを超えないと継ぎ目が見えるので、
     足りなければ文字を継ぎ足す
     --------------------------------------------------- */
  function marqueeFill() {
    var bars = document.querySelectorAll('.cMarquee');
    if (!bars.length) return;
    var UNIT = 'KAZUSORA / ';

    function fill() {
      bars.forEach(function (m) {
        if (getComputedStyle(m).display === 'none') return;  // 非表示中は測れない
        var texts = m.querySelectorAll('.cMarquee__text');
        if (texts.length < 2) return;
        var one = texts[0];
        var guard = 0;
        while (one.getBoundingClientRect().height < window.innerHeight * 1.15 && guard < 80) {
          one.textContent += UNIT;
          guard++;
        }
        if (texts[1].textContent !== one.textContent) texts[1].textContent = one.textContent;
      });
    }

    fill();
    window.addEventListener('resize', fill);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fill);
  }

  /* ---------------------------------------------------
     ページ内リンク
     --------------------------------------------------- */
  function anchors() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id === '#' || id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
        else target.scrollIntoView();
      });
    });
  }

  /* --------------------------------------------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  reveals();
  works();
  counters();
  header();
  headerTheme();
  marqueeFill();
  anchors();

  // 画像やフォントの読み込みが詰まっても幕は必ず上げる
  var introDone = false;
  function startIntro() {
    if (introDone) return;
    introDone = true;
    intro();
    ScrollTrigger.refresh();
  }
  // 幕の文字はキャンバスに描き写すので、書体が届く前に始めると別の字体で焼かれる。
  // ただし待ちきりにはせず、遅い回線でも必ず幕が上がるようにする
  function whenFontsReady(fn) {
    if (!document.fonts || !document.fonts.ready) { fn(); return; }
    var called = false;
    var go = function () { if (!called) { called = true; fn(); } };
    document.fonts.ready.then(go);
    setTimeout(go, 1600);
  }
  if (document.readyState === 'complete') whenFontsReady(startIntro);
  else window.addEventListener('load', function () { whenFontsReady(startIntro); });
  setTimeout(startIntro, 3500);

  // Webフォントの読み込み完了で行送りが変わるため、位置を測り直す
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();
