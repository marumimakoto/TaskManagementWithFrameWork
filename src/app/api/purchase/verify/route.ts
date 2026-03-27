import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import Stripe from 'stripe';
import crypto from 'crypto';

/**
 * Stripe Checkoutセッションの決済完了を確認し、DBに購入記録を保存する
 * 決済成功画面からクライアントが呼び出す
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const sessionId: string = body.sessionId;
    const userId: string = body.userId;

    if (!sessionId || !userId) {
      return NextResponse.json({ error: 'sessionId and userId required' }, { status: 400 });
    }

    const stripeSecretKey: string | undefined = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe: Stripe = new Stripe(stripeSecretKey);

    // Stripeに決済完了を確認
    const session: Stripe.Checkout.Session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'payment not completed' }, { status: 400 });
    }

    // metadataのuserIdと一致するか確認（なりすまし防止）
    if (session.metadata?.userId !== userId) {
      return NextResponse.json({ error: 'userId mismatch' }, { status: 403 });
    }

    const db = await getDb();

    // 既に記録済みか確認
    const existing = await db.get<{ id: string }>(
      'SELECT id FROM user_purchases WHERE user_id = ?',
      userId
    );
    if (existing) {
      return NextResponse.json({ isPro: true, message: 'already recorded' });
    }

    // 購入記録を保存
    const purchaseId: string = crypto.randomUUID();
    await db.run(
      'INSERT INTO user_purchases (id, user_id, stripe_session_id, purchased_at) VALUES (?, ?, ?, ?)',
      purchaseId,
      userId,
      sessionId,
      Date.now()
    );

    return NextResponse.json({ isPro: true, message: 'purchase recorded' });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
