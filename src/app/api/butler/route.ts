import { NextRequest, NextResponse } from 'next/server';

/**
 * 執事の励ましメッセージを生成AIで生成する
 * Google Gemini API（無料枠あり）を使用
 * 環境変数 GEMINI_API_KEY が設定されていない場合はフォールバックメッセージを返す
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: {
    userPrompt?: string;
    maxChars?: number;
    taskSummary?: string;
  } = await request.json();

  const userPrompt: string = body.userPrompt ?? '';
  const maxChars: number = body.maxChars ?? 80;
  const taskSummary: string = body.taskSummary ?? '';

  const apiKey: string | undefined = process.env.GEMINI_API_KEY;

  // タスクサマリーから合計数と達成数を抽出
  const totalMatch: RegExpMatchArray | null = taskSummary.match(/全(\d+)件/);
  const doneMatch: RegExpMatchArray | null = taskSummary.match(/完了(\d+)件/);
  const totalCount: number = totalMatch ? Number(totalMatch[1]) : 0;
  const doneCount: number = doneMatch ? Number(doneMatch[1]) : 0;
  const remainCount: number = totalCount - doneCount;

  // APIキーがない場合はタスク状況ベースのフォールバック
  if (!apiKey) {
    let msg: string;
    if (totalCount === 0) {
      msg = 'まだタスクが登録されていません。まずは今日やることを1つ追加してみましょう。小さな一歩が大きな成果につながりますよ！';
    } else if (doneCount === totalCount) {
      msg = `全${totalCount}件のタスクをすべて達成しました！素晴らしい成果です。今日のあなたは本当に頑張りましたね。ゆっくり休んで、また明日も一緒に頑張りましょう！`;
    } else {
      const fallbacks: string[] = [
        `全${totalCount}件中${doneCount}件達成、残り${remainCount}件です。着実に進んでいますね！まずは一番優先度が高いものから手をつけてみましょう。一つずつ片付ければゴールは近いですよ。`,
        `${doneCount}/${totalCount}件完了しています。あと${remainCount}件、あなたならきっとやり遂げられます！取り組みやすいタスクから始めて、リズムを作っていきましょう。応援しています。`,
        `現在${doneCount}件達成、残り${remainCount}件です。今日もよく頑張っていますね。期限が近いタスクがあれば、そちらを優先して進めましょう。計画的に取り組めば余裕を持って完了できますよ！`,
        `${totalCount}件中${doneCount}件クリア！残り${remainCount}件も一つずつ確実にこなしていきましょう。休憩も大切にしながら、自分のペースで大丈夫ですよ。あなたのことを応援しています！`,
        `全${totalCount}件のうち${doneCount}件が完了しました。残り${remainCount}件、焦らず着実に進めていきましょう。小さな進捗の積み重ねが大きな成果になります。あなたなら大丈夫です！`,
      ];
      const idx: number = Math.floor(Math.random() * fallbacks.length);
      msg = fallbacks[idx];
    }
    return NextResponse.json({ message: msg.slice(0, maxChars) });
  }

  try {
    const minChars: number = Math.floor(maxChars * 0.8);
    const systemInstruction: string = [
      'あなたはユーザーの秘書です。',
      'ユーザーがやる気になるように励ましつつ、タスクの優先順位や合計所要時間などをサジェストしてください。',
      `必ず${minChars}文字以上${maxChars}文字以内で返してください。短すぎると不十分です。`,
      '余計な前置きは不要です。メッセージだけを返してください。',
    ].join('');

    const userMessage: string = [
      '【本日のタスク状況】',
      taskSummary,
      '',
      userPrompt ? `【ユーザーからの追加指示】${userPrompt}` : '',
    ].join('\n');

    const url: string = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const res: Response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.8,
        },
      }),
    });

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const trimmed: string = text.trim().slice(0, maxChars);

    const fallbackOnEmpty: string = totalCount > 0
      ? `全${totalCount}件中${doneCount}件達成です。残り${remainCount}件、あなたならきっとやり遂げられます！`
      : 'あなたならきっとできます。頑張りましょう！';
    return NextResponse.json({ message: trimmed || fallbackOnEmpty });
  } catch {
    const errorFallback: string = totalCount > 0
      ? `全${totalCount}件中${doneCount}件達成。残り${remainCount}件、自分のペースで大丈夫ですよ。応援しています！`
      : '今日も一日頑張りましょう！あなたのペースで大丈夫です。';
    return NextResponse.json({
      message: errorFallback,
    });
  }
}
