# OrderApp 仕様書(引き継ぎ用)

学園祭(生駒祭)の飲食出店向け注文管理システム。複数の出店(=インスタンス)を1つのアプリで運用し、注文受付・厨房表示・履歴・売上統計・CSV出力を行う。

> このリポジトリは **Public** です。パスワード・APIキー・個人のメールアドレスなどの秘密情報は、コードにもこのドキュメントにも書かないこと(環境変数名のみ記載)。

最終更新: 2026-10-22

---

## 1. 概要

| 項目 | 内容 |
|---|---|
| 目的 | 出店ごとの注文受付〜提供完了を端末上で管理し、売上を集計・CSV出力する |
| 利用者 | 出店スタッフ(Googleアカウントで招待された人)/ 全体管理者(Admin) |
| 利用端末 | スマホ・タブレット中心(モバイル前提のUI)。ライトテーマ固定 |
| 言語・時刻 | UIは日本語。時刻表示・日別/時間別集計はすべて **JST(Asia/Tokyo)** |
| 本番 | Vercel(GitHub連携で `main` へ push すると自動デプロイ) |

## 2. 技術構成

| 区分 | 採用技術 |
|---|---|
| フレームワーク | Next.js 16(App Router / Turbopack)、React 19、TypeScript、Tailwind CSS v4 |
| 認証 | Auth.js(next-auth v5 beta)+ `@auth/prisma-adapter`、Google ログイン、**DBセッション** |
| DB | PostgreSQL(本番は Neon。Vercel Storage 連携) |
| ORM | Prisma 7(`prisma-client` ジェネレータ、出力先 `generated/prisma`、Driver Adapter `@prisma/adapter-pg`) |
| 画像保存 | Vercel Blob(**Public** ストア必須) |
| Node.js | **22.x**(`package.json` の `engines` と `.tool-versions` で固定。2026-10 のセキュリティリリース対応で 22.23.4 以上) |

> **注意**: AGENTS.md に記載のとおり、このNext.jsは一般的な知識と仕様が異なる箇所があります。実装前に `node_modules/next/dist/docs/` の該当ガイドを読むこと。

## 3. 用語

| 用語 | 意味 |
|---|---|
| インスタンス | 1つの出店(チーム)専用の空間。商品・注文・メンバー・編集履歴はインスタンスごとに独立 |
| Admin(全体管理者) | 全インスタンスを管理できるアカウント。`ADMIN_EMAIL`(常時管理者)+ `AdminInvite` テーブルで招待された人 |
| インスタンス管理者 | あるインスタンスの編集履歴を閲覧できるメンバー(`InstanceMember.isInstanceAdmin`) |
| メンバー | インスタンスに招待された Google アカウント(メールアドレスで照合) |

## 4. 権限モデル

| 操作 | 一般メンバー | インスタンス管理者 | Admin |
|---|:-:|:-:|:-:|
| 注文・厨房・履歴・商品・統計の利用(所属インスタンス内) | ○ | ○ | ○(所属していれば) |
| 編集履歴の閲覧 | × | ○(自インスタンスのみ) | ○(全インスタンス) |
| メンバー管理(`/members`: 自インスタンスへの招待、インスタンス管理者権限の付与・剥奪) | × | ○(自インスタンスのみ。稼働中のみ) | ○(全インスタンス) |
| `/admin`(インスタンス作成・削除・複製・停止、メンバー招待・権限変更、Admin招待) | × | × | ○ |

- インスタンス管理者の付与・剥奪・メンバー招待は、Admin が `/admin` から、またはそのインスタンスのインスタンス管理者が `/members` から行える。インスタンス管理者は **自分自身の権限は外せない**(ロックアウト防止)。
- メンバーの削除と表示名の変更は **Admin のみ**(インスタンス管理者は不可)。
- `ADMIN_EMAIL` のアカウントは `AdminInvite` の有無に関わらず常に Admin(最低1人は必ず管理者がいる状態を保つため)。
- **停止中(active=false)のインスタンスは、メンバーでも選択・操作できない**。
- 判定ロジックは `src/lib/instance.ts`(`isAdminEmail` / `isInstanceAdmin` / `getCurrentInstance` ほか)。API は各ルートで同ファイルの関数を呼んで認可している。

## 5. 画面仕様

| パス | 画面 | 対象 | 概要 |
|---|---|---|---|
| `/login` | ログイン | 全員 | 「Googleでログイン」ボタンのみ |
| `/` | 振り分け | - | 未ログイン→`/login`、インスタンス選択済み→`/order`、未選択→`/instances` |
| `/instances` | インスタンス選択 | ログイン済 | 招待されたインスタンスの一覧から選択。**「ログアウト」リンクあり**(未招待でもここから抜けられる)。選択はCookie(`current_instance_id`、30日、httpOnly)に保存。Adminには `/admin` へのリンク。「アカウント設定」リンクあり |
| `/account` | アカウント設定 | ログイン済 | Googleアイコン・メールアドレス(本人のもの)を表示し、**自分の表示名**(30文字以内)を設定する。**シフトの通知**欄で、この端末の通知オン/オフ・テスト通知・「30分前にも通知する」(既定オン)を設定する。空にするとGoogleアカウント名に戻る。インスタンスを選択していなくても開ける(`(protected)` の外)。ヘッダー右端のアイコンから遷移 |
| `/order` | 注文 | メンバー | 商品カード(画像+商品名、正方形)をタップで数量+1。グリッドはスマホ3列/幅640px以上4列/768px以上5列で、スクロール量を減らしている。カード上の ＋/− で増減。「客の特徴(任意)」「支払い方法(必須)」を入力して「注文を確定する」 |
| `/kitchen` | 厨房 | メンバー | 待機中の注文を古い順に表示。**2.5秒ごとにポーリング更新**(編集/完了/キャンセルのモーダル表示中は停止)。右上に待機中の件数を大きく表示(0件=グレー、1〜4件=黄、5件以上=赤。しきい値は `KitchenClient.tsx` の `WAITING_ALERT_COUNT`)。「作るべき個数」(商品名ごとの合計、円形アイコン付き)、チェックボックスで複数選択→「まとめて完了」、個別の「提供完了」「編集」「キャンセル」 |
| `/history` | 注文履歴 | メンバー | 全注文を新しい順に表示(状態バッジ: 待機中/提供済み/キャンセル済み)。キャンセル済み以外は「編集」可。**キャンセル操作は厨房画面のみ**(履歴からは不可)。「CSV出力」ボタン |
| `/products` | 商品管理 | メンバー | 商品の追加・編集・削除、画像の設定 |
| `/stats` | 売上統計 | メンバー | 全日の売上推移(日別)、日別の売上個数、選択した日の時間別売上。各グラフに表表示への切替あり |
| `/shifts` | シフト | メンバー(追加・編集・削除は Admin のみ) | インスタンスごとのシフト一覧。日付ごとに「開始〜終了(分単位、JST)」「担当者(名前+Googleアイコン)と役割」を表示。自分の担当があるシフトは枠を青で強調。終了したシフトは既定で非表示(「終了したシフトも表示」で切替)。Admin は「シフトを追加」・各シフトの編集/削除ができる。担当者は **メールアドレスではなく名前**で表示(6.1章の表示名の基準) |
| `/members` | メンバー管理 | インスタンス管理者・Admin | 自インスタンスのメンバー一覧、招待(複数アドレス同時可)、「一般 ⇔ インスタンス管理者」の切替 |
| `/edit-log` | 編集履歴 | インスタンス管理者・Admin | 直近300件を新しい順に表示 |
| `/admin` | インスタンス管理 | Admin | 6章参照 |

### 5.1 共通UI

- ヘッダーは画面上部に固定(sticky)。ナビ(スライドするインジケーター付き): 注文 / 厨房 / 注文履歴 / 商品 / 統計。その横の別グループに 切替 / シフト / メンバー・編集履歴(インスタンス管理者とAdminのみ)/ Admin(Adminのみ)。こちらは現在のページが反転表示されるだけでインジケーターは使わない(タブ数が増えて折り返し、表示が崩れるのを防ぐため)。インジケーターは折り返し時も位置・高さを個別に追従し、一致するタブがないページでは非表示。
- 右側: 自分のGoogleアイコン(押すと `/account`)、ログアウト(アイコンのみ)。アイコンがない/読み込めない場合は名前の頭文字の丸を表示(`components/Avatar.tsx`)。
- モーダルは `fixed` + `z-30`(ヘッダー `z-20` より上)。
- **ブラウザ標準の `window.prompt` / `window.confirm` は使わない**(利用環境で動作しない)。確認は `ConfirmModal` またはアプリ内モーダルで行う。
- 画面端まで引っ張ったときにページ全体(ヘッダー含む)が伸びる Android のオーバースクロール効果と、プルダウン更新は `overscroll-behavior-y: none` で無効化している(`globals.css`)。
- **リンクカード(Discord / X 等)**: ルートレイアウトの `metadata` に Open Graph / Twitter Card を設定し、画像は `src/app/opengraph-image.png`(1200×630、ロゴ+「注文管理」)。URL をログイン前のページ(`/` → `/login`)にリダイレクトしても、クローラーは同じメタタグを読める。画像の絶対URLは `VERCEL_PROJECT_PRODUCTION_URL`(Vercel が自動設定する本番ドメイン)から組み立てる(`layout.tsx` の `metadataBase`)。カードの見た目を変えるときは画像を作り直し、Discord 側は古い表示がキャッシュされることがある。
- 画像はドラッグ不可、長押しメニュー(保存/別タブで開く)をできる限り抑止(`globals.css` の `-webkit-touch-callout` と `Providers.tsx` の `contextmenu` 抑止)。テキスト選択は入力欄以外で無効。

### 5.1.1 アプリとしてのインストール(PWA)

- `src/app/manifest.ts` が Web App Manifest(`/manifest.webmanifest`)を配信する。`display: standalone`、`theme_color: #171717`、アイコンは `public/icons/` の PNG(192 / 512 / maskable 512)。iOS 用は `src/app/apple-icon.png`。
- これがないと Android Chrome は「ショートカット」しか作れず、起動時に Chrome の操作バー(Chromeで開く等)が出る。マニフェストがあるとインストールが通常のアプリ(WebAPK)になり、バーなしで全画面表示される。
- アイコンは `public/logo.svg` から `rsvg-convert` で生成した(maskable は背景を全面ダークにし、ロゴを中央約62%に縮小)。ロゴ変更時は同様に再生成すること。
- 注意: WebAPK の作成には端末側で Google Play 開発者サービスが必要。メーカー製タブレットなどで利用できない場合、マニフェストがあっても Chrome が従来のショートカットにフォールバックし、バーが残ることがある。

### 5.2 注文の状態

`WAITING`(待機中) → `COMPLETED`(提供済み)/ `CANCELLED`(キャンセル)

- 注文確定時は `WAITING`。「提供完了」で `COMPLETED`(完了時刻を記録。完了時に支払い方法を変更可能)。
- 「キャンセル」は厨房画面から。キャンセル済みの注文は **売上・CSV出力・統計に含まれない**。
- 注文の編集(商品・数量・客の特徴・支払い方法)は厨房・履歴の両方から可能。

### 5.3 支払い方法

`CASH`(現金/金券)/ `PAYPAY`(PayPay)/ `D_PAYMENT`(d払い)。定義は `src/lib/payment.ts`。

### 5.4 商品

- 価格は円の整数、**0円も可**(検品・廃棄など売上に載せない記録用)。
- **削除は論理削除**(`active=false`)。過去の注文・CSVは影響を受けない。
- **削除時は確認のため商品名の入力が必要**(インスタンス削除も同様)。
- 画像: アップロード(png/jpeg/webp/gif、5MB以下 → Vercel Blob)または**デフォルト画像ギャラリー**から選択。`/public/defaults/products/` の SVG を `src/lib/defaultProductImages.ts` に登録する方式(料理/串物/スナック/スイーツ/飲み物/その他/廃棄/検食)。
- 画像URLは「`/defaults/products/` 配下」または「Vercel Blob の公開URL」のみ許可(`isValidProductImagePath`)。外部URLは不可。
- AIによる画像生成は検討の末 **見送り**(実装しない方針)。

### 5.5 注文明細のスナップショット

`OrderItem` は注文時点の **商品名・画像URL・単価** を自前で保持する(商品マスタの後日変更・削除があっても履歴/CSV/統計が変わらないようにするため)。注文を編集して商品を差し替えた場合は、その時点の商品情報で再スナップショットされる。

## 6. 管理画面(`/admin`)

- **インスタンス**: 作成(名前・ラベル)、稼働/停止の切替、複製、削除。
  - ラベルはヘッダーに表示される短い名前(例: `vpro`)。空ならインスタンス名を表示。
  - **複製**: 有効な商品とメンバー(メールアドレスのみ)をコピー。注文履歴・編集履歴・インスタンス管理者フラグ・表示名はコピーしない。
  - **削除**: 商品・注文・メンバー・編集履歴を**すべて完全削除**(元に戻せない)。インスタンス名の入力による確認が必要。
- **メンバー**: インスタンスごとのアコーディオン(**初期は折りたたみ**)。
  - 招待: メールアドレスをカンマ・空白(混在可)区切りで複数同時に入力可(`src/lib/emails.ts`)。まだログインしていないアドレスも事前に招待できる。
  - 表示名: 優先順位は **管理者が設定した表示名(`InstanceMember.displayName`、インスタンスごと) → 本人が `/account` で設定した表示名(`User.displayName`) → Googleアカウント名(`User.name`、ログイン後) → メールアドレス**(`src/lib/memberName.ts` の `resolveName`)。名前クリックでインライン編集。名前の左にGoogleアイコンを表示。ログイン済みの人には「認証済み」バッジ。
  - Admin 一覧(常時管理者・招待された Admin)も同じ基準で名前を表示し、名前がある場合はメールアドレスを下に小さく併記する。Admin 自身の名前は、いずれかのインスタンスのメンバーに設定された表示名 → 本人設定の表示名 → Googleアカウント名 → メールアドレスの順。Admin 専用の名前欄は持たない。
  - 権限: 「一般 ⇔ インスタンス管理者」の切替。メンバー削除。
- **管理者(Admin)**: メールアドレスの複数同時招待、権限の削除。`ADMIN_EMAIL` の人は削除不可(常時管理者)。

## 7. 編集履歴

`EditLog` に「誰が・いつ・何を」を人が読める文字列で記録(差分は `summary` に文章で保存)。インスタンス管理者・Admin のみ閲覧。

| 対象 | 操作 | 記録される内容 |
|---|---|---|
| 注文 | 新規登録 | 商品×数量 |
| 注文 | 編集 | 客の特徴・支払い方法・商品の変更前→変更後 |
| 注文 | キャンセル / 完了(個別・まとめて) | 完了時は支払い方法 |
| 商品 | 新規登録 / 編集 / 削除 | 商品名・価格(変更前→後)・画像変更 |
| メンバー | 招待(新規のみ) | 招待したメールアドレス |
| メンバー | 権限の切替 | 変更前→変更後の権限 |
| シフト | 追加 / 編集 / 削除 | 日付・時間帯・担当人数 |

記録されないもの: 表示名の変更、Admin の招待/削除、インスタンス自体の作成・複製・停止・削除、注文の物理削除。

## 8. データモデル(`prisma/schema.prisma`)

| モデル | 主な項目 | 備考 |
|---|---|---|
| `User` / `Account` / `Session` / `VerificationToken` | Auth.js 標準 | DBセッション。追加列: `displayName`(本人が設定する表示名)、`shiftReminder30`(30分前通知、既定 true) |
| `PushSubscription` | userId, endpoint(unique), p256dh, auth | 通知をオンにしたブラウザ/端末ごとの Web Push 購読情報。通知を切る・送信先が失効(404/410)したら削除 |
| `Shift` | instanceId, startsAt, endsAt | 時間帯(UTC保存、表示はJST、分単位)。インスタンス削除でカスケード削除 |
| `ShiftAssignment` | shiftId, memberId, role, beforeNotifiedAt?, startNotifiedAt? | シフト×担当者×役割(役割は自由入力、20文字以内)。`*NotifiedAt` は通知送信済みの印で二重送信防止 |
| `AdminInvite` | email(unique) | Admin 追加用 |
| `Instance` | name, label, active, createdAt | 削除すると配下をカスケード削除 |
| `InstanceMember` | instanceId, email, userId?, isInstanceAdmin, displayName? | `(instanceId, email)` が unique。招待はメールで照合し、初回ログイン時に `userId` を紐付け(`src/auth.ts` の `signIn` イベント) |
| `Product` | name, price, imageUrl?, sortOrder, active | 論理削除 |
| `Order` | customerNote?, paymentMethod, status, createdAt, completedAt? | |
| `OrderItem` | productId?, productName, imageUrl?, unitPrice, quantity | スナップショット保持。商品削除時 `productId` は null に |
| `EditLog` | instanceId, entityType(ORDER/PRODUCT/MEMBER), entityId, action(CREATE/EDIT/CANCEL/COMPLETE/DELETE/INVITE), summary, actorEmail, createdAt | `(instanceId, createdAt)` に index |

マイグレーションは `prisma/migrations/`(init → 注文キャンセル+明細画像 → インスタンス管理者+編集履歴 → メンバー表示名 → ユーザー表示名 → シフトと Web Push)。

## 9. CSV出力(`GET /api/orders/export`)

- 対象: ログイン中インスタンスの、**キャンセルを除く**全注文(古い順)。
- 文字コード UTF-8(BOM付き)、改行 CRLF。1行=注文明細1件。
- ヘッダー: `ID(OrderDB),timestamp,支払い方法,商品名,点数,商品単体価格`
- `timestamp` は `YYYY/MM/DD HH:mm:ss`(JST)。支払い方法は日本語ラベル。
- ファイル名: `売上管理簿_{インスタンス名}_{YYYY-MM-DD}.csv`

## 10. 売上統計(`src/lib/stats.ts`)

- 集計対象はCSVと同じ(キャンセル除外)。日付・時間帯はJSTで丸める。
- 日別: 売上金額 / 件数 / 売上個数。時間別: 選択した日の1時間ごとの売上金額(稼働時間帯を自動で切り出して表示)。
- グラフは `src/components/BarChart.tsx`(HTML/CSS製の棒グラフ、ホバーでツールチップ、表表示切替)。

## 11. API一覧

認可は「メンバー」= ログイン済み+現在のインスタンスのメンバー(かつインスタンスが稼働中)、「Admin」= 全体管理者。

| メソッド | パス | 認可 | 内容 |
|---|---|---|---|
| GET / POST | `/api/orders` | メンバー | 注文一覧(`?status=`)/ 注文登録 |
| GET / PATCH | `/api/orders/[id]` | メンバー | 取得 / 編集(明細は丸ごと置換) |
| DELETE | `/api/orders/[id]` | メンバー | 物理削除(**UIからは未使用**、履歴にも記録されない) |
| POST | `/api/orders/[id]/complete` | メンバー | 提供完了(支払い方法の変更可) |
| POST | `/api/orders/[id]/cancel` | メンバー | キャンセル |
| POST | `/api/orders/complete-bulk` | メンバー | 複数の待機中注文を一括完了 |
| GET | `/api/orders/export` | メンバー | CSV出力 |
| GET / POST | `/api/products` | メンバー | 有効な商品一覧 / 登録 |
| PATCH / DELETE | `/api/products/[id]` | メンバー | 編集 / 論理削除 |
| POST | `/api/products/upload` | メンバー | 画像アップロード(multipart、5MB以下) |
| POST | `/api/instances/select` | ログイン済 | 現在のインスタンスをCookieに設定 |
| POST | `/api/admin/instances` | Admin | インスタンス作成 |
| PATCH / DELETE | `/api/admin/instances/[id]` | Admin | 名前・ラベル・稼働状態の更新 / 削除 |
| POST | `/api/admin/instances/[id]/duplicate` | Admin | 複製 |
| POST | `/api/admin/instances/[id]/members` | Admin / そのインスタンスのインスタンス管理者 | メンバー招待(1リクエスト1アドレス。複数はクライアントが並列送信) |
| PATCH | `/api/admin/instances/[id]/members/[memberId]` | Admin / そのインスタンスのインスタンス管理者 | 権限の更新(表示名の更新は Admin のみ。インスタンス管理者は自分の権限を外せない) |
| DELETE | `/api/admin/instances/[id]/members/[memberId]` | Admin | メンバー削除 |
| POST | `/api/admin/admins` | Admin | Admin招待 |
| DELETE | `/api/admin/admins/[id]` | Admin | Admin権限の削除 |
| POST | `/api/shifts` | Admin | シフト追加(日付・開始・終了・担当と役割。編集履歴に記録) |
| PATCH / DELETE | `/api/shifts/[id]` | Admin | シフト編集(担当は丸ごと置換=通知の送信済み印もリセット)/ 削除 |
| PATCH | `/api/account` | ログイン済 | 自分の表示名と `shiftReminder30` の更新 |
| POST / DELETE | `/api/push/subscribe` | ログイン済 | この端末の通知購読の登録 / 解除 |
| POST | `/api/push/test` | ログイン済 | 自分の端末へテスト通知 |
| GET | `/api/cron/shift-notify` | `Authorization: Bearer $CRON_SECRET` | 通知の送信(外部cronが毎分呼ぶ。下記) |
| GET / POST | `/api/auth/[...nextauth]` | - | Auth.js |

## 12. 環境変数

値は Vercel の Environment Variables(本番)と、ローカルの `.env`(Git管理外)に設定する。**値をリポジトリに書かない。**

| 変数 | 用途 |
|---|---|
| `DATABASE_URL` | アプリ実行時のDB接続(Neon の **pooled** URL) |
| `DATABASE_URL_UNPOOLED` | マイグレーション専用の直接接続(`prisma.config.ts` が優先して使用)。pooled のままだとアドバイザリロックでタイムアウトする(P1002) |
| `AUTH_SECRET` | Auth.js の署名用シークレット |
| `AUTH_TRUST_HOST` | Auth.js のホスト信頼設定 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth クライアント |
| `ADMIN_EMAIL` | 常時管理者(ブートストラップAdmin)のメールアドレス |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob の読み書きトークン |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push の鍵。`npx web-push generate-vapid-keys` で1回だけ生成して両方設定(秘密鍵は公開しない)。未設定だと通知機能は無効(アカウント設定に「未設定」と表示) |
| `VAPID_SUBJECT` | Web Push の連絡先(`mailto:` かURL)。省略可 |
| `CRON_SECRET` | `/api/cron/shift-notify` を呼ぶ側と共有する合言葉(推測されにくい長いランダム文字列) |

### 12.1 シフト通知の仕組みと外部cronの設定

- 通知は **Web Push**(ブラウザ標準、Service Worker `public/sw.js`)。アカウント設定で「通知をオンにする」→ ブラウザの許可 → 購読情報を `PushSubscription` に保存。
- 送信タイミングは `GET /api/cron/shift-notify` が決める: 開始の30分前〜開始(ユーザーが「30分前にも通知する」をオンにしている場合のみ)と、開始〜開始15分後(常に。それより遅れた分は送らない)。担当(`ShiftAssignment`)ごとに1回だけ。担当者がまだ一度もログインしていない(`userId` なし)場合は送らない。
- **Vercel Hobby の Cron は1日1回までなので使えない。** 外部の無料サービス **cron-job.org** から **毎分** 次を呼ぶ:
  - URL: `https://<本番ドメイン>/api/cron/shift-notify`、メソッド GET
  - ヘッダー: `Authorization: Bearer <CRON_SECRET と同じ値>`
  - 成功時は `{"checked":N,"sent":M}` を返す。設定不足は 401(合言葉違い)/ 503(VAPID 未設定)。
- 通知が届かないときの確認順: ①アカウント設定が「この端末で通知オン」か(テスト通知で確認) ②cron-job.org の実行履歴が毎分成功しているか ③Vercel の環境変数 ④Vercel の Deployment Protection で `/api/cron/...` が弾かれていないか(弾かれると 401 の HTML が返る)。
- iPhone / iPad は iOS 16.4 以降で、**ホーム画面に追加したアプリ**として開いた場合のみ Web Push が使える。Android(Chrome)は通常のブラウザでも可。

## 13. 開発手順

```bash
# Node 22 系を使う(asdf の場合は .tool-versions に従う)
node -v            # v22.x であること
npm install        # postinstall で prisma generate が走る
npm run dev        # http://localhost:3000
npm run lint
npx tsc --noEmit
npm run build      # DB接続なしでも通る(Prismaクライアントは遅延初期化)
npm run db:seed    # サンプルインスタンス作成(ADMIN_EMAIL が必要)
```

- ローカルで画面を動かすには、`DATABASE_URL` が指すPostgresと、Google OAuth のクライアント(リダイレクトURIに `http://localhost:3000/api/auth/callback/google`)が必要。
- スキーマ変更時: `prisma/schema.prisma` を編集 → ローカルPostgresに対して `npx prisma migrate dev --name <名前>` でマイグレーションSQLを生成 → コミット。本番への適用はデプロイ時に自動。
- 認証が必要な画面の見た目確認は、認証を通さない一時的なプレビュー用ページ(`src/app/dev-preview-*`)にモックデータを渡して確認し、**確認後は必ず削除してからコミット**する運用にしていた。

## 14. デプロイ

- `main` への push で Vercel が自動ビルド・デプロイ。
- `vercel.json` の `buildCommand`: `prisma migrate deploy && next build`(マイグレーションはビルド時に自動適用)。`package.json` の `build` は `next build` のみ(ローカルビルドにDBを要求しないため)。
- 新しいマイグレーションを含む変更は、デプロイ時に本番DBへ自動適用される。**破壊的な変更は事前にバックアップ・影響確認を行うこと。**

### Vercel / GitHub 運用上の注意(過去に踏んだ問題)

| 事象 | 原因・対処 |
|---|---|
| Hobby プランで Organization 所有の**非公開**リポジトリをデプロイできない | リポジトリを Public にするか、Pro にアップグレード。現在は Public(そのため秘密情報・個人情報をコミットしないこと。過去に売上CSVを履歴から完全削除した経緯あり) |
| 画像追加でエラー(`Cannot use public access on a private store`) | Blob ストアは **Public アクセス** で作成する |
| `Sensitive` 設定の環境変数は後から値を読み出せない(ダッシュボード・`vercel env pull` とも) | 値は別途安全に保管しておく |
| ビルド時に `prisma migrate deploy` が P1002 でタイムアウト | `DATABASE_URL_UNPOOLED` を設定する |
| 環境変数が空値のまま Deploy ボタンが押せない | 空の変数を削除/値を入力。表示が固まったらリロード |
| Node.js のサポート切れ | Node 20 は EOL。`engines.node` を `22.x` に固定済み。以後も最新のセキュリティリリースの確認を |

## 15. 既知の制約・今後の課題

- **自動テストなし**(型チェック・lint・ビルド+手動確認で運用)。
- 厨房画面は **ポーリング(2.5秒)** による更新で、WebSocket等のリアルタイム通信ではない。同時操作の競合(同じ注文を同時に編集等)は最後の書き込みが勝つ。
- 編集履歴は直近300件のみ表示。ページング・検索・絞り込みは未実装。
- 注文のAPI物理削除(`DELETE /api/orders/[id]`)はUIから使っておらず、履歴にも残らない。不要なら削除を検討。
- **メールアドレスの可視範囲**: 他人のメールアドレスが見えるのは Admin 画面とメンバー管理(`/members`)・編集履歴(`/edit-log`)のみで、いずれもインスタンス管理者・Admin 限定。一般メンバーが開く画面・APIには他人のメールアドレスは含まれない(自分のものは `/instances`・`/account` に表示)。新しい画面を足すときもこの前提を守ること。
- インスタンス管理者はメンバーの招待と権限の付与・剥奪ができるが、メンバーの削除・表示名変更はできない(Admin のみ)。
- 複製では表示名・インスタンス管理者の権限・シフトは引き継がれない。
- シフトは同日内(終了が開始より後)のみ。日をまたぐ場合は2つに分ける。シフトを編集すると、そのシフトの通知済みの印がリセットされ、まだ来ていない通知が再度送られる。
- 通知の精度は外部cron(毎分)に依存する。cron が止まると通知も止まる。
- 法的な整理(電気通信事業法など)は、本機能が自分たちのメンバー向けの業務連絡に限られる前提で問題ないと判断しているが、弁護士の確認を受けたものではない。
- Admin の招待/削除、インスタンスの作成・停止・削除は編集履歴に残らない。
- 画像はアップロード後に不要になっても Blob から自動削除されない。
