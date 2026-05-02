// src/app/api/stripe/checkout/route.ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe/client";
import { PLANS } from "@/lib/stripe/plans";
import { syncUser } from "@/lib/supabase/sync-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  plan: z.enum(["pro", "premium"]),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const { plan } = schema.parse(body);

    const clerkUser = await currentUser();
    if (!clerkUser) return new Response("User not found", { status: 404 });

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const dbUser = await syncUser(
      userId,
      email,
      clerkUser.firstName ?? undefined
    );

    // Get or create Stripe customer
    let customerId: string;
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("stripe_customer_id")
      .eq("id", dbUser.id)
      .single();

    if (userData?.stripe_customer_id) {
      customerId = userData.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { clerk_id: userId, db_user_id: dbUser.id },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", dbUser.id);
    }

    const planDetails = PLANS[plan];

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: planDetails.price_id!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/chat?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      subscription_data: {
        trial_period_days: 14,
        metadata: { clerk_id: userId, db_user_id: dbUser.id },
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("[stripe/checkout]", error);
    return new Response("Internal server error", { status: 500 });
  }
}