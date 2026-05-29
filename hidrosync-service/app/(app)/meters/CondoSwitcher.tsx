'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CondoSwitcherProps {
  condos: { slug: string; name: string }[]
  currentSlug: string
}

/**
 * Lightweight, URL-driven condo selector — only renders when the user has access to >1 condo.
 * Writes `?condo=<slug>` into the meters route; the server page re-fetches from the new slug.
 */
export function CondoSwitcher({ condos, currentSlug }: CondoSwitcherProps): React.JSX.Element {
  const router = useRouter()
  const params = useSearchParams()

  const handleChange = (next: string): void => {
    if (next === currentSlug) return
    const sp = new URLSearchParams(params.toString())
    sp.set('condo', next)
    router.replace(`?${sp.toString()}`)
  }

  return (
    <Select value={currentSlug} onValueChange={handleChange}>
      <SelectTrigger
        size="sm"
        className="w-[220px] rounded-[4px]"
        data-testid="meters-condo-switcher"
        aria-label="Trocar condomínio"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {condos.map((c) => (
          <SelectItem key={c.slug} value={c.slug}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
