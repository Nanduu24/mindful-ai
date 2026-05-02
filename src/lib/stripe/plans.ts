// src/lib/stripe/plans.ts
export const PLANS = {
    free: {
      name: "Free",
      sessions_per_month: 5,
      features: ["5 sessions/month", "Text chat", "Basic memory"],
      price_id: null,
      amount: 0,
    },
    pro: {
      name: "Pro",
      sessions_per_month: -1,
      features: [
        "Unlimited sessions",
        "Cross-session memory",
        "Mood tracking",
        "Priority responses",
      ],
      price_id: process.env.STRIPE_PRO_PRICE_ID,
      amount: 1900,
    },
    premium: {
      name: "Premium",
      sessions_per_month: -1,
      features: [
        "Everything in Pro",
        "Voice mode",
        "Advanced insights",
        "Export sessions",
      ],
      price_id: process.env.STRIPE_PREMIUM_PRICE_ID,
      amount: 3900,
    },
  } as const;
  
  export type PlanType = keyof typeof PLANS;