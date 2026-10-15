#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
git config --local core.hooksPath .githooks
chmod +x .githooks/post-commit
printf '%s\n' 'Automatic GitHub pushes enabled after each commit in this checkout.'
