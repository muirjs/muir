import { fileURLToPath } from 'node:url';

import { playwrightMutatorRows } from './support/mutants.ts';

const fixture = (file: string) =>
  fileURLToPath(
    new URL(`./playwright-mutators-fixture/${file}`, import.meta.url),
  );

playwrightMutatorRows(
  {
    spec: fixture('src/app.spec.ts'),
    testDir: fixture('public'),
    configFile: fixture('playwright.config.ts'),
    testCount: 7,
  },
  [
    {
      mutator: 'MuirProteusPlaywrightClickAction',
      original: "await page.getByRole('button', { name: 'Add' }).click();",
      replacement: ';',
      killer: 'adds an item',
      bystander: 'greets by name',
    },
    {
      mutator: 'MuirProteusPlaywrightInputAction',
      original: "await page.getByLabel('Name').fill('Ada');",
      replacement: ';',
      killer: 'greets by name',
      bystander: 'adds an item',
    },
    {
      mutator: 'MuirProteusPlaywrightInputAction',
      original: "await request.post('/api/note', { data: 'kept' });",
      replacement: ';',
      killer: 'stores a note',
      bystander: 'shows the heading',
    },
    {
      mutator: 'MuirProteusPlaywrightFocusAction',
      original: "await page.getByText('Help').hover();",
      replacement: ';',
      killer: 'shows the tips on hover',
      bystander: 'adds an item',
    },
    {
      mutator: 'MuirProteusPlaywrightNavigationAction',
      original: "await page.goto('/');",
      replacement: ';',
      killer: 'shows the heading',
      bystander: 'stores a note',
    },
    {
      mutator: 'MuirProteusPlaywrightTestIdLocator',
      original: "'count'",
      replacement: "'greeting'",
      killer: 'adds an item',
      bystander: 'greets by name',
    },
    {
      mutator: 'MuirProteusPlaywrightRoleLocator',
      original: "'Add'",
      replacement: "'Load user'",
      killer: 'adds an item',
      bystander: 'shows the heading',
    },
    {
      mutator: 'MuirProteusPlaywrightTextLocator',
      original: "'Help'",
      replacement: "'Tips'",
      killer: 'shows the tips on hover',
      bystander: 'adds an item',
    },
    {
      mutator: 'MuirProteusPlaywrightFulfill',
      original: "{ name: 'Grace' }",
      replacement: '{}',
      killer: 'loads the user',
      bystander: 'shows the heading',
    },
    {
      mutator: 'MuirProteusPlaywrightRouteOutcome',
      original: 'route.abort()',
      replacement: 'route.continue()',
      killer: 'reports a failed ping as offline',
      bystander: 'loads the user',
    },
  ],
);
