// src/app/pricing/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { PLANS } from "@/lib/stripe/plans";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const { isSignedIn } = useAuth();

  const handleUpgrade = async (plan: "pro" | "premium") => {
    if (!isSignedIn) {
      router.push("/sign-in?redirect_url=/pricing");
      return;
    }

    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <button
            onClick={() => router.push("/chat")}
            className="text-sm text-teal-600 hover:text-teal-700 mb-4"
          >
            ← Back to chat
          </button>
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-gray-500">
            Start free. Upgrade when you need more.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(Object.entries(PLANS) as [string, typeof PLANS[keyof typeof PLANS]][]).map(
            ([key, plan]) => (
              <div
                key={key}
                className={cn(
                  "bg-white rounded-2xl p-6 border shadow-sm flex flex-col",
                  key === "pro"
                    ? "border-teal-400 ring-2 ring-teal-100"
                    : "border-gray-100"
                )}
              >
                {key === "pro" && (
                  <div className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded-full w-fit mb-4">
                    Most popular
                  </div>
                )}
                <h2 className="text-lg font-semibold text-gray-900">
                  {plan.name}
                </h2>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold text-gray-900">
                    ${plan.amount / 100}
                  </span>
                  <span className="text-gray-400 text-sm">/month</span>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2 text-sm text-gray-600"
                    >
                      <span className="text-teal-500">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                {key === "free" ? (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => router.push(isSignedIn ? "/chat" : "/sign-up")}
                  >
                    {isSignedIn ? "Current plan" : "Get started free"}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade(key as "pro" | "premium")}
                    disabled={loading === key}
                  >
                    {loading === key
                      ? "Loading..."
                      : `Upgrade to ${plan.name}`}
                  </Button>
                )}
              </div>
            )
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          14-day free trial on Pro and Premium. Cancel anytime.
        </p>
      </div>
    </div>
  );
}