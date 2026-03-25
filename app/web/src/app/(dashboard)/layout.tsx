export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen">
      <nav className="w-64 border-r bg-background p-4">
        <div className="mb-8">
          <h1 className="text-xl font-bold">DeepShift OS</h1>
        </div>
        <ul className="space-y-2">
          <li><a href="/crm" className="block rounded px-3 py-2 hover:bg-muted">CRM & Prospection</a></li>
          <li><a href="/projets" className="block rounded px-3 py-2 hover:bg-muted">Projets</a></li>
          <li><a href="/finance" className="block rounded px-3 py-2 hover:bg-muted">Finance</a></li>
          <li><a href="/admin" className="block rounded px-3 py-2 hover:bg-muted">Admin</a></li>
          <li><a href="/agenda" className="block rounded px-3 py-2 hover:bg-muted">Agenda & IA</a></li>
        </ul>
      </nav>
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  )
}
