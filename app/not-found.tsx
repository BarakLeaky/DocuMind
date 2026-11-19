import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center text-center">
      <div>
        <p className="text-sm text-dim">404</p>
        <h1 className="mt-1 text-2xl font-semibold">Page not found</h1>
        <Link href="/dashboard" className="mt-4 inline-block text-brand hover:underline">Back to dashboard</Link>
      </div>
    </main>
  );
}
