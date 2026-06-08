"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Não foi possível criar a conta.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      router.push("/login");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900/50 p-8">
        <h1 className="mb-6 text-xl font-semibold">Criar conta</h1>

        <label className="mb-1 block text-sm text-neutral-400">Nome</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-400"
        />

        <label className="mb-1 block text-sm text-neutral-400">E-mail</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-400"
        />

        <label className="mb-1 block text-sm text-neutral-400">Senha</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-400"
        />

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-white px-4 py-2 font-medium text-neutral-900 hover:bg-neutral-200 disabled:opacity-50"
        >
          {loading ? "Criando..." : "Criar conta"}
        </button>

        <p className="mt-4 text-center text-sm text-neutral-400">
          Já tem conta? <Link href="/login" className="text-white underline">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
