import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Visão geral" },
  { href: "/dashboard/accounts", label: "Contas" },
  { href: "/dashboard/scheduler", label: "Agendamentos" },
  { href: "/dashboard/media", label: "Biblioteca de mídia" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-1">
      <aside className="hidden w-60 flex-col border-r border-neutral-800 px-4 py-6 sm:flex">
        <span className="mb-8 px-2 text-lg font-semibold tracking-tight">InstaHot</span>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 px-2 pt-6">
          <span className="truncate text-xs text-neutral-500">{session.user.email}</span>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button className="text-sm text-neutral-400 hover:text-white">Sair</button>
          </form>
        </div>
      </aside>

      <main className="flex-1 px-6 py-8 sm:px-10">{children}</main>
    </div>
  );
}
