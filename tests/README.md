# Integration Tests

This directory contains Playwright integration tests for the Bluesky PWA app.

## Running Tests Locally

### Prerequisites

- Node.js (version specified in `.nvmrc`)
- npm dependencies installed (`npm ci`)
- Playwright browsers installed

### Install Playwright Browsers

```bash
npx playwright install chromium
```

### Run Tests

**Against local build:**

```bash
npm run test:e2e
```

This will build the app and run tests against the local preview server.

**Against a specific URL (e.g., Netlify deployment):**

```bash
PLAYWRIGHT_TEST_BASE_URL=https://your-deployment-url.netlify.app npm run test:e2e
```

**Run tests in UI mode (interactive):**

```bash
npm run test:e2e:ui
```

**Run tests in headed mode (see browser):**

```bash
npm run test:e2e:headed
```

## Test Structure

- `home.spec.js` - Tests for the home page and login functionality
- `ui.spec.js` - Tests for UI elements, responsiveness, and accessibility

## CI/CD Integration

The tests are automatically run in GitHub Actions against Netlify PR deployments:

1. When a PR is created, Netlify builds a preview deployment
2. GitHub Actions waits for the Netlify deployment to complete
3. Playwright tests are run against the Netlify preview URL
4. Test results are uploaded as artifacts

## Writing New Tests

Follow the existing test patterns:

- Use descriptive test names
- Test user flows and interactions
- Check for accessibility
- Verify responsive behavior
- Handle error states

See the [Playwright documentation](https://playwright.dev/docs/intro) for more information.
