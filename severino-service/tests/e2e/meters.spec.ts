import { test, expect, type Page } from '@playwright/test'

// Counts are asserted exactly, so we rely on the deterministic mock extractor (forced via
// PLAYWRIGHT_USE_REAL_LLM!=true in `playwright.config.ts`).
// With this prompt the mock builds: 2 floor groups, 4 units (2/floor), 4 submeters, and
// 3 masters (one per floor + 1 condo intake).
const SAMPLE_PROMPT =
  '2 andares, 2 apartamentos cada, 1 master por andar + 1 hidrômetro geral do condomínio.'

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

async function onboardSmallCondo(page: Page, suffix: string): Promise<string> {
  const condoName = `E2E Meters ${suffix}`
  await page.goto('/onboarding')
  await page.getByTestId('onb-name').fill(condoName)
  await page.getByTestId('onb-prompt').fill(SAMPLE_PROMPT)
  await page.getByTestId('onb-preview-submit').click()

  await expect(page.getByTestId('onboarding-preview')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('onb-commit').click()
  await expect(page.getByTestId('onboarding-success')).toBeVisible({ timeout: 15_000 })
  const slug = await page.getByTestId('onboarding-success-slug').textContent()
  expect(slug?.trim()).toBeTruthy()
  return slug?.trim() as string
}

test.describe('meters & QR (M2)', () => {
  test('listing renders groups and masters, print sheet renders QR labels, /r/<id> redirects', async ({
    page,
  }) => {
    await loginAsStaff(page)
    const suffix = Date.now().toString(36)
    const slug = await onboardSmallCondo(page, suffix)

    // Listing — 2 floor groups, 4 units, 4 submeters, 3 masters.
    await page.goto(`/meters?condo=${encodeURIComponent(slug)}`)
    await expect(page.getByTestId('meters-page')).toBeVisible()
    await expect(page.getByTestId('meters-stat-groups')).toHaveText('2')
    await expect(page.getByTestId('meters-stat-units')).toHaveText('4')
    await expect(page.getByTestId('meters-stat-submeters')).toHaveText('4')
    await expect(page.getByTestId('meters-stat-masters')).toHaveText('3')
    await expect(page.getByTestId('meters-masters-list')).toBeVisible()
    await expect(page.getByTestId('meters-grouped-list')).toBeVisible()

    // Print sheet — every meter gets one label (4 submeters + 3 masters = 7 QR codes).
    await page.getByTestId('meters-print-link').click()
    await expect(page.getByTestId('meters-print-page')).toBeVisible()
    await expect(page.getByTestId('print-sheet')).toBeVisible()
    await expect(page.getByTestId('print-masters-section')).toBeVisible()
    await expect(page.getByTestId('qr-label')).toHaveCount(7)
    await expect(page.getByTestId('qr-svg').first()).toBeVisible()

    // Pick the first meter from the listing and verify /r/<id> 307s to /reading/<id>.
    await page.goto(`/meters?condo=${encodeURIComponent(slug)}`)
    const firstMeterLink = page.locator('[data-testid^="meter-link-"]').first()
    const href = await firstMeterLink.getAttribute('href')
    expect(href).toMatch(/^\/reading\//)
    const meterId = href!.replace('/reading/', '')

    await page.goto(`/r/${meterId}`)
    await expect(page).toHaveURL(new RegExp(`/reading/${meterId}$`), { timeout: 10_000 })
    await expect(page.getByTestId('reading-meter-page')).toBeVisible()
    await expect(page.getByTestId('reading-meter-id')).toHaveText(meterId)
  })
})
