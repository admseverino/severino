'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Edit, Shield, Trash2, User as UserIcon } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isStaffRole, isSystemAdminRole } from '@/lib/admin-rbac'

interface AdminUser {
  id: string
  name: string | null
  email: string
  role: string
  emailVerified: string | null
  image: string | null
  createdAt: string | null
}

export default function AdminUsersPage(): React.JSX.Element {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'user' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)

  const actorIsSuper = session?.user?.role ? isSystemAdminRole(session.user.role) : false

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || !isStaffRole(session.user.role)) {
      router.replace('/')
      return
    }
    void fetchUsers()
  }, [session, status, router])

  async function fetchUsers(): Promise<void> {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users')
      if (!response.ok) throw new Error('Failed to fetch users')
      const data: unknown = await response.json()
      const parsed = data as { users?: AdminUser[] }
      setUsers(parsed.users ?? [])
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  function openEditDialog(user: AdminUser): void {
    if (!session?.user) return
    if (session.user.role === 'admin' && isSystemAdminRole(user.role)) {
      return
    }
    setEditingUser(user)
    setEditForm({
      name: user.name ?? '',
      email: user.email,
      role: user.role,
    })
    setIsEditDialogOpen(true)
  }

  function closeEditDialog(): void {
    setIsEditDialogOpen(false)
    setEditingUser(null)
    setEditForm({ name: '', email: '', role: 'user' })
  }

  async function handleUpdateUser(): Promise<void> {
    if (!editingUser) return
    try {
      setIsSubmitting(true)
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!response.ok) {
        const errBody: unknown = await response.json().catch(() => ({}))
        const msg = typeof errBody === 'object' && errBody && 'error' in errBody ? String((errBody as { error: unknown }).error) : 'Falha ao atualizar'
        throw new Error(msg)
      }
      await fetchUsers()
      closeEditDialog()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Falha ao atualizar')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function confirmDeleteUser(): Promise<void> {
    if (!deleteTarget) return
    try {
      const response = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const errBody: unknown = await response.json().catch(() => ({}))
        const msg = typeof errBody === 'object' && errBody && 'error' in errBody ? String((errBody as { error: unknown }).error) : 'Falha ao excluir'
        throw new Error(msg)
      }
      await fetchUsers()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Falha ao excluir')
    } finally {
      setDeleteTarget(null)
    }
  }

  function initials(user: AdminUser): string {
    const source = user.name?.trim() || user.email
    return source.slice(0, 2).toUpperCase()
  }

  if (status === 'loading' || loading) {
    return (
      <div className="container max-w-6xl py-6">
        <div className="flex h-64 items-center justify-center text-muted-foreground">Carregando…</div>
      </div>
    )
  }

  if (!session?.user || !isStaffRole(session.user.role)) {
    return <></>
  }

  return (
    <div className="container max-w-6xl space-y-6 py-6" data-testid="admin-users-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold text-hidrostone">Usuários</h1>
          <p className="text-muted-foreground">Gerenciar contas e papéis</p>
        </div>
        <Button variant="outline" className="rounded-[4px]" onClick={() => router.push('/admin')}>
          Voltar ao painel
        </Button>
      </div>

      <Card className="rounded-[4px]">
        <CardHeader>
          <CardTitle>Todos os usuários</CardTitle>
          <CardDescription>
            {users.length} usuário{users.length === 1 ? '' : 's'} cadastrado{users.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Nenhum usuário encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="admin-users-table">
                <thead>
                  <tr className="border-b">
                    <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Nome</th>
                    <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">E-mail</th>
                    <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Papel</th>
                    <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Verificado</th>
                    <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Criado</th>
                    <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const displayName = user.name || user.email
                    const canEditRow = !(session.user.role === 'admin' && isSystemAdminRole(user.role))
                    return (
                      <tr key={user.id} className="border-b" data-testid={`admin-user-row-${user.id}`}>
                        <td className="p-2 align-middle">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-8 rounded-full">
                              <AvatarImage src={user.image ?? undefined} alt={displayName} />
                              <AvatarFallback className="rounded-full text-xs">
                                {user.image ? <UserIcon className="size-4" /> : initials(user)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{displayName}</span>
                          </div>
                        </td>
                        <td className="p-2 align-middle" data-testid={`admin-user-email-${user.id}`}>
                          {user.email}
                        </td>
                        <td className="p-2 align-middle">
                          <Badge
                            variant={isSystemAdminRole(user.role) ? 'default' : 'secondary'}
                            className="flex w-fit items-center gap-1 uppercase"
                            data-testid={`admin-user-role-${user.id}`}
                          >
                            {isSystemAdminRole(user.role) ? <Shield className="size-3" /> : null}
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-2 align-middle">
                          <Badge variant={user.emailVerified ? 'default' : 'outline'}>
                            {user.emailVerified ? 'Sim' : 'Não'}
                          </Badge>
                        </td>
                        <td className="p-2 align-middle">
                          <span className="text-sm text-muted-foreground">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '—'}
                          </span>
                        </td>
                        <td className="p-2 align-middle">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              disabled={!canEditRow}
                              onClick={() => openEditDialog(user)}
                              data-testid={`admin-user-edit-${user.id}`}
                            >
                              <Edit className="size-4" />
                            </Button>
                            {actorIsSuper ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() => setDeleteTarget(user)}
                                disabled={user.id === session.user.id}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="rounded-[4px]" data-testid="admin-edit-user-dialog">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>Atualize dados e papel (respeitando suas permissões).</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Nome"
                className="rounded-[4px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="email@exemplo.com"
                className="rounded-[4px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Papel</Label>
              <Select
                value={editForm.role}
                onValueChange={(value) => setEditForm({ ...editForm, role: value })}
              >
                <SelectTrigger id="role" className="w-full rounded-[4px]" data-testid="admin-edit-role-trigger">
                  <SelectValue placeholder="Papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  {actorIsSuper ? <SelectItem value="system_admin">Superusuário</SelectItem> : null}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Alterações restritas por papel: administradores não podem alterar superusuários nem atribuir
                superusuário.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-[4px]" onClick={closeEditDialog}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-[4px] bg-hidrostone text-white hover:bg-hidrostone/90"
              onClick={() => void handleUpdateUser()}
              disabled={isSubmitting}
              data-testid="admin-edit-save"
            >
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-[4px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Esta ação remove permanentemente a conta de "${deleteTarget.name || deleteTarget.email}". Não pode ser desfeita.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[4px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[4px] bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void confirmDeleteUser()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
