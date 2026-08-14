# kazusora.com

個人サイト。静的HTMLのみで動くので、サーバーは不要（GitHub Pages に置く前提）。

```
index.html          本体。文言はすべてここ
assets/css/style.css  見た目
assets/js/main.js     動き（GSAP + ScrollTrigger + Lenis）
CNAME               独自ドメインの宣言。GitHub Pages が読む
favicon.svg         タブのアイコン
```

## 手元で見る

```bash
python3 -m http.server 4321 --directory ~/Downloads/kazusora-site
```

http://localhost:4321 を開く。

## 動きの設計

参考にしたサイトと同じ組み合わせ。

| 要素 | 使っているもの | 効果 |
|---|---|---|
| 慣性スクロール | Lenis | ホイールを止めても少し滑る。質感の大半はこれ |
| スクロール連動 | ScrollTrigger `scrub: 1.1` | 背景や横スクロールがワンテンポ遅れて追従する |
| イージング | `expo.out` / `power4.out` | 勢いよく出て、すっと止まる |
| 文字の出方 | 1文字ずつ `yPercent: 115` から | 下から抜き上がる |

`prefers-reduced-motion: reduce`（OS側で視差効果を減らす設定）のときは、
すべてのアニメーションを止めて静的に表示する。

## 公開する（GitHub Pages）

1. GitHub で新規リポジトリを作る（**Public**。名前は `kazusora-site` などでよい）
2. このフォルダを push する
3. リポジトリの Settings → Pages → Source を `main` ブランチの `/ (root)` に設定
4. 同じ画面の Custom domain に `kazusora.com` を入れて Save
5. **Enforce HTTPS** にチェック（証明書の発行に数分〜1時間かかる。出るまで待つ）

## DNS

**注意：このドメインのネームサーバーは お名前.com 標準の DNS（`01.dnsv.jp`）ではなく、
お名前.com レンタルサーバー側（`ns-rs1.gmoserver.jp` / `ns-rs2.gmoserver.jp`）。**
したがってレコードは**レンタルサーバーのコントロールパネル**で編集する。
お名前.com の「DNSレコード設定」画面ではこのゾーンを操作できない。

ゾーンをこの状態にする。

| ホスト名 | TYPE | 値 | 用途 |
|---|---|---|---|
| （空欄 / @） | A | 185.199.108.153 | サイト |
| （空欄 / @） | A | 185.199.109.153 | サイト |
| （空欄 / @） | A | 185.199.110.153 | サイト |
| （空欄 / @） | A | 185.199.111.153 | サイト |
| www | CNAME | soratoki11703-hash.github.io | サイト |
| （空欄 / @） | MX | mail1022.onamae.ne.jp（優先度 10） | **メール・触らない** |
| （空欄 / @） | TXT | `v=spf1 include:_spf.onamae.ne.jp ~all` | **メール・触らない** |
| mail | A | 160.251.148.171 | **メール・触らない** |

削除するのは次の2つだけ（どちらもレンタルサーバーを指している）。

- `kazusora.com` A → `160.251.148.246`
- `www.kazusora.com` A → `160.251.148.246`

A レコードの4つは GitHub Pages の固定IP（実測で確認済み）。
反映まで最大1時間かかるので、表示されなくても設定を触らずに待つ。

ネームサーバーを お名前.com の DNS に切り替える方法もあるが、
その場合ゾーンが作り直しになり **MX・SPF・mail の3つを手で再登録しないとメールが止まる**。
避けたほうがよい。

## HTTPS

DNS が反映されたあと、GitHub が証明書を発行する（数分〜1時間）。
発行後に Enforce HTTPS を有効化する。

```bash
gh api -X PUT repos/soratoki11703-hash/kazusora-site/pages -F https_enforced=true
```

## 紹介写真

ABOUT セクションに出る。ファイルが無いあいだは枠ごと非表示になるので、
画像だけ壊れて見えることはない。

| ファイル | 用途 |
|---|---|
| `assets/img/portrait.jpg` | 1600px。PC・高精細ディスプレイ用 |
| `assets/img/portrait-800.jpg` | 800px。スマホ用（`srcset` で自動的に切り替わる） |

**元データは `~/Downloads/kazusora-portrait-original.jpg`**（8640×5760・11.5MB）。
公開フォルダの外に置いてある。差し替えるときは元データから作り直すこと。

```bash
python3 -c "
from PIL import Image
im=Image.open('$HOME/Downloads/kazusora-portrait-original.jpg').convert('RGB')
for w,name in [(1600,'portrait.jpg'),(800,'portrait-800.jpg')]:
    im.resize((w,round(im.height*w/im.width)), Image.LANCZOS).save(
        'assets/img/'+name,'JPEG',quality=74,optimize=True,progressive=True)
"
```

この書き出しは **EXIF（撮影情報）を引き継がない**。元データにはカメラ機種・撮影日時・
現像ソフト名が入っているため、公開用では落としている（GPS情報は元から無し）。
別の写真に差し替えるときも、必ず位置情報の有無を確認すること。

## 連絡先

Contact の Mail は `soratoki11703@gmail.com`（実際に受信できるアドレス）。

独自ドメインのメール（`hello@kazusora.com` など）に変えたくなったら、
**お名前.com レンタルサーバーのコントロールパネル**（https://cp.onamae.ne.jp/）で
メールアドレスを作れる。MX・SPF・DKIM は既に設定済みなので、
Zoho など外部サービスの契約は不要。

## 残っていること

- **迷惑メール対策**— メールアドレスを平文で置いているため、収集botに拾われる。
  気になったらリンクをJSで組み立てる、または問い合わせフォームに置き換える

## 本文の出どころ

ABOUT と WORKS の文章は、熱狂ラジオの運用実態をもとに書いた**下書き**。
事実と違うところは直接書き換えてよい。

Contact のリンク先は以下。表示言語を固定する `?hl=ja` `?lang=ja-JP` は
見る人の環境に合わせるべきなので外してある。

| | URL |
|---|---|
| YouTube | https://www.youtube.com/@nekkyoradio |
| Instagram | https://www.instagram.com/nekkyouradio/ |
| TikTok | https://www.tiktok.com/@nekkyou_radio |
