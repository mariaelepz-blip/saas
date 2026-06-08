import Link from "next/link";

const FEATURES = [
  {
    title: "Contas com status real",
    description: "Veja na hora se cada conta está ativa, com token expirado ou sob restrição da Meta — tudo sincronizado via Graph API.",
  },
  {
    title: "Esteira de aquecimento",
    description: "Plano gradual de volume e frequência de publicações para novas contas, dentro dos limites oficiais da plataforma.",
  },
  {
    title: "Agendamento de Feed, Reels e Stories",
    description: "Organize sua produção em um calendário e deixe a publicação acontecer automaticamente no horário certo.",
  },
  {
    title: "Variações anti-duplicidade",
    description: "Espelhamento inteligente (preservando textos na tela), filtros leves, cortes e variações de velocidade para cada conta.",
  },
  {
    title: "Métricas centralizadas",
    description: "Acompanhe seguidores, alcance e impressões de todas as contas em um só painel.",
  },
  {
    title: "Alertas e notificações",
    description: "Seja avisado quando um token estiver para expirar, uma publicação falhar ou uma conta precisar de atenção.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <header className="border-b border-neutral-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">InstaHot</span>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-neutral-300 hover:text-white">Entrar</Link>
            <Link href="/register" className="rounded-md bg-white px-4 py-2 font-medium text-neutral-900 hover:bg-neutral-200">
              Criar conta
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto flex max-w-6xl flex-1 flex-col gap-20 px-6 py-16">
        <section className="flex flex-col gap-6">
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Gerencie sua operação de Instagram com contas conectadas oficialmente, agendamento e conteúdo único por conta.
          </h1>
          <p className="max-w-xl text-lg text-neutral-400">
            Conecte contas Business/Creator via login oficial da Meta, acompanhe o status de cada uma,
            organize a esteira de aquecimento, agende publicações e gere variações de vídeo para evitar
            conteúdo duplicado entre contas.
          </p>
          <div className="flex gap-3">
            <Link href="/register" className="rounded-md bg-white px-6 py-3 font-medium text-neutral-900 hover:bg-neutral-200">
              Começar agora
            </Link>
            <Link href="/login" className="rounded-md border border-neutral-700 px-6 py-3 font-medium text-neutral-200 hover:border-neutral-500">
              Já tenho conta
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
              <h3 className="mb-2 font-semibold">{feature.title}</h3>
              <p className="text-sm text-neutral-400">{feature.description}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 text-sm text-neutral-400">
          <strong className="text-neutral-200">Importante:</strong> a conexão das contas é feita exclusivamente
          pelo login oficial da Meta (OAuth) para contas Instagram Business/Creator vinculadas a uma Página do
          Facebook, conforme a Instagram Graph API. Não oferecemos login com usuário/senha nem automações que
          simulem comportamento humano — práticas assim violam os Termos da Meta e podem banir suas contas.
        </section>
      </main>

      <footer className="border-t border-neutral-800 py-6 text-center text-sm text-neutral-500">
        InstaHot — feito para operações sérias de conteúdo no Instagram.
      </footer>
    </div>
  );
}
