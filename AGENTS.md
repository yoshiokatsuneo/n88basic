# エージェント向け作業ガイド

## 最初に読むもの

1. `README.md`：使い方、開発環境、ビルド、デバッグ、公開手順。
2. `docs/HANDOFF.md`：現在の状態、既知の問題、壊してはいけない挙動。
3. `git status --short` と対象のソース・テスト。会話履歴がなくても、この3つを起点にする。

これはN88-BASICを参考にした独立したブラウザ用インタプリタ。実機ROMや完全なハードウェアエミュレーションは使わない。互換性未確認の機能を「実機と同じ」と断言しない。

## 編集と検証

- 実装は `src/*.ts`。ES Modulesと`import type`を使う。生成されたルートの `.js` / `.js.map` を手で修正しない。
- `npm ci` → `npm run check`。Node.js 24系、Python 3（ローカルサーバー）を使用。
- `npm run watch` と別ターミナルの `npm start` で開発。watchはブラウザを自動更新しない。型エラーがあってもバンドルが生成される場合があるので、完了判定は `npm run check`。
- 変更後は `npm run format` と `npm run check`。不具合修正には、壊れた挙動を検出できる回帰テストを追加する。
- Canvas、カーソル、IME、フォーカスの変更はブラウザでも確認。Nodeの画面テストは簡易DOMであり実ブラウザの代用にはならない。
- `basic.html` のスクリプト・CSSのクエリ文字列を必要に応じて更新する。古いキャッシュとの混在で入力文字が見えなくなったことがある。
- リファレンス本文は `docs/reference-data.json`、生成は `python3 docs/build-reference.py`。検索UIは `src/reference.ts`。
- 既存のユーザー変更・未追跡ファイルを勝手に削除・コミットしない。ステージするファイルを明示する。

## コードの配置

- `basic.ts`：命令実行、変数、配列、ラベル、ペース制御。
- `expression.ts` / `syntax.ts`：式評価と構文処理。
- `session.ts` / `program-lines.ts`：即時コマンド、行編集、RENUM、SAVE/LOAD。
- `app.ts`：画面とインタプリタの接続、テキスト画面、キーボードイベント。
- `terminal-cursor.ts`：入力文字のCanvas描画・カーソル・確定済み文字レイヤーのマスク。
- `graphics.ts`：色判定・塗りつぶし。`keyboard.ts`：入力キューと押下状態。
- `storage.ts` / `program-menu.ts`：保存データ検証と全画面の保存・読込UI。
- `types.ts`：共通型。`tests/*.test.js`：ES Modulesの回帰テスト。

## 公開

- リポジトリ： https://github.com/yoshiokatsuneo/n88basic
- 公開先： https://yoshiokatsuneo.github.io/n88basic/
- `main`へのpushはGitHub Actions経由で本番公開を起動する。現在のユーザー依頼の範囲を確認して実行し、過去の会話の承認をこのファイルで代用しない。
- `scripts/package-site.mjs` が公開対象だけを `_site/` へ集める。node_modulesやIDE設定は公開しない。
- 公開した場合はActionsの結果と公開ページを確認してから完了を伝える。
- ユーザーの保存コードはブラウザのlocalStorage。調査のために消したり、自分のテストコードで置き換えたりしない。

## 引き継ぎの更新

挙動・構成・既知の問題が変わったらREADMEとHANDOFFを更新する。完了済み、未完了、実機互換性未確認を区別する。認証情報、個人の保存プログラム、会話全文は記載しない。
