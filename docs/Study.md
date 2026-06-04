# Study.md — Java 経験者のための本システム理解ガイド

このドキュメントは「**Java は読めるが、それ以外のプログラミング経験はない**」読者を対象に、本リポジトリ (Next.js + TypeScript + SQLite ベースの ToDo アプリ) を読み解くために必要な知識を整理します。各概念について「**それは何か → なぜ存在するか → どう書くか → Java ではどうか**」の順で説明します。

> 表記ルール
> - **太字** は新出の重要用語
> - `コード` はソース中の表記そのまま
> - 「Java では…」の比較は、概念をつかむためのアナロジーであって、内部実装が同じという意味ではありません

---

## 目次

1. [技術スタック全体像](#1-技術スタック全体像)
2. [TypeScript: Java から見て押さえるべき差分](#2-typescript-java-から見て押さえるべき差分)
3. [非同期処理 (async / await / Promise)](#3-非同期処理-async--await--promise)
4. [モジュールとインポート](#4-モジュールとインポート)
5. [React: コンポーネントとフック](#5-react-コンポーネントとフック)
6. [Next.js: ファイルベースルーティング](#6-nextjs-ファイルベースルーティング)
7. [JSX とスタイリング](#7-jsx-とスタイリング)
8. [ブラウザ API](#8-ブラウザ-api)
9. [データベースアクセス](#9-データベースアクセス)
10. [プロジェクト構造ツアー](#10-プロジェクト構造ツアー)
11. [本コードによく出てくるパターン](#11-本コードによく出てくるパターン)
12. [開発の動かし方](#12-開発の動かし方)
13. [学習ロードマップ](#13-学習ロードマップ)
14. [Java との対比チートシート](#14-java-との対比チートシート)
15. [用語集](#15-用語集)
16. [Java 経験者がよくつまずくポイント FAQ](#16-java-経験者がよくつまずくポイント-faq)

---

## 1. 技術スタック全体像

本システムは「**Web ブラウザで動く ToDo アプリ**」です。利用者の端末 (ブラウザ) と、その向こうにあるサーバ (Node.js プロセス)、そしてデータを永続化する SQLite ファイルの 3 層で構成されています。

| レイヤ              | 採用技術                                              | 役割                                                 | Java 世界の類似             |
|----------------------|--------------------------------------------------------|-------------------------------------------------------|------------------------------|
| 実行環境             | **Node.js**                                            | サーバ側の JavaScript を実行するランタイム            | JVM                          |
| 言語                 | **TypeScript** (TS)                                    | JavaScript に静的型を足した言語。本コードのソース全部 | Java                         |
| Web フレームワーク   | **Next.js 16** (App Router)                            | サーバ起動・ルーティング・SSR を一括で面倒見る FW     | Spring Boot + Thymeleaf      |
| UI ライブラリ        | **React 19**                                           | コンポーネント指向でブラウザ側の DOM を組み立てる     | JavaFX の宣言型バージョン   |
| DB クライアント      | **@libsql/client**                                     | SQLite / Turso 互換クライアント                       | JDBC ドライバ                |
| 認証                 | **bcryptjs**                                           | パスワードハッシュ化                                  | `BCryptPasswordEncoder`     |
| 決済                 | **Stripe SDK**                                         | Stripe を呼び出すラッパー                             | Stripe Java SDK              |

### 1.1 ブラウザとサーバの関係

```
[ブラウザ]                     [Next.js サーバ (Node.js)]            [SQLite ファイル]
  │  1) GET /                       │                                     │
  │ ───────────────────────────────▶│                                     │
  │                                  │ 2) page.tsx を実行して HTML を返却 │
  │ ◀───────────────────────────────│                                     │
  │  3) HTML 表示                    │                                     │
  │  4) JS の続きを実行 (fetch)      │                                     │
  │  5) POST /api/auth/login         │                                     │
  │ ───────────────────────────────▶│                                     │
  │                                  │ 6) DB 問い合わせ                   │
  │                                  │ ───────────────────────────────────▶│
  │                                  │ ◀───────────────────────────────────│
  │ ◀───────────────────────────────│ 7) JSON 返却                        │
```

エントリポイントは [`src/app/page.tsx`](../src/app/page.tsx)、設定は [`package.json`](../package.json)、DB スキーマは [`docs/er-diagram.md`](./er-diagram.md) を参照。

---

## 2. TypeScript: Java から見て押さえるべき差分

### 2.1 変数宣言 — `const` / `let` / `var`

Java では `int x = 0;` と書きます。型を先に書き、変数名、`=`、初期値、`;` (セミコロン) です。TypeScript の対応版はこうなります：

```ts
const x: number = 0;
```

これを **分解** すると：

| 部品          | 意味                                                                     | Java での対応         |
|----------------|---------------------------------------------------------------------------|-------------------------|
| `const`        | **宣言キーワード** (再代入不可)                                          | `final` 修飾子          |
| `x`            | 変数名                                                                    | 同じ                    |
| `: number`     | **型注釈 (type annotation)**。「この変数は `number` 型」と書き手が明示    | 型宣言 `int`            |
| `=`            | 代入演算子                                                                | 同じ                    |
| `0`            | 初期値                                                                    | 同じ                    |
| `;`            | **文の終わり (statement terminator)**。省略可能だが本プロジェクトは付ける | 同じ                    |

#### `const` と `let` と `var`

JavaScript / TypeScript の変数宣言キーワードは 3 種類あり、それぞれ意味が違います。

- **`const`** … 再代入できない。`const x = 0; x = 1;` はエラー。Java の `final int x = 0;` と同じ。**まずこれを使う**。
  - 注意: `const` でも **オブジェクトの中身は変更できる**。`const arr = [1,2]; arr.push(3);` は OK。Java の `final List<Integer> arr` と同じく「変数が指す先は変えられない、中身は変えられる」。
- **`let`** … 再代入できる。`let x = 0; x = 1;` は OK。Java の普通の `int x = 0;`。
  - **ブロックスコープ** (`{ }` の中だけで有効)。Java と同じ感覚。
- **`var`** … 古い書き方。**スコープが関数全体** という奇妙な性質があり、バグの温床になる。**本コードでは絶対に使わない**。

#### 型注釈は省略できる

TypeScript の特徴的なところで、**型推論 (type inference)** があるので型注釈は省略できます：

```ts
const x = 0;             // x の型は number と自動推論される
const name = 'hello';    // name の型は string と自動推論される
```

ただし本プロジェクトの方針は「**関数の戻り値型・const 変数にも必ず型注釈をつける**」。つまりこう書きます：

```ts
const x: number = 0;
const name: string = 'hello';
```

理由: 後から読む人 (人間と TypeScript コンパイラの両方) にとって、意図が明確になりエラーを早く検出できるため。[`src/app/utils.ts`](../src/app/utils.ts) を眺めるとこの方針が徹底されているのが分かります。

#### Java から見たクイックチェック

```java
// Java
final int count = 10;
String name = "Alice";
List<String> items = new ArrayList<>();
```

```ts
// TypeScript (本プロジェクトのスタイル)
const count: number = 10;
let name: string = 'Alice';
const items: string[] = [];
```

### 2.2 関数の宣言

Java では `int add(int a, int b) { ... }`。TypeScript では：

```ts
function add(a: number, b: number): number {
  return a + b;
}
```

分解すると：

| 部品                  | 意味                                                        |
|------------------------|--------------------------------------------------------------|
| `function`             | 関数を宣言するキーワード (Java には不要)                    |
| `add`                  | 関数名                                                       |
| `(a: number, b: number)` | 引数リスト。**型注釈は引数ごとに `: 型` の形で付ける**     |
| `: number`             | **戻り値の型**。`)` の **後** に書く                         |
| `{ ... }`              | 関数本体                                                     |

戻り値の型注釈の位置 (`)` の後) は Java と違うので注意。

#### アロー関数 (arrow function)

`function` キーワードを使わない短縮記法もあります：

```ts
const add = (a: number, b: number): number => a + b;
```

これは「`a` と `b` を受け取って `a + b` を返す」関数を `add` という定数に代入する書き方。Java のラムダ式 `(a, b) -> a + b` に近い。本コードでは特に **イベントハンドラ** や **コールバック** でよく使う：

```tsx
<button onClick={() => setCount(count + 1)}>+1</button>
//              ↑ アロー関数。引数なし、ボタン押下時に setCount を呼ぶ
```

### 2.3 構造的型付け (Structural Typing)

これは Java と TypeScript の **最大の違い** の一つです。

**Java** はクラス名で型を区別する (nominal typing)。「`Cat extends Animal`」と書かない限り `Cat` は `Animal` として扱われない。

**TypeScript** は **形 (プロパティの並び)** で型の互換性を判断する (structural typing)。クラス名・interface 名は関係ありません。

```ts
interface Point { x: number; y: number }

const p: Point = { x: 1, y: 2 };  // OK

// q は Point とは無関係に「{ x: number; y: number }」というオブジェクト型
const q: { x: number; y: number } = p;  // OK — 形が同じだから互換

// 余計なプロパティがあっても、Point として必要な x, y を持っていれば OK
const r: Point = { x: 1, y: 2, z: 3 };  // 型エラー (リテラル代入時のみ厳しめ)
const r2 = { x: 1, y: 2, z: 3 };
const r3: Point = r2;  // OK (リテラル代入ではないので形だけ見る)
```

実用上の意味: API レスポンスの JSON を「ある型として扱う」のが自然に書けます。Java のように `JsonNode → DTO` の変換を書かなくてよい。

### 2.4 Null 安全 — `undefined` と `null` と `?`

Java では `null` 一種類で「無い」を表します。TypeScript には **2 種類** あります。

- **`undefined`** … 「**まだ値が代入されていない / 存在しない**」状態。Java には対応する概念がない。
- **`null`** … 「**明示的に空にした**」状態。Java の `null` と同じ感覚。

```ts
let a: number | undefined;  // a は number または undefined
console.log(a);             // undefined (まだ値が無い)

let b: number | null = null;  // b は number または null

// 慣習: API は通常 undefined を使う。null は DB 由来でだけ出る
```

#### Optional プロパティ (`?:`) と Optional チェイン (`?.`)

オブジェクトの「**あるかもしれないし無いかもしれない**」フィールドは型に `?` を付けて宣言します：

```ts
interface User {
  id: string;
  name: string;
  avatar?: string;   // ← 「あってもなくてもいい」プロパティ。型は string | undefined
}

const u: User = { id: '1', name: 'Alice' };  // avatar 省略可
console.log(u.avatar);  // undefined
```

そういうフィールドをアクセスする時に **Optional チェイン `?.`** を使うと、`undefined`/`null` のときに途中で止まって `undefined` を返してくれます (Java の `Optional.map(...)` のチェーンに近い)：

```ts
const len: number | undefined = u.avatar?.length;
//                                       ↑ u.avatar が undefined なら、ここで止まって len は undefined
//                                         null/undefined チェックを書かなくていい
```

#### Null 合体 `??`

「`undefined` か `null` ならデフォルト値を使う」演算子：

```ts
const tone: string = parsed.welcomeTone ?? 'trivia';
// parsed.welcomeTone が undefined / null なら 'trivia'、それ以外はその値
```

Java の `Objects.requireNonNullElse(x, 'default')` に近い。

> 注意: `||` (論理 OR) も似た働きをしますが、`0` や `''` (空文字) も false 扱いになるため、`??` のほうが安全です。

### 2.5 ジェネリクス

ほぼ Java と同じです：

```ts
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

const n: number | undefined = first<number>([1, 2, 3]);
const s: string | undefined = first(['a', 'b']);  // T は推論されて string
```

`<T>` の位置や使い方は Java とほぼ一致。配列型は `T[]` (Java の `T[]` と同じ) か `Array<T>` のどちらでも書けます。

### 2.6 ユニオン型 (Union Types) と リテラル型

TypeScript の強力な機能。「**この型のどれか**」を `|` で並べて宣言できます：

```ts
type Recurrence = 'carry' | 'daily' | 'weekly' | 'monthly' | 'yearly' | string;
```

これは

- `'carry'` という文字列リテラルそのもの、または
- `'daily'`、`'weekly'`、`'monthly'`、`'yearly'` のどれか、または
- 任意の文字列

を表します。Java で言えば、`enum` の値と任意の `String` を同時に許容するイメージ。値ベースで型を絞り込めるので、型チェックがとても具体的になります。

### 2.7 型エイリアス (`type`) と インターフェース (`interface`)

両方とも「**型に名前をつける**」機能。だいたい同じですが慣習的な使い分けがあります：

```ts
// オブジェクトの形を定義する → interface
interface Todo {
  id: string;
  title: string;
}

// プリミティブやユニオン型に名前をつける → type
type Recurrence = 'carry' | 'daily' | 'weekly';
type UserId = string;
```

本コードでは [`src/app/types.ts`](../src/app/types.ts) で両方使われています。

### 2.8 型キャスト

```ts
const raw: unknown = JSON.parse(text);
const todos: Todo[] = raw as Todo[];
//                        ↑ as がキャスト。Java の (Todo[]) raw に相当
```

`unknown` は「**型が分からない**」を表す型。Java の `Object` より厳しく、何かする前に必ず型を確定しないとエラーになります。

### 2.9 セミコロンと改行

本プロジェクトは **全文末にセミコロン** を付ける方針です (Java と同じ)。JavaScript はセミコロン省略可能ですが、自動挿入で予期しない挙動を招くため明示します。

---

## 3. 非同期処理 (async / await / Promise)

Java では時間のかかる処理を **別スレッド** で動かして `Future.get()` で待ちます。JavaScript は基本的に **シングルスレッド** で、別の仕組みで非同期を扱います。

### 3.1 Promise とは何か

**Promise** は「**将来的に値が決まる箱**」を表すオブジェクトです。Java の `CompletableFuture<T>` とほぼ同じ概念。

```ts
const p: Promise<number> = fetchSomething();  // この瞬間はまだ値は無い
p.then((value) => console.log(value));         // 値が決まったら表示
```

3 つの状態を持ちます:
- **pending** (まだ決まっていない)
- **fulfilled** (値が決まった)
- **rejected** (エラーで失敗した)

### 3.2 `async` / `await` — Promise を同期っぽく書く

直接 `.then(...)` を書くとネストが深くなるので、**`async` / `await`** で書きやすくします。

```ts
async function loadUser(id: string): Promise<User> {
  const res: Response = await fetch('/api/users/' + id);
  const data: User = await res.json();
  return data;
}
```

- **`async`** … 関数の前に付けると、その関数は必ず `Promise<T>` を返すようになる。中で `await` が使える。
- **`await`** … Promise が「決まる」のを待って、中身の値を取り出す。文法的にはブロックしているように見えるが、内部的にはコールバック登録なので **他のコードは動き続ける** (スレッドは止まらない)。

Java の対応:
```java
// Java の CompletableFuture
CompletableFuture<User> loadUser(String id) {
  return httpClient.sendAsync(...)
    .thenApply(res -> parse(res));
}
// 呼び出し: User u = loadUser("1").get();
```

### 3.3 タイムラインで理解する

```
時刻 →
  [ JavaScript の唯一のスレッド ]
  ── A 関数開始 ──
                  await fetch(...)
                        │
                        │ ← ここで関数 A は「中断」。
                        │   その間、ブラウザは別の処理 (画面更新、別の click イベント等) を処理できる
                        │
                        │ ← ネットワークから応答が来た
                        ▼
                  await の続きから再開
                  ── A 関数終了 ──
```

「`await` で止まる = スレッドが止まる」ではないのが Java と決定的に違う点です。**1 つのスレッドで何百もの非同期処理を同時に進められる** のが JavaScript の強みです。

### 3.4 並列実行 — `Promise.all`

複数の Promise を並列に待つには `Promise.all` を使います ([`src/app/RecurringPanel.tsx`](../src/app/RecurringPanel.tsx) の `fetchItems` で使用):

```ts
const [recurringRes, archiveRes] = await Promise.all([
  fetch('/api/todos/recurring?userId=' + user.id),
  fetch('/api/todos/archive?userId=' + user.id),
]);
```

Java の `CompletableFuture.allOf(...)` と同じ発想。両方のリクエストを **同時に** 投げて、両方終わるのを待ちます。

### 3.5 エラーハンドリング

`await` の式は **エラー時は例外を throw** します。なので `try / catch` で囲めば Java と同じ感覚で書けます：

```ts
try {
  const data = await fetch('/api/foo');
  // 使う
} catch (e: unknown) {
  console.error('Failed', e);
}
```

`catch` の `e` の型は **`unknown`** (TypeScript 4.0 以降)。Java で言うと `catch (Throwable e)` のような最も広い型。実際にメッセージを取り出す時は型ガード：

```ts
const message: string = e instanceof Error ? e.message : String(e);
```

### 3.6 同期 API はほぼ無い

ファイル I/O やネットワークが絡む操作は **ほぼすべて Promise** を返します。`localStorage` の読み書きなど一部だけ同期 API です。「**この関数は Promise を返すか?**」と常に意識するのが重要。

---

## 4. モジュールとインポート

Java の `package` 宣言と `import` の代わりに、JavaScript/TypeScript は **ESM (ECMAScript Modules)** という仕組みを使います。

### 4.1 ファイル＝モジュール

JavaScript では **1 ファイルが 1 モジュール**。`package foo.bar;` のような宣言は不要で、ファイルパスがそのままインポート時のパスになります。

### 4.2 エクスポート (公開する側)

```ts
// utils.ts

// 名前付きエクスポート (何個でも可)
export function uid(): string { /* ... */ }
export function log(scope: string): void { /* ... */ }

// デフォルトエクスポート (1 ファイル 1 個だけ)
export default function TodoApp(): React.ReactElement { /* ... */ }
```

- **名前付き (named export)** … 関数や変数を 1 つずつ公開。複数あってよい
- **デフォルト (default export)** … その「ファイルの主役」を 1 つだけ公開。React コンポーネントの慣例

Java で言えば、`public` 修飾子を関数単位で付けて、`class Main` の役割を 1 つ指定するような感じ。

### 4.3 インポート (使う側)

```ts
// 別ファイル

import TodoApp from './TodoApp';        // default を受け取る (名前は自由)
import { uid, log } from './utils';     // 名前付きを {} で受け取る (名前は固定)
import type { Todo } from './types';    // 型情報のみ取り込む (実行時には消える)
```

| インポート文                               | 意味                                                       |
|----------------------------------------------|--------------------------------------------------------------|
| `import X from './foo'`                      | `./foo.ts` の default export を `X` という名前で取り込む    |
| `import { a, b } from './foo'`               | 名前付きエクスポート `a` と `b` を取り込む                  |
| `import { a as alias } from './foo'`         | 名前を変えて取り込む                                        |
| `import type { T } from './foo'`             | 型だけ取り込む (実行コードに含まれない)                     |
| `import './foo'`                             | 副作用 (グローバル変数登録など) だけ実行                    |

### 4.4 パスの書き方

- **`./`** … 同じディレクトリ内
- **`../`** … 1 つ上のディレクトリ
- **`@/`** … プロジェクトルート (`src/` を指すエイリアス、[`tsconfig.json`](../tsconfig.json) で定義)

```ts
import { Db } from '@/lib/db';        // src/lib/db.ts
import { useState } from 'react';     // 外部ライブラリ (node_modules 経由)
import styles from './page.module.css'; // 同じディレクトリの CSS
```

`@/` を使うと、ファイル位置が変わってもインポートを書き直さなくて済みます。

### 4.5 `import type` の意義

```ts
import type { Todo } from './types';
```

これは **型情報だけを取り込む** 特殊なインポート。コンパイル後の JS には残らないため：
- **循環参照** を起こさない
- ビルドサイズに影響しない
- 「この import は実行時には何もしない」と明示できる

慣習として、**型しか使わないインポートは `import type` を使う**。

---

## 5. React: コンポーネントとフック

React は **「画面を関数 (コンポーネント) で組み立てる」** ライブラリです。考え方の中心は次の 3 点：

1. **コンポーネントは状態 (state) と入力 (props) を受け取り、JSX (HTML 風の構文) を返す関数**
2. **状態が変わると、React は自動で再描画 (re-render) する**
3. **副作用 (fetch やタイマー) は `useEffect` 経由で書く**

### 5.1 コンポーネント = 関数

```tsx
function Greeting({ name }: { name: string }): React.ReactElement {
  return <p>こんにちは、{name}さん</p>;
}
```

これを分解すると:

| 部品                          | 意味                                                                       |
|--------------------------------|-----------------------------------------------------------------------------|
| `function Greeting`            | コンポーネント名は **大文字** で始めるルール。小文字だと HTML タグ扱いされる |
| `({ name })`                   | **分割代入**。`props.name` を直接 `name` という変数に取り出している          |
| `: { name: string }`           | props の型注釈                                                              |
| `: React.ReactElement`         | この関数は React の要素を返す、と明示                                       |
| `<p>...</p>`                   | **JSX** という JavaScript の中に HTML を書ける構文                          |
| `{name}`                       | JSX の中で `{...}` で囲むと **JS の式** を埋め込める                        |

使う側:
```tsx
<Greeting name="Alice" />
```

これは「Greeting コンポーネントに props として `{ name: 'Alice' }` を渡してインスタンス化する」という意味。Java で言えば `new Greeting("Alice")` に近い。

### 5.2 props と state

**props** … 親から子に渡される **読み取り専用** の引数。子の中で書き換えてはいけない (Java の `record` の field と同じく immutable な扱い)。

**state** … コンポーネントが内部で持つ **可変** データ。`useState` で管理。値を変えると **React が画面を作り直す**。

```tsx
function Counter(): React.ReactElement {
  const [count, setCount] = useState<number>(0);
  //     ↑ 現在の値    ↑ 更新する関数     ↑ 型     ↑ 初期値

  return (
    <div>
      <p>カウント: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```

ポイント:
- `count = count + 1` のように **直接代入してはいけない**。`setCount(...)` を呼ぶことで React が変化を検知して再描画する
- `useState` の戻り値はタプル (配列) で、`[現在値, セッター関数]` の形

Java で例えるなら、「フィールドを変えるたびに `repaint()` を自動で呼んでくれる」イメージ。

### 5.3 フック (Hooks) — 関数の中で状態と副作用を扱う仕組み

「**フック (hook)**」は React の関数コンポーネントで状態を持ったり、外部 (DOM、ネットワーク、タイマー) と相互作用するための関数。**名前が `use` で始まる** のがルール。

| フック         | 役割                                                       | Java での類推                          |
|-----------------|--------------------------------------------------------------|------------------------------------------|
| `useState`      | コンポーネント内のミュータブルな値                          | フィールド + setter (変更で再描画)      |
| `useEffect`     | レンダリング後の副作用 (fetch / タイマー / DOM 操作)        | `@PostConstruct` + クリーンアップ付き    |
| `useRef`        | 再レンダリングしても保持されるが、変更しても再描画されない箱 | 通常のフィールド (set してもレンダーしない) |
| `useCallback`   | 関数を毎回作り直さないようにメモ化                          | (該当なし、最適化用)                    |
| `useMemo`       | 重い計算の結果を依存値が変わるまで保持                      | (該当なし、最適化用)                    |

#### `useState` 詳解

```ts
const [todos, setTodos] = useState<Todo[]>([]);
```

- 初期値 `[]` (空配列) で `todos` という配列の state を作る
- 読むときは `todos`
- 変えるときは `setTodos(newValue)` または `setTodos((prev) => 計算した新しい値)`

**後者の関数形式** は前回の値を引数で受け取って次の値を返す形。同時更新が衝突しないので **本コードでは基本これを使う**:

```ts
setTodos((prev) => prev.filter((t) => t.id !== id));
//                  ↑ 削除対象を除いた新しい配列を返す
```

#### `useEffect` 詳解

```ts
useEffect(() => {
  // 副作用 (fetch, タイマー登録、DOM 操作)
  fetchTodos();

  return () => {
    // クリーンアップ (アンマウント時や依存値変化時に呼ばれる)
    clearTimeout(timerId);
  };
}, [user.id]);  // 依存配列
```

3 つの引数のように見えるパーツ:
1. **エフェクト本体** (関数) … レンダリング後に実行される
2. **クリーンアップ** (本体が返す関数) … 次回エフェクト実行前 / コンポーネント破棄時に実行
3. **依存配列** … この中の値が前回と `===` で違うときだけエフェクトが再実行される

依存配列のパターン:
- `[]` (空配列) … 初回マウント時のみ実行 (Java の `@PostConstruct`)
- `[x, y]` … `x` か `y` が変わったら再実行
- 省略 … 毎回のレンダリングで実行 (基本使わない)

[`src/app/TodoApp.tsx`](../src/app/TodoApp.tsx) を読むと多数の `useEffect` が並んでいます。それぞれが「ある関心事の同期処理」を担当しています (例: ポモドーロ状態を localStorage に保存、設定変更を CSS 変数に反映、etc.)。

#### `useRef` 詳解

```ts
const timerIdRef = useRef<number | null>(null);
timerIdRef.current = window.setInterval(() => { ... }, 1000);
```

- `.current` に値を入れる
- **値を変えても再描画されない** のがポイント。「再描画とは無関係に保持したい値」専用
- 用途: タイマー ID、DOM 要素への参照、前回値の保存など

`useState` と何が違うか:
- `useState` は値を変えると **再描画される**
- `useRef` は値を変えても **再描画されない**

### 5.4 イベントハンドラ

```tsx
<button onClick={() => setCount(count + 1)}>+1</button>
//      ↑ HTML の onclick と違い、camelCase で書く
//                ↑ JS の関数を渡す。HTML の "onclick='...'" のような文字列ではない
```

- イベント名は `onClick`、`onChange`、`onKeyDown` などすべて **camelCase**
- 値は **関数 (JS 値)** を渡す。文字列ではない
- アロー関数 `() => setCount(count + 1)` を渡すのが一般的

Java の Swing の `addActionListener(e -> ...)` に近い感覚。

### 5.5 リスト描画と `key`

配列を JSX で描画するときは **`.map()` で要素に変換** します。そして必ず **`key`** を付けます：

```tsx
<ul>
  {items.map((item) => (
    <li key={item.id}>{item.title}</li>
  ))}
</ul>
```

`key` は React が「どの要素がどの要素と対応するか」を判別するための ID。これが無いと再描画時に差分検出が壊れて挙動がおかしくなります。**配列のインデックスを `key` にすると順序変更で壊れやすい** ので、必ず一意な ID を使うのが鉄則。

### 5.6 条件分岐

JSX の中で `if` 文は使えませんが、**式** は使えるので以下のテクを駆使します：

```tsx
{/* 三項演算子 — A か B */}
{user ? <Dashboard /> : <LoginForm />}

{/* 短絡評価 — 条件が true のときだけ要素を出す */}
{isLoading && <p>読み込み中...</p>}

{/* null を返すと何も出ない */}
{error ? <p>{error}</p> : null}
```

### 5.7 ライフサイクル全体像

```
1. 親が <Counter /> を render
       ↓
2. Counter 関数が呼ばれる (= レンダリング)
       ↓
3. JSX を return (= React は仮想 DOM を作る)
       ↓
4. React がブラウザの DOM と差分を比較して反映
       ↓
5. useEffect の本体が実行される
       ↓
   ── ユーザ操作 ──
       ↓
6. setCount(...) で state 更新
       ↓
2 に戻る (再レンダリング)
       ↓
   ── 親から外される ──
       ↓
7. useEffect のクリーンアップが呼ばれる
```

---

## 6. Next.js: ファイルベースルーティング

Spring Boot では `@RequestMapping("/users")` をクラスに書くことで URL を割り当てました。Next.js (App Router) は **ファイルパスがそのまま URL になる** という大胆な方式です。

### 6.1 ルーティングのルール

| ファイル                                              | URL                       |
|---------------------------------------------------------|---------------------------|
| `src/app/page.tsx`                                       | `/`                       |
| `src/app/forgot-password/page.tsx`                       | `/forgot-password`        |
| `src/app/share/bucket/[token]/page.tsx`                  | `/share/bucket/{token}`   |
| `src/app/api/auth/login/route.ts`                        | `/api/auth/login`         |
| `src/app/api/todos/[id]/route.ts`                        | `/api/todos/{id}`          |
| `src/app/api/todos/[id]/logs/route.ts`                   | `/api/todos/{id}/logs`     |

### 6.2 特別なファイル名

- **`page.tsx`** … ブラウザに表示する **画面** を返すコンポーネント
- **`route.ts`** … **API エンドポイント** (JSON を返すサーバサイド)
- **`layout.tsx`** … 配下のページ共通の **レイアウト** (Spring のテンプレートのデコレーター)
- **`loading.tsx`** … データ取得中の **読み込み画面**
- **`error.tsx`** … エラー発生時に表示する画面

### 6.3 動的セグメント `[param]`

ファイル名の `[id]` のような **角括弧** はパスパラメータ。Spring の `@PathVariable("id")` に相当。

```ts
// src/app/api/todos/[id]/route.ts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;  // URL の {id} 部分を取り出す
  // ...
}
```

### 6.4 Server Component と Client Component

これは Next.js (というか React) の **重要な分岐点** です。

Next.js のコンポーネントは標準で **サーバ側でレンダリングされて HTML を返す**。これを **Server Component** と呼びます。検索エンジンに優しく、初回表示が速い。

ただし、ボタンを押したらカウントが増える、入力欄に文字を打つ、といった **インタラクティブな処理** はブラウザ側で動かす必要があります。そのためには先頭に **`'use client';`** を書きます。これを **Client Component** と呼びます。

```tsx
'use client';                  // ← この 1 行で Client Component になる

import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

本プロジェクトは UI が動的なので **ほぼ全コンポーネントが Client Component** です ([`src/app/page.tsx`](../src/app/page.tsx) の冒頭にも `'use client';` がある)。

### 6.5 API ルート (`route.ts`)

REST API を書くには `route.ts` を置き、HTTP メソッド名 (大文字) と同じ名前の関数をエクスポート：

```ts
// src/app/api/todos/[id]/route.ts
export async function GET(/* ... */) { return NextResponse.json(...); }
export async function PUT(/* ... */) { return NextResponse.json(...); }
export async function DELETE(/* ... */) { return NextResponse.json(...); }
```

Spring の `@GetMapping` / `@PutMapping` / `@DeleteMapping` がアノテーションの代わりに **関数名そのもの** で表現される、と捉えると分かりやすい。

### 6.6 リクエスト & レスポンス

```ts
export async function POST(request: NextRequest): Promise<NextResponse> {
  // クエリパラメータ: /api/foo?userId=xxx
  const userId: string | null = request.nextUrl.searchParams.get('userId');

  // ボディ (JSON)
  const body: { name: string } = await request.json();

  // レスポンス
  return NextResponse.json({ ok: true });
  // ステータスコードを指定したいとき
  return NextResponse.json({ error: 'invalid' }, { status: 400 });
}
```

---

## 7. JSX とスタイリング

### 7.1 JSX の基本ルール

**JSX** は JavaScript の中に HTML 風の構文を書ける拡張です。React 専用ではないですが、本コードでは React と一緒に使われます。

ルール:
1. **タグは必ず閉じる**。`<br>` ではなく `<br />`、`<img>` ではなく `<img src="..." />`
2. **属性は camelCase**。`class` → `className`、`onclick` → `onClick`、`for` → `htmlFor`
3. **値は文字列または `{...}` で囲んだ JS 式**。`<button onClick={handleClick}>`
4. **複数要素を返すときはルートが 1 つ** 必要。`<>...</>` (フラグメント) で囲む
5. **コメント** は `{/* ... */}`

```tsx
return (
  <div className={styles.card}>
    <h1>{todo.title}</h1>
    {todo.done && <span>✅</span>}
    {/* この行はコメント */}
    {items.map((item) => <li key={item.id}>{item.name}</li>)}
  </div>
);
```

### 7.2 なぜ `className` なのか

`class` は JavaScript の予約語 (ES2015 でクラス宣言に使われる) のため、HTML の `class` 属性とぶつかります。そこで JSX では **`className`** という別名を使います。同じ理由で `for` → `htmlFor`。

### 7.3 CSS Modules

`*.module.css` という名前のファイルを置くと、**Next.js がクラス名をファイルごとに自動でハッシュ化** してくれます。グローバルな名前衝突が起きません。

```css
/* page.module.css */
.primaryBtn { background: blue; color: white; }
```

```tsx
import styles from './page.module.css';

<button className={styles.primaryBtn}>OK</button>
// 実際に出力される class は "page_primaryBtn__a1b2c3" のようなユニークな名前
```

Java で言えば、Maven のサブモジュールごとにクラス名空間が分かれているような感覚。

### 7.4 インラインスタイル

JSX で **直接 CSS を書く** こともできます：

```tsx
<div style={{ display: 'flex', gap: 8, color: 'red' }}>...</div>
```

- 外側の `{}` は「JSX に JS 式を埋め込む」記号
- 内側の `{...}` は **オブジェクトリテラル**
- プロパティ名は **camelCase**。`background-color` → `backgroundColor`
- 値は文字列 (`'red'`) または数値 (`8` → 自動で `'8px'` 解釈)

本コードは CSS Modules と Inline Style を混在させています。

---

## 8. ブラウザ API

サーバ側 (Node.js) と違い、ブラウザにはたくさんの **組み込み API** があります。本コードでよく登場するものを抜粋。

### 8.1 `fetch` — HTTP リクエスト

```ts
const res: Response = await fetch('/api/todos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'foo' }),
});
const data = await res.json();
```

- 戻り値は `Response` オブジェクト。`.json()` でボディを JSON としてパース (これも Promise)
- メソッドは `method` で指定。デフォルトは GET
- ボディは **文字列** で渡す必要があるので `JSON.stringify(...)` する

Java の `HttpClient.send(...)` と同じ感覚。

### 8.2 `localStorage` — ブラウザ内永続化

```ts
localStorage.setItem('kiroku:settings', JSON.stringify(settings));
const raw: string | null = localStorage.getItem('kiroku:settings');
localStorage.removeItem('kiroku:settings');
```

- key/value どちらも **文字列のみ**。オブジェクトを保存するときは `JSON.stringify`
- **同期 API** (Promise ではない)
- ブラウザを閉じても消えない (Cookie より大容量、約 5MB)
- **SSR (サーバサイドレンダリング) では使えない**。`useEffect` の中で使うのが基本

本プロジェクトでは **キー名に `kiroku:` プレフィックス** を付けて他アプリと衝突しないようにしている (例: `kiroku:todos:userId123`)。

### 8.3 `window.setTimeout` / `setInterval` — タイマー

```ts
const id: number = window.setTimeout(() => {
  console.log('1秒後に実行');
}, 1000);

window.clearTimeout(id);  // 取り消し

const intervalId: number = window.setInterval(() => {
  console.log('1秒ごとに実行');
}, 1000);

window.clearInterval(intervalId);
```

Java の `ScheduledExecutorService` 相当。タイマーを使ったら **必ず useEffect のクリーンアップで clear** すること (メモリリーク防止)。

### 8.4 `Notification` — ブラウザ通知

```ts
if (Notification.permission === 'default') {
  await Notification.requestPermission();
}

new Notification('タイトル', { body: '本文' });
```

[`src/app/PomodoroTimer.tsx`](../src/app/PomodoroTimer.tsx) でポモドーロ終了通知に使われています。

### 8.5 `AudioContext` — 音を鳴らす

Web Audio API。サイン波などを合成してアラーム音を出すのに使う。同じく PomodoroTimer 参照。

### 8.6 `Date.now()` — 現在時刻

```ts
const now: number = Date.now();  // 1970-01-01 UTC からの経過ミリ秒
```

Java の `System.currentTimeMillis()` と同じ。

---

## 9. データベースアクセス

ローカル開発では [`data/todos.db`](../data/) (SQLite ファイル) に接続、本番では **Turso** (libsql プロトコルでアクセスする SQLite 互換クラウド DB) に接続します。アクセス入口は [`src/lib/db.ts`](../src/lib/db.ts) の `Db` クラス。

### 9.1 基本的な書き方

```ts
const db = await getDb();

// SELECT 全件
const rows = await db.all<TodoRow>(
  'SELECT * FROM todos WHERE user_id = ?',
  userId,
);

// SELECT 1 件
const row = await db.get<TodoRow>(
  'SELECT * FROM todos WHERE id = ?',
  id,
);

// INSERT / UPDATE / DELETE
await db.run(
  'UPDATE todos SET actual_min = ? WHERE id = ?',
  newActual, id,
);
```

### 9.2 プレースホルダ `?`

文字列連結ではなく **プレースホルダ** で値を渡す。これは Java の `PreparedStatement` と同じく **SQL インジェクション対策**:

```ts
// ❌ 危険: ユーザ入力を直接埋めると 'foo'; DROP TABLE ... が刺さる
await db.run(`SELECT * FROM todos WHERE title = '${title}'`);

// ✅ 安全
await db.all('SELECT * FROM todos WHERE title = ?', title);
```

### 9.3 列名の規約

DB スキーマは **`snake_case`** (例: `actual_min`, `user_id`)、TypeScript 側のオブジェクトは **`camelCase`** (例: `actualMin`, `userId`) を使うのが慣例。両者をつなぐために各 API ルートで **行→オブジェクト** の変換関数を置きます:

```ts
function rowToWorkLog(row: WorkLogRow): WorkLog {
  return {
    id: row.id,
    todoId: row.todo_id,
    content: row.content,
    date: row.date,
    createdAt: row.created_at,
  };
}
```

### 9.4 全部 async

`db.all`、`db.get`、`db.run` はすべて `Promise` を返すので **`await`** する。忘れると `Promise` オブジェクトが入った変数を SQL の結果と勘違いしてバグります。

---

## 10. プロジェクト構造ツアー

```
todo-next/
├── package.json                 # 依存関係とスクリプト定義
├── tsconfig.json                # TypeScript コンパイラ設定
├── next.config.ts               # Next.js 設定
├── data/                        # ローカル SQLite ファイル
├── config/                      # アプリ設定 JSON
├── docs/                        # ドキュメント (本ファイルもここ)
├── public/                      # 静的ファイル (画像など)
└── src/
    ├── app/                     # Next.js App Router 配下
    │   ├── page.tsx             # ルート画面 (ログイン/Welcome) ← 入口
    │   ├── TodoApp.tsx          # ログイン後の本体 (タブ切替・タスク一覧)
    │   ├── layout.tsx           # 全ページ共通レイアウト
    │   ├── api/                 # サーバ側 API (route.ts のフォルダ群)
    │   │   ├── auth/            # ログイン・登録・パスワードリセット等
    │   │   ├── todos/           # タスク CRUD
    │   │   ├── todos/[id]/logs/ # 作業ログ CRUD
    │   │   ├── diary/           # 日記
    │   │   ├── bucket-list/     # やりたいことリスト
    │   │   ├── activity/        # 作業記録の集計
    │   │   └── init/            # 初回まとめ取得 (todos+settings+isPro)
    │   ├── *Panel.tsx           # 各タブの画面 (BucketListPanel, ActivityPanel, ...)
    │   ├── types.ts             # Todo, AppUser, UserSettings などの型定義
    │   ├── utils.ts             # ユーティリティ関数 (uid, parseDeadline, ...)
    │   ├── hooks.ts             # カスタムフック
    │   ├── welcomeMessages.ts   # ログイン時メッセージのデータ
    │   ├── page.module.css      # 共有スタイル
    │   └── globals.css          # グローバル CSS 変数
    ├── lib/
    │   ├── db.ts                # DB クライアントラッパー
    │   ├── refresh.ts           # 日次リフレッシュ (繰り返しタスク生成)
    │   ├── security.ts          # 認証・トークン
    │   └── config.ts            # アプリ全体設定値
    └── test/                    # シードデータ生成スクリプト
```

### 10.1 起動から表示までの流れ

ブラウザが `http://localhost:3000/` を開いた瞬間に何が起きるか：

1. **Next.js サーバが `/` のルートを判定** → [`src/app/page.tsx`](../src/app/page.tsx) を実行
2. **`Page` コンポーネントがレンダリング** → ログイン画面 (または Welcome 画面、または `<TodoApp />`) の HTML を生成
3. **ブラウザが HTML を受け取り表示** + JS バンドルをダウンロード
4. **JS が動き始めて useEffect が走る** → `loadSession()` で `localStorage` を確認
5. **ログイン済みなら** `<TodoApp />` を表示
6. **TodoApp の useEffect が走る** → `GET /api/init?userId=...` でタスク・設定・プロ版状態を一括取得
7. **state が更新されて画面が再描画**

### 10.2 状態管理の場所

本プロジェクトでは **大きな状態管理ライブラリ (Redux, Zustand 等) を使っていません**。代わりに：

- グローバルな状態は **`TodoApp.tsx` の useState 群** で持つ
- 子コンポーネント (`*Panel.tsx`) には **props 経由で渡す**
- 永続化は `localStorage` キャッシュ + DB

---

## 11. 本コードによく出てくるパターン

### 11.1 楽観的更新 + Undo トースト

API のレスポンスを待たずに UI を先に変えて、ユーザの体感速度を上げるパターン。

```ts
// 1. UI を先に変える
setTodos((prev) => prev.filter((t) => t.id !== id));

// 2. 取り消しボタン付きトーストを出す
showUndoToast({
  toastId: uid(),
  todoId: id,
  message: '削除しました',
  undoLabel: '取り消す',
  undo: () => { /* state を元に戻すロジック */ },
});

// 3. バックグラウンドで API を叩く
fetch('/api/todos/' + id, { method: 'DELETE' });
```

万一 API が失敗してもユーザは Undo で戻せる。逆に失敗時に **自動で巻き戻す** ロールバックパターンもあります (例: [`src/app/RecurringPanel.tsx`](../src/app/RecurringPanel.tsx) の `removeRecurrence`)。

### 11.2 localStorage キャッシュ + バックグラウンド再取得

```ts
const [todos, setTodos] = useState<Todo[]>(() => {
  // 1. 初回マウント時にキャッシュから即時復元 (画面が空にならない)
  try {
    const cached = localStorage.getItem('kiroku:todos:' + user.id);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
});

useEffect(() => {
  // 2. 後ろで最新版を fetch して上書き
  fetchTodos();
}, []);
```

これにより、ページリロード後でも **即座に前回の表示が出る**。最新化はバックグラウンド。

### 11.3 sortOrder ベースの並び替え

DnD で順序変更するアイテムは **`sortOrder`** 列を持ち、`10` 刻みで採番します (`0, 10, 20, ...`)。間に挿入するときは隣との中間値 (例: `15`) を使うことで、毎回全件の再採番を避けられます。重複が出てきたら適宜まとめて再採番。

### 11.4 dynamic import (遅延読み込み)

[`src/app/TodoApp.tsx`](../src/app/TodoApp.tsx) 冒頭:
```ts
const BucketListPanel = dynamic(() => import('./BucketListPanel'));
```

これは **そのコンポーネントを実際に表示する瞬間まで JS をロードしない**。最初のページロードを軽くするテク。Java の遅延初期化に近い。

### 11.5 楽観的 + ロールバック

```ts
const original = currentValue;
setState(newValue);  // 楽観的更新

try {
  await api.update(...);
} catch {
  setState(original);  // 失敗したら戻す
}
```

このパターンを多用しているので、API 失敗時の挙動を追うときは「**元の値をどこで控えているか**」を探すとよい。

### 11.6 useEffect のクリーンアップ忘れに注意

タイマー / イベントリスナー / 通知などは **必ずクリーンアップ** を返す:

```ts
useEffect(() => {
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
  //     ↑ クリーンアップ
}, []);
```

これを忘れると、コンポーネントが消えてもタイマーが動き続け、`setState` が呼ばれて警告が出ます。

---

## 12. 開発の動かし方

### 12.1 セットアップ

```bash
npm install      # package.json の依存関係を node_modules/ に展開
```

Maven の `mvn install` 相当。初回のみ実行。

### 12.2 開発サーバ起動

```bash
npm run dev      # next dev を実行 → http://localhost:3000
```

- **ホットリロード** 有効。`*.tsx` を保存するとブラウザが自動で再描画する
- コンソールにエラーが出たらブラウザの DevTools (F12) と合わせて確認

### 12.3 型チェックとビルド

```bash
npx tsc --noEmit  # 型チェックのみ (コンパイル産物を出さない)
npm run build     # 本番ビルド (.next/ に出力)
npm start         # 本番サーバ起動 (要: ビルド済み)
```

`tsc` は TypeScript の公式コンパイラ。`--noEmit` で「型エラーが無いか確認するだけ」モード。

### 12.4 静的解析

```bash
npx eslint src   # ESLint で構文ルール違反を検出
```

未使用変数 / `const` で済むのに `let` を使っている / React のフックの依存配列が足りない、などを警告してくれる。

### 12.5 テストデータ投入

```bash
npm run seed         # 全テストデータ投入
npm run seed:user    # テストユーザのみ
npm run seed:diary   # 日記サンプルのみ
```

中身は [`src/test/`](../src/test/) の TypeScript スクリプトを `tsx` (TypeScript を直接実行するツール) で動かしている。

---

## 13. 学習ロードマップ

Java 経験者がこのコードを完全に理解できるようになる順序の推奨案:

1. **TypeScript の基本** — 公式 [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) の最初の 3 章 (Everyday Types まで)。本ドキュメントの 2 章と併読
2. **JavaScript の async / await と Promise** — Java の `CompletableFuture` の知識を流用しつつ、3 章の例を写経
3. **React の Tutorial** — 公式 [react.dev/learn](https://react.dev/learn) を 1 周。`useState` / `useEffect` をしっかり手で動かす
4. **Next.js App Router の概念** — 公式 [Routing の章](https://nextjs.org/docs/app/building-your-application/routing)
5. **本コードを読む順序**
   1. [`src/app/types.ts`](../src/app/types.ts) — データモデル全体像
   2. [`src/app/page.tsx`](../src/app/page.tsx) — エントリポイント (短い)
   3. [`src/app/utils.ts`](../src/app/utils.ts) — ユーティリティで TS の型注釈に慣れる
   4. [`src/app/api/todos/route.ts`](../src/app/api/todos/route.ts) — シンプルな API ハンドラ
   5. [`src/lib/db.ts`](../src/lib/db.ts) — DB アクセスの抽象化
   6. [`src/app/TodoApp.tsx`](../src/app/TodoApp.tsx) — メインロジック (大きいので必要な部分から)
   7. 個別の `*Panel.tsx` — 興味のある機能から

各ステップで **「手で書く → 動かす → エラーを読む」** のサイクルを回すのが一番速い学習法です。

---

## 14. Java との対比チートシート

| やりたいこと             | Java                              | 本システム                                              |
|--------------------------|------------------------------------|----------------------------------------------------------|
| ログ出力                 | `System.out.println(x)`            | `console.log(x)` / `log('scope', x)`                     |
| 文字列結合               | `"a" + b`                          | `"a" + b` または `` `a${b}` `` (テンプレートリテラル)    |
| Null チェック            | `if (x != null)`                   | `if (x !== undefined && x !== null)` / `x?.foo`          |
| デフォルト値             | `Optional.ofNullable(x).orElse(d)` | `x ?? d`                                                 |
| 配列のループ             | `for (T t : list)`                 | `for (const t of list)` / `list.map(t => ...)`           |
| 配列の filter            | Stream `filter`                    | `list.filter(t => t.active)`                             |
| 文字列 → 数値            | `Integer.parseInt(s)`              | `parseInt(s, 10)` / `Number(s)`                          |
| 例外スロー               | `throw new RuntimeException()`     | `throw new Error(...)`                                    |
| try / catch              | `try { } catch (Exception e)`      | `try { } catch (e: unknown) { ... }`                     |
| HTTP 呼び出し            | `HttpClient.send(...)`             | `await fetch(url, { method, headers, body })`            |
| JSON ↔ オブジェクト     | Jackson `objectMapper`             | `JSON.stringify(obj)` / `JSON.parse(str)`                |
| DTO クラス               | `record Foo(...)`                  | `interface Foo { ... }` / `type Foo = { ... }`           |
| ジェネリクスメソッド     | `<T> T foo(Class<T> c)`            | `function foo<T>(...): T`                                 |
| 不変変数                 | `final int x = 0`                  | `const x: number = 0`                                    |
| 可変変数                 | `int x = 0`                        | `let x: number = 0`                                      |
| 配列宣言                 | `int[] arr` / `List<Integer>`      | `number[]` / `Array<number>`                             |
| Map                      | `Map<String, Integer>`             | `Record<string, number>` / `Map<string, number>`         |
| static フィールド        | `class C { static int x; }`        | モジュールの `const x: number = ...` (= 1 ファイル単位)  |
| package-private          | (default アクセス)                  | export しないこと (ファイル内に閉じる)                   |
| import                   | `import com.foo.Bar;`              | `import { Bar } from './foo';`                           |

---

## 15. 用語集

- **コンポーネント (component)** … 画面の一部を描画する関数。JSX を返す
- **props** … 親から子コンポーネントに渡される読み取り専用の引数
- **state** … コンポーネントが内部で持つ可変データ。変えると再描画
- **JSX** … JavaScript の中に HTML 風の構文を書ける拡張
- **フック (hook)** … 関数コンポーネントで状態や副作用を扱う関数。`use*` の名前
- **副作用 (side effect)** … fetch / タイマー / DOM 操作 / ログ出力など、レンダリングそのもの以外の処理
- **マウント (mount)** … コンポーネントが最初に描画されること
- **アンマウント (unmount)** … コンポーネントが画面から消えること
- **レンダリング (render)** … コンポーネント関数を実行して JSX を作ること
- **再描画 (re-render)** … state や props が変わって再度レンダリングされること
- **依存配列 (dependency array)** … `useEffect` などフックの第 2 引数の配列。変化を検知するキー
- **Promise** … 「将来値が決まる箱」。Java の `CompletableFuture` 相当
- **async / await** … Promise を同期っぽく書く構文
- **モジュール (module)** … 1 ファイル = 1 モジュール。`export` で公開、`import` で取り込む
- **型注釈 (type annotation)** … `: number` のように型を明示する記述
- **型推論 (type inference)** … 型注釈が無いとき TypeScript が自動で型を決めること
- **構造的型付け (structural typing)** … 形が同じなら型互換と判断する仕組み
- **App Router** … Next.js のファイルベースルーティング (`src/app/` 配下)
- **Client Component / Server Component** … ブラウザで動くか、サーバで動くか
- **CSS Modules** … クラス名がファイル単位で自動ハッシュ化される CSS
- **CRUD** … Create / Read / Update / Delete の頭文字
- **DnD** … Drag and Drop
- **DOM** … Document Object Model。ブラウザがページを表現する木構造

---

## 16. Java 経験者がよくつまずくポイント FAQ

### Q1. なぜ `class` ではなく関数でコンポーネントを書くの?

React も以前は **クラスコンポーネント** がありましたが、複雑になりやすいので **関数コンポーネント + フック** が現在の標準になりました。Java の世界での「OOP の代わりに関数型を選ぶ」決断に近い。本コードはすべて関数コンポーネントです。

### Q2. `setState` で値を変えてもすぐに反映されないのはなぜ?

```ts
setCount(count + 1);
console.log(count);  // ← まだ古い値が出る
```

`useState` の更新は **次のレンダリング** で反映されるため、同じ関数の中では古い値のまま。Java で言うと「フィールドの値が次のイベントループから有効」のような遅延。新しい値を使いたい時は **関数形式の setter** を使う:

```ts
setCount((prev) => prev + 1);
```

### Q3. `useEffect` の依存配列を空にしたら何度も呼ばれるって本当?

- **空配列 `[]`** → マウント時 1 回のみ (Java の `@PostConstruct`)
- **依存配列を省略** → 毎回のレンダリングで呼ばれる (基本やってはいけない)
- **依存配列に値あり** → その値が変わったときだけ呼ばれる

### Q4. `await` するとブラウザが固まる?

固まりません。`await` は JS の単一スレッドを **解放** するだけで、ブロックしません。むしろ「重い同期計算」(for ループで CPU を使い切る等) のほうがブラウザを固めます。

### Q5. `localStorage` が `window is not defined` エラーになるのはなぜ?

Next.js は **サーバサイドで先に HTML を生成** するため、その時点ではブラウザの `window` や `localStorage` が存在しません。これらを使うコードは **`useEffect` の中** に書いて、ブラウザ側でだけ走るようにします:

```ts
useEffect(() => {
  const saved = localStorage.getItem('kiroku:settings');
  // ...
}, []);
```

### Q6. 配列の `map` の `key` を忘れたら何が起きる?

React がコンソール警告を出します。さらに、要素の順序変更や挿入で **既存の DOM が誤って使い回される** ことがあり、入力欄の文字が他の行に移動する、といった怪奇現象が起きます。**必ず一意な ID を `key` に**。

### Q7. `useState` の初期値に重い計算をしたくない

`useState(heavyCompute())` だと **毎レンダーで計算** されてしまいます (戻り値だけ使われるが計算自体は走る)。これを避けるには **関数を渡す**:

```ts
const [todos, setTodos] = useState<Todo[]>(() => {
  return JSON.parse(localStorage.getItem('kiroku:todos') ?? '[]');
});
```

関数形式で渡すと **初回マウント時のみ呼ばれる**。

### Q8. `const arr = [1,2,3]; arr.push(4);` できるのはなぜ?

`const` は **変数の再代入** を禁止するだけで、**指している先のオブジェクトの中身** は変更可能。Java の `final` と全く同じ。中身も変えたくない場合は readonly 型注釈や `Object.freeze` を使うか、新しい配列を作って差し替える慣習。

### Q9. なぜ本コードでは `setTodos((prev) => ...)` という形式を多用するの?

`setTodos(newArr)` だと、**同じレンダリング内で複数回 setState** すると最後の値しか反映されない。関数形式なら **前回の値からの差分** を正しく積み重ねられる。慣れたら関数形式をデフォルトに使うのが安全。

### Q10. JSX で `if` 文が書けないと言われたら?

JSX の `{...}` の中は **式** しか入りません。`if` 文 (statement) はそのままでは使えない。**三項演算子**、`&&`、`||`、あるいは外側に取り出すかします:

```tsx
// ❌
{ if (user) <Dashboard /> }

// ✅
{ user ? <Dashboard /> : <LoginForm /> }
{ user && <Dashboard /> }
```

または事前に変数に詰める:
```tsx
const content = user ? <Dashboard /> : <LoginForm />;
return <main>{content}</main>;
```

---

ここまで読めば、本コードの大半は「**何のためにどう書かれているか**」が追えるはずです。詰まったら本ドキュメントの該当章へ戻ってください。新しい概念に出会ったら、まずこのファイルを Ctrl+F で検索するのもおすすめです。
