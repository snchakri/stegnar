# Contribution Guidelines

We welcome and appreciate contributions from the community. To ensure a smooth and effective process for everyone involved, please adhere to the following guidelines.

## 1. Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior.

## 2. Getting Started

-   Ensure you have a GitHub account.
-   Familiarize yourself with the project's architecture by reading the `README.md` and `docs/ARCHITECTURE.md`.
-   Set up your local development environment by following the instructions in `docs/SETUP.md`.

## 3. How to Contribute

### Reporting Bugs

-   **Search existing issues:** Before creating a new bug report, please check the [issue tracker](https://github.com/your-org/stegnar-prototype/issues) to see if the bug has already been reported.
-   **Create a new issue:** If the bug hasn't been reported, create a new issue. Provide a clear and descriptive title, a detailed description of the bug, steps to reproduce it, and information about your environment (OS, Docker version, etc.).

### Suggesting Enhancements

-   **Create a new issue:** Open an issue with a clear title and a detailed description of the proposed enhancement. Explain why the enhancement would be useful and provide as much detail as possible about the implementation you have in mind.

### Submitting Pull Requests

1.  **Fork the repository:** Create your own fork of the project on GitHub.
2.  **Create a feature branch:**
    ```bash
    git checkout -b feature/your-feature-name
    ```
    Or, for a bug fix:
    ```bash
    git checkout -b fix/issue-number-description
    ```
3.  **Make your changes:** Implement your feature or bug fix.
4.  **Follow the coding style:** Ensure your code adheres to the project's coding style (e.g., PEP 8 for Python). Use a linter to check your code.
5.  **Write clear commit messages:** Your commit messages should be concise and descriptive.
    ```
    feat: Add support for PNG file analysis
    
    Implement the necessary preprocessing steps and modify the 
    stegnar-mitm worker to handle PNG files in addition to JPEGs.
    ```
6.  **Sign your commits:** All commits must be signed with a GPG key to verify their origin. See GitHub's documentation on [signing commits](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits).
7.  **Push to your fork:**
    ```bash
    git push origin feature/your-feature-name
    ```
8.  **Open a Pull Request (PR):** Open a PR from your fork to the `main` branch of the main repository.
    -   Provide a clear title and description for your PR.
    -   Link to any relevant issues.
    -   Explain the changes you have made and why.

## 4. Branching Strategy

-   **`main`:** This is the primary branch. It should always be stable and deployable. Direct pushes to `main` are not allowed.
-   **`feature/*`:** All new features should be developed in a `feature` branch.
-   **`fix/*`:** Bug fixes should be developed in a `fix` branch.

## 5. Code Review Process

-   All PRs must be reviewed and approved by at least one maintainer before they can be merged.
-   Be prepared to make changes to your PR based on feedback from the review.
-   Once your PR is approved, a maintainer will merge it into the `main` branch.

