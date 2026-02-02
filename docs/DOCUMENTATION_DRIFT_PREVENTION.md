# WebWaka Documentation Drift Prevention Strategy

**Version:** 1.0  
**Last Updated:** February 1, 2026  
**Issue:** #52 (DOC-003)

---

## Table of Contents

1. [Overview](#overview)
2. [Auto-Generation](#auto-generation)
3. [Verification Hooks](#verification-hooks)
4. [Enforcement Rules](#enforcement-rules)
5. [Documentation Standards](#documentation-standards)
6. [Documentation Process](#documentation-process)
7. [Monitoring & Alerting](#monitoring--alerting)
8. [Implementation Guide](#implementation-guide)
9. [Tooling & Automation](#tooling--automation)

---

## Overview

Documentation drift occurs when code changes but documentation doesn't. This strategy implements systematic processes and tooling to prevent drift through automation, verification, and enforcement.

### Core Principles

1. **Automate where possible** - Generate docs from code
2. **Verify continuously** - Check docs in CI/CD
3. **Enforce rigorously** - Require doc updates in PRs
4. **Monitor proactively** - Track drift metrics
5. **Make it easy** - Reduce friction for developers

---

## Auto-Generation

### API Documentation (OpenAPI)

**Goal:** Generate API documentation automatically from OpenAPI specifications.

**Implementation:**

```yaml
# .github/workflows/generate-api-docs.yml
name: Generate API Documentation

on:
  push:
    paths:
      - 'openapi/**/*.yaml'
      - 'openapi/**/*.json'
  pull_request:
    paths:
      - 'openapi/**/*.yaml'
      - 'openapi/**/*.json'

jobs:
  generate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Redoc CLI
        run: npm install -g redoc-cli
      
      - name: Generate API Documentation
        run: |
          redoc-cli bundle openapi/api.yaml -o docs/api/index.html
          
      - name: Commit generated docs
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add docs/api/
          git diff --quiet && git diff --staged --quiet || git commit -m "docs: auto-generate API documentation"
          git push
```

**Tools:**
- **Redoc:** Beautiful API documentation from OpenAPI
- **Swagger UI:** Interactive API documentation
- **Stoplight:** API design and documentation platform

---

### Configuration Documentation

**Goal:** Generate configuration documentation from JSON Schema.

**Implementation:**

```javascript
// scripts/generate-config-docs.js
const fs = require('fs');
const path = require('path');

function generateConfigDocs(schema) {
  let markdown = '# Configuration Reference\n\n';
  
  markdown += '## Properties\n\n';
  
  for (const [key, prop] of Object.entries(schema.properties)) {
    markdown += `### \`${key}\`\n\n`;
    markdown += `**Type:** \`${prop.type}\`\n\n`;
    
    if (prop.description) {
      markdown += `${prop.description}\n\n`;
    }
    
    if (prop.default !== undefined) {
      markdown += `**Default:** \`${JSON.stringify(prop.default)}\`\n\n`;
    }
    
    if (prop.enum) {
      markdown += `**Allowed values:** ${prop.enum.map(v => `\`${v}\``).join(', ')}\n\n`;
    }
    
    if (prop.required) {
      markdown += `**Required:** Yes\n\n`;
    }
    
    markdown += '---\n\n';
  }
  
  return markdown;
}

// Load schema
const schema = JSON.parse(fs.readFileSync('config/schema.json', 'utf8'));

// Generate docs
const docs = generateConfigDocs(schema);

// Write to file
fs.writeFileSync('docs/configuration.md', docs);

console.log('Configuration documentation generated successfully');
```

**Package.json script:**

```json
{
  "scripts": {
    "docs:config": "node scripts/generate-config-docs.js"
  }
}
```

---

### Architecture Diagrams

**Goal:** Generate architecture diagrams from code or configuration.

**Implementation:**

```yaml
# diagrams/architecture.d2
title: WebWaka Offline-First Architecture {
  near: top-center
  shape: text
  style.font-size: 24
  style.bold: true
}

Client: {
  UI: User Interface
  LocalStore: Local Storage (IndexedDB)
  TxQueue: Transaction Queue
  SyncEngine: Sync Engine
}

Server: {
  API: REST API
  DB: PostgreSQL
  Cache: Redis
}

Client.UI -> Client.LocalStore: Read/Write
Client.UI -> Client.TxQueue: Queue Operations
Client.TxQueue -> Client.SyncEngine: Sync
Client.SyncEngine -> Server.API: HTTP
Server.API -> Server.DB: Query
Server.API -> Server.Cache: Cache
```

**Generation script:**

```bash
#!/bin/bash
# scripts/generate-diagrams.sh

# Generate D2 diagrams
d2 diagrams/architecture.d2 docs/images/architecture.png

# Generate Mermaid diagrams
mmdc -i diagrams/sequence.mmd -o docs/images/sequence.png

echo "Diagrams generated successfully"
```

---

## Verification Hooks

### Pre-Commit Hook

**Goal:** Verify documentation before committing.

**Implementation:**

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      # Check for broken links
      - id: check-links
        name: Check documentation links
        entry: markdown-link-check
        language: node
        files: \.md$
        additional_dependencies: ['markdown-link-check']
      
      # Check spelling
      - id: check-spelling
        name: Check spelling
        entry: cspell
        language: node
        files: \.md$
        additional_dependencies: ['cspell']
      
      # Validate OpenAPI specs
      - id: validate-openapi
        name: Validate OpenAPI specifications
        entry: openapi-validator
        language: node
        files: ^openapi/.*\.(yaml|json)$
        additional_dependencies: ['ibm-openapi-validator']
      
      # Check if docs were updated with code
      - id: check-doc-sync
        name: Check documentation sync
        entry: python scripts/check-doc-sync.py
        language: python
        pass_filenames: false
```

**Install pre-commit:**

```bash
pip install pre-commit
pre-commit install
```

---

### CI/CD Verification

**Goal:** Verify documentation in CI/CD pipeline.

**Implementation:**

```yaml
# .github/workflows/verify-docs.yml
name: Verify Documentation

on:
  pull_request:
    paths:
      - 'docs/**'
      - 'openapi/**'
      - 'src/**'

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check for broken links
        uses: gaurav-nelson/github-action-markdown-link-check@v1
        with:
          use-quiet-mode: 'yes'
          folder-path: 'docs/'
      
      - name: Validate OpenAPI specs
        run: |
          npm install -g ibm-openapi-validator
          openapi-validator openapi/api.yaml
      
      - name: Check documentation coverage
        run: |
          python scripts/check-doc-coverage.py
      
      - name: Check for outdated docs
        run: |
          python scripts/check-outdated-docs.py
      
      - name: Verify code examples
        run: |
          python scripts/verify-code-examples.py
```

---

### Documentation Coverage Check

**Goal:** Ensure all public APIs are documented.

**Implementation:**

```python
# scripts/check-doc-coverage.py
import ast
import os
import sys

def get_public_functions(filepath):
    """Extract public functions from Python file."""
    with open(filepath) as f:
        tree = ast.parse(f.read())
    
    functions = []
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            if not node.name.startswith('_'):
                functions.append(node.name)
    
    return functions

def check_function_documented(function_name, filepath):
    """Check if function has docstring."""
    with open(filepath) as f:
        tree = ast.parse(f.read())
    
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == function_name:
            return ast.get_docstring(node) is not None
    
    return False

def main():
    undocumented = []
    
    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                functions = get_public_functions(filepath)
                
                for func in functions:
                    if not check_function_documented(func, filepath):
                        undocumented.append(f"{filepath}::{func}")
    
    if undocumented:
        print("❌ Undocumented functions found:")
        for item in undocumented:
            print(f"  - {item}")
        sys.exit(1)
    else:
        print("✅ All public functions are documented")
        sys.exit(0)

if __name__ == '__main__':
    main()
```

---

## Enforcement Rules

### Pull Request Template

**Goal:** Require documentation updates in PRs.

**Implementation:**

```markdown
# .github/pull_request_template.md

## Description
<!-- Describe your changes -->

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Documentation Checklist
- [ ] I have updated the relevant documentation
- [ ] I have added/updated API documentation (if applicable)
- [ ] I have added/updated configuration documentation (if applicable)
- [ ] I have updated architecture diagrams (if applicable)
- [ ] I have verified all code examples work
- [ ] I have checked for broken links

## Testing
<!-- Describe how you tested your changes -->

## Related Issues
<!-- Link to related issues -->
```

---

### GitHub Actions Enforcement

**Goal:** Block PRs that don't update documentation.

**Implementation:**

```yaml
# .github/workflows/enforce-docs.yml
name: Enforce Documentation Updates

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  check-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Check if code changed
        id: code-changed
        run: |
          CODE_CHANGED=$(git diff --name-only origin/main...HEAD | grep -E '^src/|^lib/' | wc -l)
          echo "code_changed=$CODE_CHANGED" >> $GITHUB_OUTPUT
      
      - name: Check if docs changed
        id: docs-changed
        run: |
          DOCS_CHANGED=$(git diff --name-only origin/main...HEAD | grep -E '^docs/|^README.md' | wc -l)
          echo "docs_changed=$DOCS_CHANGED" >> $GITHUB_OUTPUT
      
      - name: Verify documentation updated
        if: steps.code-changed.outputs.code_changed > 0 && steps.docs-changed.outputs.docs_changed == 0
        run: |
          echo "❌ Code changed but documentation was not updated"
          echo "Please update the relevant documentation before merging"
          exit 1
      
      - name: Success
        if: steps.code-changed.outputs.code_changed == 0 || steps.docs-changed.outputs.docs_changed > 0
        run: |
          echo "✅ Documentation requirements met"
```

---

### CODEOWNERS for Documentation

**Goal:** Require documentation team review.

**Implementation:**

```
# .github/CODEOWNERS

# Documentation requires review from docs team
/docs/ @webwaka/docs-team
*.md @webwaka/docs-team
/openapi/ @webwaka/api-team @webwaka/docs-team
```

---

## Documentation Standards

### Format Standards

**Markdown Style Guide:**

```markdown
# Documentation Style Guide

## Headings
- Use ATX-style headings (`#` syntax)
- One H1 per document
- Don't skip heading levels
- Add blank line before and after headings

## Lists
- Use `-` for unordered lists
- Use `1.` for ordered lists
- Indent nested lists with 2 spaces

## Code Blocks
- Always specify language for syntax highlighting
- Use \`\`\`typescript for TypeScript code
- Use \`\`\`bash for shell commands
- Use \`\`\`json for JSON examples

## Links
- Use reference-style links for repeated URLs
- Use descriptive link text (not "click here")
- Check all links before committing

## Tables
- Use tables for structured data
- Align columns with pipes
- Include header row

## Examples
- Provide working code examples
- Test all examples before committing
- Include expected output
```

---

### Completeness Standards

**Documentation Checklist:**

- [ ] **Purpose:** What does this do?
- [ ] **Usage:** How do I use it?
- [ ] **Examples:** Working code examples
- [ ] **Parameters:** All parameters documented
- [ ] **Return values:** What does it return?
- [ ] **Errors:** What errors can occur?
- [ ] **Related:** Links to related docs

---

### Accuracy Standards

**Verification Requirements:**

1. **Code examples must work** - Test all examples
2. **Links must be valid** - Check for broken links
3. **Versions must match** - Update version numbers
4. **Screenshots must be current** - Update outdated images
5. **API signatures must match** - Verify against code

---

## Documentation Process

### When to Update Documentation

| Change Type | Documentation Required | Examples |
|-------------|----------------------|----------|
| **New Feature** | Yes - Full documentation | API endpoints, UI components, configuration options |
| **Bug Fix** | Maybe - If behavior changes | Update examples if behavior changed |
| **Refactor** | Maybe - If API changes | Update if public API changed |
| **Performance** | No - Unless user-visible | Document if users need to change config |
| **Tests** | No | Internal tests don't need docs |
| **Dependencies** | Maybe - If breaking changes | Document migration steps |

---

### How to Update Documentation

**Step-by-step process:**

1. **Identify affected docs**
   - API documentation
   - User guides
   - Configuration docs
   - Architecture diagrams

2. **Update documentation**
   - Edit relevant markdown files
   - Update code examples
   - Regenerate diagrams if needed

3. **Verify changes**
   - Test all code examples
   - Check for broken links
   - Run spell check

4. **Commit with code**
   - Include docs in same PR as code
   - Reference docs in commit message
   - Update changelog

---

### Who Updates Documentation

| Role | Responsibility |
|------|---------------|
| **Developer** | Update technical docs, API docs, code examples |
| **Product Manager** | Update user guides, feature descriptions |
| **Tech Writer** | Review, edit, maintain style consistency |
| **DevOps** | Update deployment docs, infrastructure docs |

---

### How to Verify Documentation

**Verification checklist:**

```bash
# 1. Check for broken links
markdown-link-check docs/**/*.md

# 2. Check spelling
cspell "docs/**/*.md"

# 3. Validate OpenAPI specs
openapi-validator openapi/api.yaml

# 4. Test code examples
python scripts/test-code-examples.py

# 5. Check documentation coverage
python scripts/check-doc-coverage.py

# 6. Generate and review diffs
git diff docs/
```

---

## Monitoring & Alerting

### Drift Metrics

**Metrics to track:**

1. **Documentation age** - Time since last update
2. **Code-to-docs ratio** - Lines of code per doc page
3. **Broken links count** - Number of broken links
4. **Undocumented APIs** - Public APIs without docs
5. **Outdated examples** - Code examples that don't work

---

### Monitoring Dashboard

**Implementation:**

```python
# scripts/generate-doc-metrics.py
import os
import json
from datetime import datetime

def calculate_doc_age(filepath):
    """Calculate days since file was last modified."""
    mtime = os.path.getmtime(filepath)
    age_days = (datetime.now().timestamp() - mtime) / 86400
    return int(age_days)

def count_broken_links(filepath):
    """Count broken links in markdown file."""
    # Implementation using markdown-link-check
    pass

def count_undocumented_apis():
    """Count public APIs without documentation."""
    # Implementation using AST parsing
    pass

def generate_metrics():
    metrics = {
        'timestamp': datetime.now().isoformat(),
        'doc_age': {},
        'broken_links': 0,
        'undocumented_apis': 0,
        'total_docs': 0
    }
    
    for root, dirs, files in os.walk('docs'):
        for file in files:
            if file.endswith('.md'):
                filepath = os.path.join(root, file)
                metrics['doc_age'][filepath] = calculate_doc_age(filepath)
                metrics['total_docs'] += 1
    
    metrics['broken_links'] = count_broken_links('docs')
    metrics['undocumented_apis'] = count_undocumented_apis()
    
    # Save metrics
    with open('metrics/doc-metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)
    
    return metrics

if __name__ == '__main__':
    metrics = generate_metrics()
    print(json.dumps(metrics, indent=2))
```

---

### Alerting Rules

**Slack webhook integration:**

```yaml
# .github/workflows/doc-alerts.yml
name: Documentation Alerts

on:
  schedule:
    - cron: '0 9 * * 1' # Every Monday at 9am

jobs:
  check-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Generate metrics
        run: python scripts/generate-doc-metrics.py
      
      - name: Check for drift
        run: |
          python scripts/check-doc-drift.py
      
      - name: Send Slack alert
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "⚠️ Documentation drift detected",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Documentation Drift Alert*\n\nSome documentation is outdated or missing. Please review."
                  }
                }
              ]
            }
```

---

## Implementation Guide

### Phase 1: Auto-Generation (Week 1)

1. Set up OpenAPI spec generation
2. Implement config docs generation
3. Set up diagram generation
4. Create generation scripts

### Phase 2: Verification (Week 2)

1. Install pre-commit hooks
2. Set up CI/CD verification
3. Implement coverage checks
4. Test verification pipeline

### Phase 3: Enforcement (Week 3)

1. Create PR template
2. Set up GitHub Actions enforcement
3. Configure CODEOWNERS
4. Train team on process

### Phase 4: Monitoring (Week 4)

1. Implement metrics collection
2. Create monitoring dashboard
3. Set up alerting
4. Review and iterate

---

## Tooling & Automation

### Recommended Tools

| Tool | Purpose | Installation |
|------|---------|-------------|
| **Redoc** | API documentation | `npm install -g redoc-cli` |
| **Swagger UI** | Interactive API docs | `npm install swagger-ui-express` |
| **markdown-link-check** | Check broken links | `npm install -g markdown-link-check` |
| **cspell** | Spell checking | `npm install -g cspell` |
| **pre-commit** | Git hooks | `pip install pre-commit` |
| **D2** | Diagram generation | `brew install d2` |
| **Mermaid** | Diagram generation | `npm install -g @mermaid-js/mermaid-cli` |

---

### Automation Scripts

**Package.json:**

```json
{
  "scripts": {
    "docs:generate": "npm run docs:api && npm run docs:config && npm run docs:diagrams",
    "docs:api": "redoc-cli bundle openapi/api.yaml -o docs/api/index.html",
    "docs:config": "node scripts/generate-config-docs.js",
    "docs:diagrams": "bash scripts/generate-diagrams.sh",
    "docs:verify": "npm run docs:links && npm run docs:spell && npm run docs:coverage",
    "docs:links": "markdown-link-check docs/**/*.md",
    "docs:spell": "cspell 'docs/**/*.md'",
    "docs:coverage": "python scripts/check-doc-coverage.py"
  }
}
```

---

## Conclusion

WebWaka's documentation drift prevention strategy ensures:

1. ✅ **Automated generation** - Docs generated from code
2. ✅ **Continuous verification** - Checked in CI/CD
3. ✅ **Rigorous enforcement** - Required in PRs
4. ✅ **Clear standards** - Format, completeness, accuracy
5. ✅ **Defined process** - When, how, who, verify
6. ✅ **Proactive monitoring** - Track drift metrics

This strategy keeps documentation in sync with code automatically.

---

**Document Version:** 1.0  
**Last Updated:** February 1, 2026  
**Maintained By:** WebWaka Documentation Team
