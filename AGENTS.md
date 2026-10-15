# Repository workflow

After every completed change to this project:
- Verify the change using appropriate checks.
- Commit the relevant changes with a clear message. Do not commit unrelated user changes or secrets.
- Push the commit to the `github` remote. The enabled `.githooks/post-commit` hook does this automatically. Check the hook result; if it fails, report the failure and retry the normal push when possible. Never force-push.

For a new checkout, run `sh scripts/enable-auto-push.sh` once to enable the tracked hook. Git does not install hooks automatically on clone.
