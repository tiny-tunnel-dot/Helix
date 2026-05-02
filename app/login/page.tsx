import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Helix</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Peptide protocol tracker
        </p>
        <LoginForm from={params.from ?? "/"} />
      </div>
    </main>
  );
}
