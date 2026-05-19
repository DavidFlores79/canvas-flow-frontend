# Create New GitHub Branch

**⚠️ DEPRECATED: This command is NOT used in the current workflow.**

**Current Workflow:**
- Create feature branches directly: `git checkout -b feat/feature-name develop`
- NO GitHub issues are created
- See `.claude/WORKFLOW-SUMMARY.md` for the correct workflow

---

## Input
Feature/Bug/Chore description: $ARGUMENTS

## Step 1: Retrieve Planning Information
1. **Load Session File**: Check for existing `.claude/sessions/context_session_{feature_name}.md` from explore-plan
2. **Extract Requirements**: Get detailed implementation plan and selected agents
3. **Validate Technology Stack**: Confirm which agents were selected:
   - Backend: NestJS or Laravel
   - Frontend: Angular or Flutter
4. **Generate Branch Name**: Create conventional branch name from feature description

## Step 2: Create GitHub Issue

Using information from the explore-plan session, create a comprehensive GitHub issue with this template:

### 📋 Problem Statement
- What problem does this solve?
- What are the current limitations or issues?
- Why is this important now?

### 🎯 User Value
- What specific benefits will users get?
- Provide concrete examples and scenarios
- How does this improve the user experience?

### 🔧 Technical Requirements
- Architecture considerations (Clean Architecture layers)
- Technology stack components involved
- Database changes needed (if any)
- API endpoints to create/modify
- UI components and pages required

### ✅ Definition of Done
- [ ] Implementation complete following Clean Architecture principles
- [ ] Unit tests added with >80% coverage
- [ ] Integration tests for main user flows
- [ ] E2E tests for critical paths
- [ ] Code follows project conventions and patterns
- [ ] Documentation updated (README, API docs, component docs)
- [ ] Code review approved by 1 reviewer
- [ ] All CI/CD checks pass (build, test, lint, security)
- [ ] Manual testing completed successfully
- [ ] Feature deployed to staging environment

### 🧪 Manual Testing Checklist
**Basic Flow:**
- [ ] [Specific step-by-step testing instructions]
- [ ] [Expected outcomes for each step]

**Edge Cases:**
- [ ] [Boundary value testing scenarios]
- [ ] [Invalid input handling]
- [ ] [Network/connectivity issues]

**Error Handling:**
- [ ] [Error scenarios to test]
- [ ] [Expected error messages and recovery]

**Integration Testing:**
- [ ] [Test with existing features]
- [ ] [Cross-browser/device compatibility]
- [ ] [Performance under load]

### 🏗️ Implementation Strategy
- Branch name: `feat/feature-name-kebab-case`
- Target branch: `develop`
- Estimated effort: [S/M/L/XL]
- Dependencies: [List any blocking issues or requirements]

### 📚 Related Documentation
- Link to any relevant architectural decisions
- Reference existing patterns or components to follow
- Link to design mockups or specifications (if applicable)

## Step 3: Create GitHub Issue
After validation, create the issue:

```bash
gh issue create --title "[TYPE] Your Issue Title Here" --body "Complete issue content here"
```

## Step 4: Create Feature Branch
Using information from explore-plan session:

1. **Generate Branch Name**: Convert feature description to kebab-case
   ```bash
   FEATURE_NAME=$(echo "$ARGUMENTS" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
   BRANCH_NAME="feat/$FEATURE_NAME"
   ```

2. **Ensure Clean State**: 
   ```bash
   git fetch origin
   git checkout develop 2>/dev/null || git checkout -b develop
   git pull origin develop 2>/dev/null || echo "No remote develop branch, continuing with local"
   ```

3. **Create Feature Branch**:
   ```bash
   git checkout -b $BRANCH_NAME develop
   echo "✅ Created branch: $BRANCH_NAME"
   ```

4. **Save Branch Info**: Update session file with branch name for next command

## Step 5: Link to Next Workflow Step
After branch creation:
1. Note the issue number, URL, and branch name
2. **Next step**: `start-working-on-branch-new <branch-name>` to begin implementation
3. Provide summary of what was created

## Quality Checklist
- ✅ Problem clearly defined with user impact
- ✅ Technical requirements specific to project stack  
- ✅ Testing steps are concrete and actionable
- ✅ Definition of Done includes all quality gates
- ✅ Implementation strategy considers branch workflow
- ✅ Focus on user benefits, not just technical details
- ✅ Properly categorized as Feature/Bug/Chore
```

Key improvements:
1. **Removed nested markdown** - The triple backticks inside the prompt were likely causing parsing issues
2. **Simplified structure** - Clearer step-by-step format
3. **Separated commands** - Split the issue creation and project assignment into two commands (gh CLI doesn't support --project flag in create command)
4. **Clearer placeholders** - YOUR_TITLE_HERE and YOUR_ISSUE_CONTENT_HERE are more obvious to replace
5. **Removed complex formatting** - Simplified the markdown structure to avoid parsing conflicts
6. **Direct instructions** - More imperative language that's easier to follow