import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import Stripe from 'stripe';

/**
 * プロ版の購入状態を確認する
 * 管理者ユーザー（role='admin'）は自動的にプロ版扱い
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId: string | null = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const db = await getDb();

    // 管理者チェック
    const user = await db.get<{ role: string }>(
      'SELECT role FROM users WHERE id = ?',
      userId
    );
    if (user?.role === 'admin') {
      return NextResponse.json({ isPro: true, reason: 'admin' });
    }

    // 購入チェック
    const purchase = await db.get<{ id: string }>(
      'SELECT id FROM user_purchases WHERE user_id = ?',
      userId
    );

    return NextResponse.json({ isPro: !!purchase });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Stripe Checkoutセッションを作成する
 * ユーザーを決済画面にリダイレクトするためのURLを返す
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const userId: string = body.userId;
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const db = await getDb();

    // 既に購入済みか確認
    const existing = await db.get<{ id: string }>(
      'SELECT id FROM user_purchases WHERE user_id = ?',
      userId
    );
    if (existing) {
      return NextResponse.json({ error: 'already purchased' }, { status: 400 });
    }

    // 管理者は購入不要
    const user = await db.get<{ role: string }>(
      'SELECT role FROM users WHERE id = ?',
      userId
    );
    if (user?.role === 'admin') {
      return NextResponse.json({ error: 'admin does not need to purchase' }, { status: 400 });
    }

    const stripeSecretKey: string | undefined = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe: Stripe = new Stripe(stripeSecretKey);

    const origin: string = request.nextUrl.origin;

    const session: Stripe.Checkout.Session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: 'タスク管理アプリ プロ版',
              description: 'ポモドーロ・アイゼンハワーマトリクス・パレート分析など全機能を解放',
            },
            unit_amount: 300,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}?purchase=cancel`,
      metadata: {
        userId: userId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
