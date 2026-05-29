# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: meters.spec.ts >> meters & QR (M2) >> listing renders groups and masters, print sheet renders QR labels, /r/<id> redirects
- Location: tests/e2e/meters.spec.ts:50:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/reading\/156dfff7-0d51-45bf-a0c1-3bec4022b449$/
Received string:  "http://localhost:4000/?login=1&callbackUrl=%2Freading%2F156dfff7-0d51-45bf-a0c1-3bec4022b449"
Timeout: 10000ms

Call log:
  - Expect "toHaveURL" with timeout 10000ms
    14 × unexpected value "http://localhost:4000/?login=1&callbackUrl=%2Freading%2F156dfff7-0d51-45bf-a0c1-3bec4022b449"

```

# Page snapshot

```yaml
- generic:
  - generic:
    - banner:
      - generic:
        - link:
          - /url: /
          - img
        - generic:
          - button:
            - generic: Entrar
    - generic:
      - complementary:
        - generic:
          - generic: Menu
          - button [expanded]:
            - img
        - navigation:
          - link:
            - /url: /
            - generic:
              - img
              - generic: HOME
          - link:
            - /url: /meters
            - generic:
              - img
              - generic: MEDIDORES
          - link:
            - /url: /reading
            - generic:
              - img
              - generic: LEITURAS
          - link:
            - /url: /consumption
            - generic:
              - img
              - generic: CONSUMO
          - link:
            - /url: /billing
            - generic:
              - img
              - generic: PAGAMENTOS
          - link:
            - /url: /account
            - generic:
              - img
              - generic: CONFIGURAÇÕES
      - generic:
        - generic:
          - main:
            - generic:
              - img
              - heading [level=1]: Leitura inteligente de hidrômetros para o seu condomínio
              - paragraph: Centraliza leituras, revisão, consumo e exportação para o sistema de cobrança — com rastreabilidade e auditoria.
            - generic:
              - link:
                - /url: /?login=1
                - text: Entrar
    - contentinfo:
      - generic:
        - paragraph: © 2026 Severino. Todos os direitos reservados.
        - generic: ·
        - link:
          - /url: /login
          - text: Acesso
  - alert
  - dialog "Entrar na sua conta" [ref=e2]:
    - generic [ref=e3]:
      - heading "Entrar na sua conta" [level=2] [ref=e4]
      - paragraph [ref=e5]: Acesse o painel Severino com seu e-mail.
    - generic [ref=e6]:
      - tablist [ref=e7]:
        - tab "Entrar" [active] [selected] [ref=e8] [cursor=pointer]
        - tab "Criar Conta" [ref=e9] [cursor=pointer]
      - tabpanel "Entrar" [ref=e10]:
        - generic [ref=e11]:
          - generic [ref=e12]:
            - generic [ref=e13]: E-mail
            - textbox "E-mail" [ref=e14]:
              - /placeholder: voce@condominio.com.br
          - generic [ref=e15]:
            - generic [ref=e16]: Senha
            - generic [ref=e17]:
              - textbox "Senha" [ref=e18]
              - button "Mostrar senha" [ref=e19] [cursor=pointer]:
                - img
          - button "Entrar" [ref=e20] [cursor=pointer]
    - button "Fechar" [ref=e21] [cursor=pointer]:
      - img [ref=e22]
      - generic [ref=e25]: Fechar
```

# Test source

```ts
  1  | import { test, expect, type Page } from '@playwright/test'
  2  | 
  3  | // Counts are asserted exactly, so we rely on the deterministic mock extractor (forced via
  4  | // PLAYWRIGHT_USE_REAL_LLM!=true in `playwright.config.ts`).
  5  | // With this prompt the mock builds: 2 floor groups, 4 units (2/floor), 4 submeters, and
  6  | // 3 masters (one per floor + 1 condo intake).
  7  | const SAMPLE_PROMPT =
  8  |   '2 andares, 2 apartamentos cada, 1 master por andar + 1 hidrômetro geral do condomínio.'
  9  | 
  10 | async function loginAsStaff(page: Page): Promise<void> {
  11 |   const emailRaw = process.env.E2E_USER_EMAIL?.trim()
  12 |   const passwordRaw = process.env.E2E_USER_PASSWORD?.trim()
  13 |   test.skip(!emailRaw || !passwordRaw, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD (see env.example).')
  14 | 
  15 |   await page.goto('/?login=1')
  16 |   await expect(page.getByRole('dialog')).toBeVisible()
  17 |   await page.getByTestId('login-email').fill(emailRaw as string)
  18 |   await page.getByTestId('login-password').fill(passwordRaw as string)
  19 |   await page.getByTestId('login-submit').click()
  20 | 
  21 |   await expect(page).toHaveURL(
  22 |     (url) => {
  23 |       try {
  24 |         const u = new URL(url)
  25 |         return !u.searchParams.has('login')
  26 |       } catch {
  27 |         return false
  28 |       }
  29 |     },
  30 |     { timeout: 30_000 }
  31 |   )
  32 | }
  33 | 
  34 | async function onboardSmallCondo(page: Page, suffix: string): Promise<string> {
  35 |   const condoName = `E2E Meters ${suffix}`
  36 |   await page.goto('/onboarding')
  37 |   await page.getByTestId('onb-name').fill(condoName)
  38 |   await page.getByTestId('onb-prompt').fill(SAMPLE_PROMPT)
  39 |   await page.getByTestId('onb-preview-submit').click()
  40 | 
  41 |   await expect(page.getByTestId('onboarding-preview')).toBeVisible({ timeout: 15_000 })
  42 |   await page.getByTestId('onb-commit').click()
  43 |   await expect(page.getByTestId('onboarding-success')).toBeVisible({ timeout: 15_000 })
  44 |   const slug = await page.getByTestId('onboarding-success-slug').textContent()
  45 |   expect(slug?.trim()).toBeTruthy()
  46 |   return slug?.trim() as string
  47 | }
  48 | 
  49 | test.describe('meters & QR (M2)', () => {
  50 |   test('listing renders groups and masters, print sheet renders QR labels, /r/<id> redirects', async ({
  51 |     page,
  52 |   }) => {
  53 |     await loginAsStaff(page)
  54 |     const suffix = Date.now().toString(36)
  55 |     const slug = await onboardSmallCondo(page, suffix)
  56 | 
  57 |     // Listing — 2 floor groups, 4 units, 4 submeters, 3 masters.
  58 |     await page.goto(`/meters?condo=${encodeURIComponent(slug)}`)
  59 |     await expect(page.getByTestId('meters-page')).toBeVisible()
  60 |     await expect(page.getByTestId('meters-stat-groups')).toHaveText('2')
  61 |     await expect(page.getByTestId('meters-stat-units')).toHaveText('4')
  62 |     await expect(page.getByTestId('meters-stat-submeters')).toHaveText('4')
  63 |     await expect(page.getByTestId('meters-stat-masters')).toHaveText('3')
  64 |     await expect(page.getByTestId('meters-masters-list')).toBeVisible()
  65 |     await expect(page.getByTestId('meters-grouped-list')).toBeVisible()
  66 | 
  67 |     // Print sheet — every meter gets one label (4 submeters + 3 masters = 7 QR codes).
  68 |     await page.getByTestId('meters-print-link').click()
  69 |     await expect(page.getByTestId('meters-print-page')).toBeVisible()
  70 |     await expect(page.getByTestId('print-sheet')).toBeVisible()
  71 |     await expect(page.getByTestId('print-masters-section')).toBeVisible()
  72 |     await expect(page.getByTestId('qr-label')).toHaveCount(7)
  73 |     await expect(page.getByTestId('qr-svg').first()).toBeVisible()
  74 | 
  75 |     // Pick the first meter from the listing and verify /r/<id> 307s to /reading/<id>.
  76 |     await page.goto(`/meters?condo=${encodeURIComponent(slug)}`)
  77 |     const firstMeterLink = page.locator('[data-testid^="meter-link-"]').first()
  78 |     const href = await firstMeterLink.getAttribute('href')
  79 |     expect(href).toMatch(/^\/reading\//)
  80 |     const meterId = href!.replace('/reading/', '')
  81 | 
  82 |     await page.goto(`/r/${meterId}`)
> 83 |     await expect(page).toHaveURL(new RegExp(`/reading/${meterId}$`), { timeout: 10_000 })
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  84 |     await expect(page.getByTestId('reading-meter-page')).toBeVisible()
  85 |     await expect(page.getByTestId('reading-meter-id')).toHaveText(meterId)
  86 |   })
  87 | })
  88 | 
```