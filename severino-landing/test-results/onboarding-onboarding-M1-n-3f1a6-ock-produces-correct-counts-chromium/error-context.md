# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: onboarding.spec.ts >> onboarding (M1) >> nested towers × floors (mock) produces correct counts
- Location: tests/e2e/onboarding.spec.ts:60:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Onboarding do condomínio' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Onboarding do condomínio' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "Severino" [ref=e5] [cursor=pointer]:
          - /url: /
          - img "Severino" [ref=e6]
        - generic [ref=e8]:
          - generic [ref=e9]:
            - paragraph [ref=e10]: System Admin
            - paragraph [ref=e11]: admin@hidrosync.com.br
          - button "Menu da conta" [ref=e12] [cursor=pointer]:
            - generic [ref=e14]: SA
    - generic [ref=e15]:
      - complementary "Navegação principal" [ref=e16]:
        - generic [ref=e17]:
          - generic [ref=e18]: Menu
          - button "Recolher menu" [expanded] [ref=e19] [cursor=pointer]:
            - img
        - navigation [ref=e20]:
          - link "HOME" [ref=e21] [cursor=pointer]:
            - /url: /
            - generic [ref=e22]:
              - img [ref=e23]
              - generic [ref=e26]: HOME
          - link "ONBOARDING" [ref=e27] [cursor=pointer]:
            - /url: /onboarding
            - generic [ref=e28]:
              - img [ref=e29]
              - generic [ref=e34]: ONBOARDING
          - link "MEDIDORES" [ref=e35] [cursor=pointer]:
            - /url: /meters
            - generic [ref=e36]:
              - img [ref=e37]
              - generic [ref=e40]: MEDIDORES
          - link "LEITURAS" [ref=e41] [cursor=pointer]:
            - /url: /reading
            - generic [ref=e42]:
              - img [ref=e43]
              - generic [ref=e46]: LEITURAS
          - link "CONSUMO" [ref=e47] [cursor=pointer]:
            - /url: /consumption
            - generic [ref=e48]:
              - img [ref=e49]
              - generic [ref=e51]: CONSUMO
          - link "PAGAMENTOS" [ref=e52] [cursor=pointer]:
            - /url: /billing
            - generic [ref=e53]:
              - img [ref=e54]
              - generic [ref=e56]: PAGAMENTOS
          - link "CONFIGURAÇÕES" [ref=e57] [cursor=pointer]:
            - /url: /account
            - generic [ref=e58]:
              - img [ref=e59]
              - generic [ref=e62]: CONFIGURAÇÕES
      - main [ref=e65]:
        - generic [ref=e66]:
          - generic [ref=e67]:
            - heading "Configuração das Unidades" [level=1] [ref=e68]
            - paragraph [ref=e69]: Descreva a estrutura do condomínio em texto livre. Geramos uma prévia dos grupos e unidades; nada é gravado até você confirmar.
          - generic [ref=e70]:
            - generic [ref=e71]:
              - generic [ref=e72]: Texto descritivo
              - generic [ref=e73]: Use frases curtas. Reconhecemos andares, torres, unidades por andar e medidores principais (masters) por andar/torre/condomínio.
            - generic [ref=e75]:
              - generic [ref=e76]:
                - generic [ref=e77]:
                  - generic [ref=e78]: Nome do condomínio
                  - textbox "Nome do condomínio" [ref=e79]:
                    - /placeholder: Condomínio Aurora
                - generic [ref=e80]:
                  - generic [ref=e81]: Identificador
                  - textbox "Identificador" [ref=e82]:
                    - /placeholder: condominio-aurora
                  - paragraph [ref=e83]: Usado em URLs internas. Sem espaços, somente letras, números e "-".
              - generic [ref=e84]:
                - generic [ref=e85]: Descrição da estrutura
                - textbox "Descrição da estrutura" [ref=e86]:
                  - /placeholder: Duas torres, A e B com 10 andares cada, 4 apartamentos por andar (ex. 1001A, 1002A), 1 master por torre e 1 hidrômetro geral do condomínio.
                - button "Usar exemplo" [ref=e87] [cursor=pointer]
              - button "Gerar prévia" [ref=e89] [cursor=pointer]
    - contentinfo [ref=e90]:
      - generic [ref=e91]:
        - paragraph [ref=e92]: © 2026 Severino. Todos os direitos reservados.
        - generic [ref=e93]: ·
        - link "Acesso" [ref=e94] [cursor=pointer]:
          - /url: /login
  - alert [ref=e95]
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test'
  2   | 
  3   | const SAMPLE_PROMPT =
  4   |   '10 andares, 4 apartamentos cada, 1 master por andar + 1 hidrômetro geral do condomínio.'
  5   | 
  6   | // Counts are asserted exactly, so we rely on the deterministic mock extractor. The Playwright
  7   | // config defaults `ONBOARDING_LLM_PROVIDER=mock` for the spawned dev server unless the dev opts
  8   | // into the real LLM with `PLAYWRIGHT_USE_REAL_LLM=true`.
  9   | 
  10  | async function loginAsStaff(page: Page): Promise<void> {
  11  |   const emailRaw = process.env.E2E_USER_EMAIL?.trim()
  12  |   const passwordRaw = process.env.E2E_USER_PASSWORD?.trim()
  13  |   test.skip(!emailRaw || !passwordRaw, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD (see env.example).')
  14  | 
  15  |   await page.goto('/?login=1')
  16  |   await expect(page.getByRole('dialog')).toBeVisible()
  17  |   await page.getByTestId('login-email').fill(emailRaw as string)
  18  |   await page.getByTestId('login-password').fill(passwordRaw as string)
  19  |   await page.getByTestId('login-submit').click()
  20  | 
  21  |   await expect(page).toHaveURL(
  22  |     (url) => {
  23  |       try {
  24  |         const u = new URL(url)
  25  |         return !u.searchParams.has('login')
  26  |       } catch {
  27  |         return false
  28  |       }
  29  |     },
  30  |     { timeout: 30_000 }
  31  |   )
  32  | }
  33  | 
  34  | test.describe('onboarding (M1)', () => {
  35  |   test('prompt → preview → commit creates a condo with correct counts', async ({ page }) => {
  36  |     await loginAsStaff(page)
  37  | 
  38  |     await page.goto('/onboarding')
  39  |     await expect(page.getByRole('heading', { name: 'Onboarding do condomínio' })).toBeVisible()
  40  | 
  41  |     const uniqueSuffix = Date.now().toString(36)
  42  |     const condoName = `E2E Aurora ${uniqueSuffix}`
  43  | 
  44  |     await page.getByTestId('onb-name').fill(condoName)
  45  |     await page.getByTestId('onb-prompt').fill(SAMPLE_PROMPT)
  46  |     await page.getByTestId('onb-preview-submit').click()
  47  | 
  48  |     await expect(page.getByTestId('onboarding-preview')).toBeVisible({ timeout: 15_000 })
  49  |     await expect(page.getByTestId('stat-groups')).toHaveText('10')
  50  |     await expect(page.getByTestId('stat-units')).toHaveText('40')
  51  |     await expect(page.getByTestId('stat-submeters')).toHaveText('40')
  52  |     await expect(page.getByTestId('stat-masters')).toHaveText('11') // 10 per floor + 1 condo
  53  | 
  54  |     await page.getByTestId('onb-commit').click()
  55  | 
  56  |     await expect(page.getByTestId('onboarding-success')).toBeVisible({ timeout: 15_000 })
  57  |     await expect(page.getByTestId('onboarding-success-slug')).toContainText(`e2e-aurora-${uniqueSuffix}`)
  58  |   })
  59  | 
  60  |   test('nested towers × floors (mock) produces correct counts', async ({ page }) => {
  61  |     await loginAsStaff(page)
  62  | 
  63  |     await page.goto('/onboarding')
> 64  |     await expect(page.getByRole('heading', { name: 'Onboarding do condomínio' })).toBeVisible()
      |                                                                                   ^ Error: expect(locator).toBeVisible() failed
  65  | 
  66  |     const uniqueSuffix = Date.now().toString(36)
  67  |     const condoName = `E2E Nested ${uniqueSuffix}`
  68  |     const nestedPrompt =
  69  |       '2 torres, 3 andares, 2 apartamentos cada, 1 master por andar + 1 hidrômetro geral do condomínio.'
  70  | 
  71  |     await page.getByTestId('onb-name').fill(condoName)
  72  |     await page.getByTestId('onb-prompt').fill(nestedPrompt)
  73  |     await page.getByTestId('onb-preview-submit').click()
  74  | 
  75  |     await expect(page.getByTestId('onboarding-preview')).toBeVisible({ timeout: 15_000 })
  76  |     await expect(page.getByTestId('stat-groups')).toHaveText('8')
  77  |     await expect(page.getByTestId('stat-units')).toHaveText('12')
  78  |     await expect(page.getByTestId('stat-submeters')).toHaveText('12')
  79  |     await expect(page.getByTestId('stat-masters')).toHaveText('7')
  80  | 
  81  |     await page.getByTestId('onb-commit').click()
  82  |     await expect(page.getByTestId('onboarding-success')).toBeVisible({ timeout: 15_000 })
  83  |   })
  84  | 
  85  |   test('rejects a duplicate slug', async ({ page }) => {
  86  |     await loginAsStaff(page)
  87  | 
  88  |     await page.goto('/onboarding')
  89  | 
  90  |     const condoName = `E2E Dup ${Date.now().toString(36)}`
  91  |     await page.getByTestId('onb-name').fill(condoName)
  92  |     await page.getByTestId('onb-prompt').fill(SAMPLE_PROMPT)
  93  |     await page.getByTestId('onb-preview-submit').click()
  94  | 
  95  |     await expect(page.getByTestId('onboarding-preview')).toBeVisible({ timeout: 15_000 })
  96  |     await page.getByTestId('onb-commit').click()
  97  |     await expect(page.getByTestId('onboarding-success')).toBeVisible({ timeout: 15_000 })
  98  | 
  99  |     // Second attempt with the same name should fail because the slug is now taken.
  100 |     await page.goto('/onboarding')
  101 |     await page.getByTestId('onb-name').fill(condoName)
  102 |     await page.getByTestId('onb-prompt').fill(SAMPLE_PROMPT)
  103 |     await page.getByTestId('onb-preview-submit').click()
  104 | 
  105 |     await expect(page.getByTestId('onb-error')).toBeVisible({ timeout: 15_000 })
  106 |     await expect(page.getByTestId('onb-error')).toContainText(/identificador/i)
  107 |   })
  108 | })
  109 | 
```