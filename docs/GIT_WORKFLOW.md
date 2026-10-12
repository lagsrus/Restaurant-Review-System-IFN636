# Git and Pull Request Workflow

## Branches
- Do not develop directly on main.
- Start feature work from the latest main branch.
- Use: feature/RRP-123-short-description

## Commits
- Keep commits small and meaningful.
- Start each commit message with its Jira key.
- Example: RRP-123 Add restaurant search validation

## Pull requests
- Push the feature branch and open a pull request into main.
- Include the Jira item and related FR/NFR.
- Record how the change was tested.
- Request at least one teammate review.
- Resolve review comments and failed CI checks before merging.

## Merge
A change is ready to merge when:
- acceptance criteria are met;
- automated tests pass;
- GitHub Actions passes;
- at least one teammate has reviewed the PR;
- Jira and traceability evidence are updated.

## Configuration
- Never commit .env files or credentials.
- Use .env.example for required configuration fields.
