// src/app/api/stripe/webhook/route.ts
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[webhook] Invalid signature", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const getDbUserByCustomer = async (customerId: string) => {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .single();
    return data;
  };

  // Helper to safely extract period end from a subscription
  const getPeriodEnd = (sub: Stripe.Subscription): string | null => {
    // Newer API uses items.data[0].current_period_end
    const item = sub.items?.data?.[0] as Stripe.SubscriptionItem & {
      current_period_end?: number;
    };
    const periodEnd =
      item?.current_period_end ??
      (sub as Stripe.Subscription & { current_period_end?: number })
        .current_period_end;
    return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.subscription || !session.customer) break;

      const sub = await stripe.subscriptions.retrieve(
        session.subscription as string
      );
      const dbUser = await getDbUserByCustomer(session.customer as string);
      if (!dbUser) break;

      const plan =
        sub.items.data[0].price.id === process.env.STRIPE_PRO_PRICE_ID
          ? "pro"
          : "premium";

      await supabaseAdmin
        .from("users")
        .update({
          subscription_tier: plan,
          stripe_subscription_id: sub.id,
          subscription_status: "active",
          subscription_period_end: getPeriodEnd(sub),
        })
        .eq("id", dbUser.id);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string;
      };
      if (!invoice.subscription || !invoice.customer) break;

      const sub = await stripe.subscriptions.retrieve(invoice.subscription);
      const dbUser = await getDbUserByCustomer(invoice.customer as string);
      if (!dbUser) break;

      await supabaseAdmin
        .from("users")
        .update({
          subscription_status: "active",
          subscription_period_end: getPeriodEnd(sub),
        })
        .eq("id", dbUser.id);
      break;
    }

    case "invoice.payment_failed":
    case "customer.subscription.deleted": {
      const obj = event.data.object as
        | (Stripe.Invoice & { customer?: string })
        | Stripe.Subscription;
      const customerId = obj.customer as string;
      if (!customerId) break;

      const dbUser = await getDbUserByCustomer(customerId);
      if (!dbUser) break;

      await supabaseAdmin
        .from("users")
        .update({
          subscription_tier: "free",
          subscription_status: "inactive",
        })
        .eq("id", dbUser.id);
      break;
    }
  }

  return Response.json({ received: true });
}