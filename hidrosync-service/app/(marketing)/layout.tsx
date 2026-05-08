import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { NavigationMenu } from '@/components/layout/NavigationMenu'

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const showGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header showGoogle={showGoogle} />
      <NavigationMenu />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}
