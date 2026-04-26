// src/app/(auth)/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-white">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-1">
            Sign in to continue your journey
          </p>
        </div>
        <SignIn />
      </div>
    </main>
  );
}