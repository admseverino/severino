import Image from 'next/image'
import Link from 'next/link'

export function Footer(): React.JSX.Element {
  return (
    <footer className="w-full mt-auto relative z-50">
      <div className="bg-hidrostone py-3 md:py-4 flex items-center justify-center relative px-4">
        <div className="w-[120px] h-[36px] md:w-[160px] md:h-[48px] relative">
          <Image
            src="/Assets/hidrosync_logo.png"
            alt="HidroSync"
            fill
            className="object-contain brightness-0 invert"
            priority={false}
          />
        </div>
      </div>

      <div className="bg-black py-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 border-t border-gray-800 px-4">
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
