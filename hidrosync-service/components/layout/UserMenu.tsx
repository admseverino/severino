'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import type { Session } from 'next-auth'
import { LogOut, Settings, Shield, User } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isStaffRole } from '@/lib/admin-rbac'

interface UserMenuProps {
  user: Session['user']
}

export function UserMenu({ user }: UserMenuProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 })

  const handleSignOut = async (): Promise<void> => {
    const returnUrl = window.location.href
    await signOut({ redirect: false })
    window.location.assign(returnUrl)
  }

  const getInitials = (name?: string | null, email?: string | null): string => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (email) {
      return email.slice(0, 2).toUpperCase()
    }
    return 'HS'
  }

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return

    const updateDropdownPosition = (): void => {
      if (buttonRef.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect()
        setDropdownPosition({
          top: buttonRect.bottom + 8,
          right: window.innerWidth - buttonRect.right,
        })
      }
    }

    updateDropdownPosition()
    window.addEventListener('scroll', updateDropdownPosition, true)
    window.addEventListener('resize', updateDropdownPosition)

    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true)
      window.removeEventListener('resize', updateDropdownPosition)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return
      }
      setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
    }
  }, [isOpen])

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className="fixed z-[100] w-56 rounded-[4px] border border-gray-200 bg-white py-1 shadow-lg"
      style={{
        top: `${dropdownPosition.top}px`,
        right: `${dropdownPosition.right}px`,
      }}
      role="menu"
    >
      <Link
        href="/account"
        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        onClick={() => setIsOpen(false)}
        role="menuitem"
      >
        <User className="mr-2 size-4 shrink-0" />
        <span>Conta</span>
      </Link>

      <Link
        href="/account?tab=settings"
        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        onClick={() => setIsOpen(false)}
        role="menuitem"
      >
        <Settings className="mr-2 size-4 shrink-0" />
        <span>Configurações</span>
      </Link>

      {isStaffRole(user?.role) ? (
        <Link
          href="/admin"
          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          onClick={() => setIsOpen(false)}
          role="menuitem"
        >
          <Shield className="mr-2 size-4 shrink-0" />
          <span>Administração</span>
        </Link>
      ) : null}

      <div className="mt-1 border-t border-gray-100 pt-1">
        <button
          type="button"
          className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          onClick={async () => {
            setIsOpen(false)
            await handleSignOut()
          }}
          role="menuitem"
        >
          <LogOut className="mr-2 size-4 shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      <div ref={containerRef} className="flex min-w-0 max-w-full items-center justify-end gap-2 sm:gap-3">
        <div className="min-w-0 max-w-[42vw] text-right sm:max-w-[200px] md:max-w-[260px]">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {user?.name || 'Usuário'}
          </p>
          <p className="truncate text-xs leading-tight text-muted-foreground">{user?.email}</p>
        </div>
        <button
          ref={buttonRef}
          type="button"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon' }),
            'flex size-[2.4rem] shrink-0 items-center justify-center rounded-full border border-gray-300 p-0'
          )}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label="Menu da conta"
        >
          <Avatar className="size-[2.1rem]">
            <AvatarImage src={user?.image || undefined} alt={user?.name || 'Usuário'} className="object-cover" />
            <AvatarFallback className="text-xs font-semibold text-hidrostone">
              {getInitials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </div>

      {typeof window !== 'undefined' && isOpen ? createPortal(dropdownContent, document.body) : null}
    </>
  )
}
