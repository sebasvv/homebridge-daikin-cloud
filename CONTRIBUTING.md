# Contributing to homebridge-daikin-cloud

Thank you for your interest in contributing! This project follows specific quality standards to ensure reliability and maintainability.

## Development Environment

- **Node.js**: Versions 18, 20, 22, 24
- **Package Manager**: npm

## Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/sebasvv/homebridge-daikin-cloud.git
    cd homebridge-daikin-cloud
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Build the project**:
    ```bash
    npm run build
    ```

## Quality Standards ("The 10 Pillars")

We enforce strict quality control. Please ensure your contributions adhere to these standards:

1.  **Clean Architecture**: Logic should be separated into `services/`, `repositories/`, and `accessories/`.
2.  **Type Safety**: No `any` types. Strict null checks and indexed access are enabled.
3.  **Linting & Formatting**:
    - **Lint**: `npm run lint` must pass.
    - **Format**: Prettier is enforced. Run `npm run format` to fix style issues.
4.  **Testing**:
    - New features must have tests.
    - Run `npm test` to verify.
    - Coverage should remain high.
5.  **Logging**: Use the `DaikinLogger` service (`this.platform.daikinLogger`), never `console.log`.
6.  **Configuration**: Updates to config must be reflected in `src/config.ts` (Zod schema) and `config.schema.json`.

## Pull Request Process

1.  Create a feature branch.
2.  Make your changes.
3.  Run `npm run verify` to run all checks (lint, build, test) locally.
4.  Push to GitHub and open a PR.
5.  Ensure CI checks pass.
