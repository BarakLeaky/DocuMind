import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { BrainCircuit, FileText, ListChecks, ShieldCheck, Terminal } from "lucide-react";

export const dynamic = "force-dynamic";

const POINTS = [
  { icon: FileText, title: "Upload PDFs, Word and text files", body: "DocuMind reads each file, splits it into passages and makes it searchable within about a minute." },
  { icon: Terminal, title: "Ask in plain language", body: "The AI console answers from your documents only, and every claim links to the document and page it came from." },
  { icon: ListChecks, title: "Check the details that matter", body: "Dates, parties, amounts and other key fields are pulled out for you to approve or reject, with a confidence score." },
  { icon: ShieldCheck, title: "Private to your workspace", body: "Each account has its own workspace. Nobody else can search, read or download what you upload." },
];

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex h-16 items-center justify-between">
        <span className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-brand/15 text-brand ring-1 ring-brand/40"><BrainCircuit className="size-5" /></span>
          DocuMind
        </span>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/sign-in" className="rounded-lg px-3 py-2 text-dim hover:text-foreground">Sign in</Link>
          <Link href="/sign-up" className="rounded-lg bg-brand px-4 py-2 font-medium text-primary-foreground hover:bg-brand-strong">Create account</Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col justify-center py-16">
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          Ask your documents.<br />Get answers you can check.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-dim">
          Upload contracts, invoices, policies and reports. DocuMind finds the exact passage that answers your question and shows you where it came from.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/sign-up" className="neon-edge rounded-lg bg-brand px-5 py-3 font-medium text-primary-foreground hover:bg-brand-strong">Create your workspace</Link>
          <Link href="/sign-in" className="rounded-lg border border-line px-5 py-3 font-medium hover:border-brand/50">Sign in</Link>
        </div>

        <ul className="mt-20 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/25"><Icon className="size-4" /></span>
              <div>
                <h2 className="font-semibold tracking-tight">{title}</h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-dim">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </main>

      <footer className="border-t border-line py-6 text-xs text-dim">© {new Date().getFullYear()} DocuMind</footer>
    </div>
  );
}
