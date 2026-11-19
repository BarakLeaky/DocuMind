"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const forbidden = error.message.startsWith("Missing permission");
  return (
    <main className="grid min-h-[60vh] place-items-center p-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">{forbidden ? "You don't have access to this page" : "Something went wrong"}</h1>
        <p className="text-sm text-dim">{forbidden ? "Ask a workspace administrator to update your role." : "The error has been reported. You can try again."}</p>
        {!forbidden && <Button onClick={reset}>Try again</Button>}
      </div>
    </main>
  );
}
