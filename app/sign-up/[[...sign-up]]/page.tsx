import type { Metadata } from "next";
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="flex flex-col items-center gap-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">DocuMind</Link>
        <SignUp fallbackRedirectUrl="/dashboard" signInUrl="/sign-in" />
      </div>
    </main>
  );
}
