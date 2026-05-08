import Image from 'next/image'
import Link from 'next/link'
import { getServerSession } from 'next-auth'

import { Button } from '@/components/ui/button'
import { authOptions } from '@/lib/auth'

export default async function MarketingHomePage(): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)

  return (
    <main className="container flex flex-col items-center justify-center gap-8 py-16 text-center">
      <div className="max-w-2xl space-y-6">
        <Image
          src="/Assets/hidrosync_logo_name.png"
          alt="HidroSync"
          width={480}
          height={160}
          className="mx-auto h-auto w-full max-w-md"
          priority
        />
        <h1 className="text-3xl md:text-4xl font-extrabold text-hidrostone">
          Leitura inteligente de hidrômetros para o seu condomínio
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">
          Centraliza leituras, revisão, consumo e exportação para o sistema de cobrança — com rastreabilidade e
          auditoria.
        </p>
      </div>
      {session?.user ? null : (
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button asChild variant="outline" className="rounded-[4px] border-hidrostone text-hidrostone">
            <Link href="/?login=1">Entrar</Link>
          </Button>
        </div>
      )}
    </main>
  )
}
