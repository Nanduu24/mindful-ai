// src/app/page.tsx
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/chat");

  return (
    <main className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50">
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <span className="text-xl font-semibold text-teal-700">🧠 Mindful AI</span>
        <div className="flex gap-3">
          <Link
            href="/sign-in"
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      <section className="max-w-3xl mx-auto px-8 pt-24 pb-16 text-center">
        <div className="inline-block px-3 py-1 text-xs font-medium bg-teal-100 text-teal-700 rounded-full mb-6">
          AI-powered mental health support
        </div>
        <h1 className="text-5xl font-semibold text-gray-900 leading-tight mb-6">
          A therapist that&apos;s always
          <span className="text-teal-600"> here for you</span>
        </h1>
        <p className="text-xl text-gray-500 leading-relaxed mb-10">
          Evidence-based CBT and DBT techniques, cross-session memory that
          remembers your journey, and voice support — available 24/7.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/sign-up"
            className="px-8 py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors text-base"
          >
            Start for free
          </Link>
          <Link
            href="/sign-in"
            className="px-8 py-3.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:border-gray-300 transition-colors text-base"
          >
            Sign in
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Not a substitute for professional medical care.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-8 pb-24 grid grid-cols-3 gap-6">
        {[
          {
            icon: "💬",
            title: "Always available",
            desc: "24/7 access to evidence-based support whenever you need it.",
          },
          {
            icon: "🧠",
            title: "Remembers you",
            desc: "Cross-session memory tracks your progress and patterns over time.",
          },
          {
            icon: "🔒",
            title: "Private & secure",
            desc: "End-to-end encrypted. Your conversations are never sold.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
          >
            <div className="text-2xl mb-3">{f.icon}</div>
            <h3 className="font-medium text-gray-900 mb-1">{f.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}