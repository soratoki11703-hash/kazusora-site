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

## DNS（お名前.com）

「ドメイン」→ 対象ドメイン →「DNS」→「DNSレコード設定を利用する」から以下を登録。

| ホスト名 | TYPE | VALUE |
|---|---|---|
| （空欄） | A | 185.199.108.153 |
| （空欄） | A | 185.199.109.153 |
| （空欄） | A | 185.199.110.153 |
| （空欄） | A | 185.199.111.153 |
| www | CNAME | `<ユーザー名>.github.io` |

Aレコードの4つは GitHub Pages の固定IP。反映まで最大1時間ほどかかるので、
すぐ表示されなくても設定を触らずに待つこと。

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

## 残っていること

- **`hello@kazusora.com` の受信箱**— Zoho Mail の無料プランで作る。
  お名前.com に **MXレコード**（＋Zohoが指定する確認用レコード）を追加すると繋がる。
  Aレコード（サイト用）とは種類が違うので、両方を同時に設定しておける。
  正確なMXの値はZohoの設定画面が表示するものを使うこと（契約したデータセンターで変わる）
- **OGP画像**— SNSに貼ったときのサムネイル。`og:image` は未設定

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
