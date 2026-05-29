import { test, expect } from '@playwright/test'

test.describe('account and admin users (staff)', () => {
  test('after credentials login, /account and /admin/users load (E2E user must be admin or system_admin)', async ({
    page,
  }) => {
    const emailRaw = process.env.E2E_USER_EMAIL?.trim()
    const passwordRaw = process.env.E2E_USER_PASSWORD?.trim()
    test.skip(!emailRaw || !passwordRaw, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD (see env.example).')

    await page.goto('/?login=1')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByTestId('login-email').fill(emailRaw as string)
    await page.getByTestId('login-password').fill(passwordRaw as string)
    await page.getByTestId('login-submit').click()

    await expect(page).toHaveURL(
      (url) => {
        try {
          const u = new URL(url)
          return !u.searchParams.has('login')
        } catch {
          return false
        }
      },
      { timeout: 30_000 }
    )

    await page.goto('/account')
    await expect(page.getByRole('heading', { name: 'Conta' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Perfil' })).toBeVisible()

    await page.goto('/admin/users')
    await expect(page.getByTestId('admin-users-page')).toBeVisible()
    await expect(page.getByTestId('admin-users-table')).toBeVisible()
  })
})
