"""Rebuild the offline reference page from the reviewed command catalog."""
import json
from pathlib import Path
from html import escape as e
root=Path(__file__).resolve().parent.parent
entries=json.loads((root/'docs/reference-data.json').read_text())
groups=list(dict.fromkeys(row[0] for row in entries))
cards=[]
for i,(group,name,syntax,description,example,note) in enumerate(entries):
    cards.append(f'''<article id="command-{i}" data-group="{e(group)}">
<div class="card-top"><span>{e(group)}</span><a href="#command-{i}" aria-label="{e(name)}へのリンク">#</a></div>
<h2>{e(name)}</h2><h3>書式</h3><pre class="syntax"><code>{e(syntax)}</code></pre>
<p>{e(description)}</p><h3>例</h3><pre><code>{e(example)}</code></pre><p class="note">{e(note)}</p></article>''')
options=''.join(f'<option>{e(g)}</option>' for g in groups)
index=''.join(f'<a href="#command-{i}" data-target="command-{i}">{e(row[1])}</a>' for i,row in enumerate(entries))
html='''<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>命令リファレンス — AI N-88 BASIC</title>
<style>
:root{color-scheme:light;--ink:#203b31;--muted:#536c60;--line:#d7e1d7;--paper:#f5f6ef}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.85 system-ui,sans-serif}
header{background:#14281f;color:#f4f6ee;padding:32px max(24px,calc((100vw - 1180px)/2))}
header p{max-width:760px;color:#c6d7c9;margin:10px 0}h1{font-size:clamp(25px,4vw,38px);margin:6px 0}header small{letter-spacing:.16em}header a{color:#e3eec1}
main{max-width:1228px;margin:auto;padding:24px}a{color:#276445;text-underline-offset:3px}
.filters{position:sticky;top:0;z-index:2;background:var(--paper);border-bottom:1px solid var(--line);padding:12px 0;display:flex;gap:12px;align-items:end;flex-wrap:wrap}
label{display:flex;flex-direction:column;font-size:12px;font-weight:600;gap:4px}.search{flex:1;min-width:180px}
input,select,button{font:inherit;padding:10px 12px;border:1px solid #aabfae;border-radius:6px;background:white;color:var(--ink)}input{width:100%}
button{cursor:pointer}input:focus-visible,select:focus-visible,a:focus-visible,button:focus-visible{outline:3px solid #8aac64;outline-offset:3px}
#count{font-size:13px;color:var(--muted);margin:8px 0}.layout{display:grid;grid-template-columns:235px 1fr;gap:28px}
nav{position:sticky;top:104px;align-self:start;max-height:calc(100dvh - 130px);overflow:auto;padding-right:12px;font-size:13px}
nav a{display:block;padding:5px 8px;border-bottom:1px solid #e3e8dd;text-decoration:none}nav a:hover{background:#e3ecde}
article,.intro,.limits{background:#fff;border:1px solid var(--line);border-radius:9px;padding:24px;margin-bottom:18px;scroll-margin-top:125px}
.card-top{display:flex;justify-content:space-between;color:var(--muted);font-size:12px}h2{font-size:22px;margin:6px 0 12px;line-height:1.4}h3{font-size:12px;color:var(--muted);margin:16px 0 4px}
pre{margin:0;padding:14px 16px;background:#14281f;color:#edf7e8;border-radius:6px;overflow:auto;font:14px/1.8 ui-monospace,monospace}
pre.syntax{background:#edf2e8;color:#244634;white-space:pre-wrap;overflow-wrap:anywhere}p{margin:12px 0}p.note{font-size:13px;color:var(--muted);border-left:3px solid #c8d7b5;padding-left:12px}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;border-bottom:1px solid var(--line);padding:8px;vertical-align:top}
details{margin:14px 0}summary{cursor:pointer;font-weight:650}code{font-family:ui-monospace,monospace}
[hidden]{display:none!important}footer{padding:20px 0;color:var(--muted);font-size:12px}
@media(max-width:740px){main{padding:14px}.layout{display:block}nav{position:static;max-height:180px;margin:12px 0 20px}article,.intro,.limits{padding:18px}header{padding:24px}.filters{gap:8px}#print{display:none}}
@media print{header{background:white;color:black;padding:0}header p{color:black}.filters,nav,#count,#empty,header a{display:none}main{max-width:none;padding:0}.layout{display:block}article{break-inside:avoid}pre{background:#eee;color:black;white-space:pre-wrap}details{display:block}}
</style></head><body>
<header><small>AI N-88 BASIC / BROWSER EDITION</small><h1>命令リファレンス</h1>
<p>このブラウザ版で使える命令・関数の手引き。書式、入力例、実装上の制限をまとめました。</p>
<a href="basic.html" target="_blank" rel="noopener">BASIC画面を開く ↗</a></header>
<main>
<section class="intro"><h2>最初に</h2>
<p>黒い画面では、行番号なしならその場で実行、行番号付きならプログラムへ登録します。登録後は <code>RUN</code> で実行。<code>LIST</code> で表示し、↑↓で行を選んで編集、Enterで確定できます。停止はCtrl+CまたはEscです。</p>
<p>書式の <code>[ ]</code> は省略可能な部分で、角括弧そのものは入力しません。「例」は行番号付きならプログラムとして登録し、それ以外は1行ずつ入力してください。管理命令は即時モードで単独入力します。</p>
<p>実行速度はヘッダで調整できます。標準は「実機風 ×1」、×0.25〜×4と「高速」を選択でき、設定は保存されます。特定機種の実測値による再現ではなく体感速度の目安です。SLEEPの指定時間は倍率によって変えません。</p><details><summary>変数・式・画面の基本</summary>
<p>大文字・小文字は区別しません。文字列は二重引用符で囲みます。変数は数値、末尾$は文字列、%は整数、!・#は数値です。未代入は0または空文字。通常の数値計算はJavaScriptの倍精度です。</p>
<table><tr><th>種類</th><th>記法</th></tr>
<tr><td>算術</td><td><code>+ - * / &#92; ^ MOD</code>（&#92;は整数除算、^は累乗）</td></tr>
<tr><td>比較</td><td><code>= &lt;&gt; &lt; &gt; &lt;= &gt;=</code>（真は−1、偽は0）</td></tr>
<tr><td>論理</td><td><code>NOT AND OR XOR EQV IMP</code>（ビット演算）</td></tr>
<tr><td>数値定数</td><td><code>123</code>、<code>1.5</code>、<code>1E3</code>、<code>&amp;HFF</code>、<code>&amp;O77</code></td></tr>
<tr><td>連結</td><td>文字列の連結は+。1行に複数命令を書く区切りはコロン。</td></tr>
<tr><td>座標</td><td>図形：x=0〜639 / y=0〜399。文字：桁=0〜79 / 行=0〜24。左上が原点。</td></tr>
<tr><td>色番号</td><td>0 黒 / 1 青 / 2 赤 / 3 紫 / 4 緑 / 5 水色 / 6 黄 / 7 白</td></tr></table>
<p>通常は累乗、乗除算、加減算、比較、論理演算の順に評価します。迷う場合は括弧で明示してください。文字列関数はUTF-16単位で処理し、実機のShift JISとは異なります。</p></details>
<details><summary>エラーと互換性</summary>
<p>未定義・未対応の命令は <code>Syntax error</code>。保存プログラムなら <code>Syntax error in 20</code> のように行番号が付き、入力待ちへ戻ります。その他のエラーは現在、日本語の説明を表示します。</p>
<p>SCREEN / WIDTHは受理のみ。CONT、AUTO、ON ERROR、OPEN/CLOSE、PRINT#、PLAY、機械語・実機ハードウェア操作は未対応です。すべてのN88-BASICプログラムがそのまま動くわけではありません。</p>
<p>SAVEはブラウザ内の保存です。保存データを消すと失われます。PC上の.basファイルに残すには編集画面の「保存 ↓」を使ってください。起動時の67108864 Bytes freeは固定表示であり、実際の空き容量の計測値ではありません。</p></details>
</section>
<div class="filters"><label class="search">命令・説明を検索<input id="search" type="search" placeholder="例：CLS、保存、キー、文字列" autocomplete="off"></label>
<label>分類<select id="category"><option value="">すべて</option>OPTIONS</select></label><button id="reset">クリア</button><button id="print">印刷</button></div>
<p id="count" role="status"></p>
<div class="layout"><nav aria-label="命令の索引">INDEX</nav><div id="entries">CARDS<p id="empty" hidden>該当する命令がありません。検索語や分類を変更してください。</p></div></div>
<footer>2026-09-28版 · このリポジトリのsrc/basic.ts / src/session.ts / src/app.ts / src/keyboard.tsの実装に基づく独立したリファレンスです。原製品の公式マニュアルではありません。</footer>
</main><script src="reference.js?v=20260928-modules1"></script></body></html>'''
html=html.replace('OPTIONS',options).replace('INDEX',index).replace('CARDS','\n'.join(cards))
(root/'reference.html').write_text(html)
print(f'{len(entries)} reference entries generated')
