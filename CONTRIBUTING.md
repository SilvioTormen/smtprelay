# Contributing to SMTP Relay

First off, thank you for considering contributing to SMTP Relay! 

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, please include as many details as possible:

- Use a clear and descriptive title
- Describe the exact steps to reproduce the problem
- Provide specific examples to demonstrate the steps
- Describe the behavior you observed and what behavior you expected
- Include logs and configuration files (sanitized of sensitive data)
- Note your environment (OS, Node.js version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- Use a clear and descriptive title
- Provide a step-by-step description of the suggested enhancement
- Provide specific examples to demonstrate the steps
- Describe the current behavior and explain the expected behavior
- Explain why this enhancement would be useful

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code follows the existing style
5. Issue that pull request!

## Development Process

1. Clone the repository
   ```bash
   git clone https://github.com/SilvioTormen/smtprelay.git
   cd smtprelay
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a feature branch
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. Make your changes and commit
   ```bash
   git add .
   git commit -m "Add your meaningful commit message"
   ```

5. Push to your fork and submit a pull request

## Coding Standards

- Use meaningful variable and function names
- Comment your code where necessary
- Follow the existing code style
- Write tests for new functionality
- Update documentation as needed

## Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

## Testing

- Write unit tests for new functions
- Ensure all tests pass before submitting PR
- Include integration tests for new features

## Documentation

- Update README.md if needed
- Document new configuration options
- Add JSDoc comments to new functions
- Update CHANGELOG.md following Keep a Changelog format

## Questions?

Feel free to open an issue with your question or contact the maintainers directly.

Thank you for contributing!