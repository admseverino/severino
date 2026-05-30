# Project Configuration Guide

This document explains how the `.vscode/` and `.cursor/rules/` configurations work and how to apply them to a clean Cursor installation.

---

## Table of Contents
1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [.vscode/ Configuration](#vscode-configuration)
4. [.cursor/rules/ Configuration](#cursorrules-configuration)
5. [Setup Guide for Clean Cursor Installation](#setup-guide-for-clean-cursor-installation)
6. [Usage Examples](#usage-examples)

---

## Overview

This project uses custom configurations to:
- **Automate deployment workflows** with semantic versioning
- **Control AI behavior** with context-specific rules
- **Maintain workspace separation** between different services

---

## Directory Structure

```
project-root/
├── .vscode/
│   ├── project_aliases      # Custom deployment commands
│   ├── .zshrc               # Loads aliases in integrated zsh (via ZDOTDIR)
│   ├── sessions.json        # Terminal session configs
│   └── terminals.json       # Terminal layout configs
│
└── .cursor/
    └── rules/
        ├── front.mdc        # AI rules for frontend work
        └── dash.mdc         # AI rules for dashboard work
```

---

## .vscode/ Configuration

### Purpose
The `.vscode/` folder contains workspace-specific settings and automation scripts.

### Key Files

#### 1. `project_aliases`
Custom bash functions for deploying services with semantic versioning.

**What it does:**
- Automates Git tag creation with semantic versioning (MAJOR.MINOR.PATCH)
- Pushes tags to trigger CI/CD pipelines
- Supports independent versioning for multiple services

**Available Commands:**
```bash
deployfront [major|minor|patch]    # Deploy frontend service
deploydash [major|minor|patch]     # Deploy dashboard service
deployfunction [major|minor|patch] # Deploy cloud function
deployjob [major|minor|patch]      # Deploy scheduled job
```

**Version Increment Examples:**
- `deploydash patch` → `dash-0.1.12` to `dash-0.1.13` (bug fixes)
- `deploydash minor` → `dash-0.1.12` to `dash-0.2.0` (new features)
- `deploydash major` → `dash-0.1.12` to `dash-1.0.0` (breaking changes)

**Default behavior:** If no argument is provided, defaults to `patch`.

#### 2. `settings.json` + `.zshrc`
Integrated terminals use the **severino zsh** / **severino bash** profile, which loads `project_aliases` on startup. A `runOn: folderOpen` task cannot do this (it runs in a separate shell that exits immediately).

---

## .cursor/rules/ Configuration

### Purpose
The `.cursor/rules/` folder contains AI behavior rules that guide Cursor's AI assistant on how to interact with your codebase.

### Key Files

#### 1. `front.mdc` - Frontend Rules
**Scope:** When working on the main frontend application (root folder)

**Rules:**
- ✅ Only modify root folder files
- ❌ Don't touch `/dash-service`, `/scraping-function`, or `/scraping-job`
- Uses MCP server for shadcn component integration
- Checks component demos before implementation

#### 2. `dash.mdc` - Dashboard Rules
**Scope:** When working on the admin dashboard

**Rules:**
- ✅ Only modify `/dash-service` folder
- ❌ Don't touch root, `/scraping-function`, or `/scraping-job`
- Uses MCP server for shadcn component integration
- Checks component demos before implementation

### How Rules Work
- Rules are **context-specific** and manually triggered (not always applied)
- They help prevent accidental cross-service modifications
- They ensure consistent component usage patterns

---

## Setup Guide for Clean Cursor Installation

### Step 1: Shell Configuration (One-Time Setup)

Add the following code to your shell configuration file to automatically load project-specific aliases:

**For Bash users:** Edit `~/.bashrc`
**For Zsh users:** Edit `~/.zshrc`

```bash
# === VS Code Project Alias Loader ===
# This checks if a VS Code workspace is open and sources project-specific aliases.

# 1. Define the alias file location relative to the project root
PROJECT_ALIAS_FILE=".vscode/project_aliases"

# 2. Check if the current directory is within a Git repository
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    # 3. Find the root of the Git repository
    REPO_ROOT=$(git rev-parse --show-toplevel)

    # 4. Construct the full path to the alias file
    FULL_ALIAS_PATH="$REPO_ROOT/$PROJECT_ALIAS_FILE"

    # 5. Check if the project-specific alias file exists and source it
    if [ -f "$FULL_ALIAS_PATH" ]; then
        echo "Loading project-specific deployment aliases..."
        source "$FULL_ALIAS_PATH"
        
        # Optional: Export the main function so aliases work in sub-shells
        export -f create_and_push_tag 
    fi
fi
# ====================================
```

**After editing, reload your shell:**
```bash
# For Bash
source ~/.bashrc

# For Zsh
source ~/.zshrc
```

### Step 2: Enable Cursor Rules

1. Open Cursor Settings (`Cmd/Ctrl + ,`)
2. Navigate to **Cursor Settings** → **Features** → **Rules**
3. Ensure **Cursor Rules** is enabled
4. Rules in `.cursor/rules/` will be available in the Cursor AI context menu

### Step 3: Verify Setup

1. **Check if aliases are loaded:**
   ```bash
   # Open a new terminal in your project
   type deployfront
   # Should output: deployfront is a function
   ```

2. **Test a deployment command:**
   ```bash
   # Dry run - check current tags
   git tag --sort=-v:refname | grep "^dash-"
   ```

3. **Check Cursor rules:**
   - Open Cursor AI chat
   - Look for rule options in the context menu
   - You should see `front.mdc` and `dash.mdc` available

---

## Usage Examples

### Deploying Services

**Scenario 1: Bug fix deployment**
```bash
# Make your code changes
git add .
git commit -m "fix: resolve login timeout issue"

# Deploy with patch version bump
deploydash patch
# Output: dash-0.1.12 → dash-0.1.13
```

**Scenario 2: New feature deployment**
```bash
# Make your code changes
git add .
git commit -m "feat: add user profile page"

# Deploy with minor version bump
deploydash minor
# Output: dash-0.1.12 → dash-0.2.0
```

**Scenario 3: Breaking change deployment**
```bash
# Make your code changes
git add .
git commit -m "feat!: redesign API endpoints"

# Deploy with major version bump
deploydash major
# Output: dash-0.1.12 → dash-1.0.0
```

### Using Cursor Rules

**When to use `front.mdc`:**
- Working on the main user-facing application
- Modifying files in the root `app/`, `components/`, `lib/` folders
- Ensures you don't accidentally modify other services

**When to use `dash.mdc`:**
- Working on the admin dashboard
- Modifying files in the `dash-service/` folder
- Keeps dashboard code isolated from frontend

**How to apply:**
1. Open Cursor AI chat
2. Click the rules selector (or mention `@front.mdc` / `@dash.mdc`)
3. Make your request with the rule active

---

## Troubleshooting

### Aliases not loading
Aliases load via the **severino zsh** / **severino bash** terminal profile in `settings.json`, not via a folder-open task. Open a **new** integrated terminal after changing settings (or run **Developer: Reload Window**).

```bash
# Confirm the workspace default profile is active (should show severino zsh / severino bash)
echo $ZDOTDIR   # macOS zsh: should end in .vscode

# Check if file exists
ls -la .vscode/project_aliases

# Check function exists
type deploydash

# Fallback: manual load
source .vscode/project_aliases
```

### Rules not appearing in Cursor
1. Ensure `.cursor/rules/` directory exists
2. Check file extensions are `.mdc` (not `.md`)
3. Verify YAML frontmatter is properly formatted
4. Restart Cursor

---

## Best Practices

1. **Commit before deploying:** Always commit your changes before running deploy commands
2. **Use semantic versioning:** Follow the MAJOR.MINOR.PATCH convention
3. **Choose the right rule:** Use `front.mdc` or `dash.mdc` based on what you're working on
4. **Test locally first:** Verify changes work before deploying
5. **Document breaking changes:** Use clear commit messages for major version bumps

---

## Additional Resources

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Cursor Documentation](https://cursor.sh/docs)
- [VS Code Terminal Profiles](https://code.visualstudio.com/docs/terminal/profiles)

---

**Last Updated:** October 2025

