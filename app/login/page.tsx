import HelixLogo from "../_components/HelixLogo";
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
        <div className="mb-6">
          <HelixLogo size="md" subtitle="Peptide Protocol" />
        </div>
        <LoginForm from={params.from ?? "/"} />
      </div>
    </main>
  );
}
