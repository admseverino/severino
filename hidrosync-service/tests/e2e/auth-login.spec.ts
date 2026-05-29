import { test, expect } from '@playwright/test'

test.describe('auth / login dialog', () => {
  test('opens dialog from /?login=1 and shows Zod password error', async ({ page }) => {
    await page.goto('/?login=1')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Entrar na sua conta' })).toBeVisible()

    await page.getByTestId('login-email').fill('user@example.com')
    await page.getByTestId('login-password').fill('')
    await page.getByTestId('login-submit').click()

    await expect(page.getByTestId('login-password-error')).toBeVisible()
    await expect(page.getByTestId('login-password-error')).toContainText(/informe a senha/i)
  })

  test('opens dialog from header button (no `?login=1` query)', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('header-login-button').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Entrar na sua conta' })).toBeVisible()
  })

  test('credentials login closes dialog and reaches admin', async ({ page }) => {
    const emailRaw = process.env.E2E_USER_EMAIL?.trim()
    const passwordRaw = process.env.E2E_USER_PASSWORD?.trim()
    test.skip(!emailRaw || !passwordRaw, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD (see env.example).')
    const email = emailRaw as string
    const password = passwordRaw as string

    await page.goto('/?login=1')
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByTestId('login-email').fill(email)
    await page.getByTestId('login-password').fill(password)

    await expect(page.getByTestId('login-email-error')).toHaveCount(0)
    await expect(page.getByTestId('login-password-error')).toHaveCount(0)

    await page.getByTestId('login-submit').click()

    // Wait for navigation; on success we leave the marketing route.
    await expect(page).toHaveURL(
      (url) => {
        try {
          const u = new URL(url)
          return u.pathname === '/' && !u.searchParams.has('login')
        } catch {
          return false
        }
      },
      { timeout: 30_000 }
    )
    await expect(page.getByText('E-mail ou senha inválidos.')).toHaveCount(0)
  })
})
