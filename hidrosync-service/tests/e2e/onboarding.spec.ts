import { test, expect, type Page } from '@playwright/test'

const SAMPLE_PROMPT =
  '10 andares, 4 apartamentos cada, 1 master por andar + 1 hidrômetro geral do condomínio.'

// Counts are asserted exactly, so we rely on the deterministic mock extractor. The Playwright
// config defaults `ONBOARDING_LLM_PROVIDER=mock` for the spawned dev server unless the dev opts
// into the real LLM with `PLAYWRIGHT_USE_REAL_LLM=true`.

async function loginAsStaff(page: Page): Promise<void> {
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
}

test.describe('onboarding (M1)', () => {
  test('prompt → preview → commit creates a condo with correct counts', async ({ page }) => {
    await loginAsStaff(page)

    await page.goto('/onboarding')
    await expect(page.getByRole('heading', { name: 'Onboarding do condomínio' })).toBeVisible()

    const uniqueSuffix = Date.now().toString(36)
    const condoName = `E2E Aurora ${uniqueSuffix}`

    await page.getByTestId('onb-name').fill(condoName)
    await page.getByTestId('onb-prompt').fill(SAMPLE_PROMPT)
    await page.getByTestId('onb-preview-submit').click()

    await expect(page.getByTestId('onboarding-preview')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('stat-groups')).toHaveText('10')
    await expect(page.getByTestId('stat-units')).toHaveText('40')
    await expect(page.getByTestId('stat-submeters')).toHaveText('40')
    await expect(page.getByTestId('stat-masters')).toHaveText('11') // 10 per floor + 1 condo

    await page.getByTestId('onb-commit').click()

    await expect(page.getByTestId('onboarding-success')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('onboarding-success-slug')).toContainText(`e2e-aurora-${uniqueSuffix}`)
  })

  test('nested towers × floors (mock) produces correct counts', async ({ page }) => {
    await loginAsStaff(page)

    await page.goto('/onboarding')
    await expect(page.getByRole('heading', { name: 'Onboarding do condomínio' })).toBeVisible()

    const uniqueSuffix = Date.now().toString(36)
    const condoName = `E2E Nested ${uniqueSuffix}`
    const nestedPrompt =
      '2 torres, 3 andares, 2 apartamentos cada, 1 master por andar + 1 hidrômetro geral do condomínio.'

    await page.getByTestId('onb-name').fill(condoName)
    await page.getByTestId('onb-prompt').fill(nestedPrompt)
    await page.getByTestId('onb-preview-submit').click()

    await expect(page.getByTestId('onboarding-preview')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('stat-groups')).toHaveText('8')
    await expect(page.getByTestId('stat-units')).toHaveText('12')
    await expect(page.getByTestId('stat-submeters')).toHaveText('12')
    await expect(page.getByTestId('stat-masters')).toHaveText('7')

    await page.getByTestId('onb-commit').click()
    await expect(page.getByTestId('onboarding-success')).toBeVisible({ timeout: 15_000 })
  })

  test('rejects a duplicate slug', async ({ page }) => {
    await loginAsStaff(page)

    await page.goto('/onboarding')

    const condoName = `E2E Dup ${Date.now().toString(36)}`
    await page.getByTestId('onb-name').fill(condoName)
    await page.getByTestId('onb-prompt').fill(SAMPLE_PROMPT)
    await page.getByTestId('onb-preview-submit').click()

    await expect(page.getByTestId('onboarding-preview')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('onb-commit').click()
    await expect(page.getByTestId('onboarding-success')).toBeVisible({ timeout: 15_000 })

    // Second attempt with the same name should fail because the slug is now taken.
    await page.goto('/onboarding')
    await page.getByTestId('onb-name').fill(condoName)
    await page.getByTestId('onb-prompt').fill(SAMPLE_PROMPT)
    await page.getByTestId('onb-preview-submit').click()

    await expect(page.getByTestId('onb-error')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('onb-error')).toContainText(/identificador/i)
  })
})
