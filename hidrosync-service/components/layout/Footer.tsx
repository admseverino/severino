import Link from 'next/link'

import { cn } from '@/lib/utils'

export function Footer({ fixed = false }: { fixed?: boolean }): React.JSX.Element {
  return (
    <footer
      className={cn(
        'w-full max-w-full',
        fixed ? 'fixed bottom-0 left-0 right-0 z-40' : 'relative z-10 mt-auto'
      )}
    >
      <div className="bg-black py-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 px-4">
        <p className="text-gray-400 text-center font-normal text-[10px] md:text-xs">
          © {new Date().getFullYear()} HidroSync. Todos os direitos reservados.
        </p>
        <span className="hidden sm:block text-gray-700 text-xs">·</span>
        <Link
          href="/login"
          className="text-gray-400 hover:text-white transition-colors text-[10px] md:text-xs underline underline-offset-2"
        >
          Acesso
        </Link>
      </div>
    </footer>
  )
}
