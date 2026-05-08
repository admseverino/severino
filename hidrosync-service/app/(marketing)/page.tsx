import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function MarketingHomePage(): React.JSX.Element {
  return (
    <main className="container flex flex-col items-center justify-center gap-8 py-16 text-center">
      <div className="max-w-2xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-hidrogreen">HidroSync</p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-hidrostone">
          Leitura inteligente de hidrômetros para o seu condomínio
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">
          Centraliza leituras, revisão, consumo e exportação para o sistema de cobrança — com rastreabilidade e
          auditoria.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button
          asChild
          className="rounded-[4px] bg-white text-black hover:bg-gray-100 font-bold uppercase px-8 py-6"
        >
          <Link href="/?login=1">Acessar painel</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-[4px] border-hidrostone text-hidrostone">
          <Link href="/?login=1">Entrar</Link>
        </Button>
      </div>
    </main>
  )
}
