// src/app/(auth)/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-white">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Start your journey
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Free to start — no credit card required
          </p>
        </div>
        <SignUp />
      </div>
    </main>
  );
}