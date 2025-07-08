# Release Guide

This guide explains how to create releases for the Astrodon project using the GitHub Actions workflows.

## Release Workflows

We have two release workflows available:

### 1. Basic Release (`release.yml`)

- **Trigger:** Push tags matching `v*` (e.g., `v1.0.0`)
- **Purpose:** Simple releases with basic changelog generation
- **Assets:** TAR.GZ and ZIP archives

### 2. Advanced Release (`release-advanced.yml`)

- **Trigger:** Push tags matching `v*`, `v*-alpha*`, `v*-beta*`, `v*-rc*`
- **Purpose:** Feature-rich releases with categorized changelogs and multiple archive formats
- **Assets:** Full TAR.GZ, ZIP, and minimal TAR.GZ archives
- **Features:** Automatic release type detection, categorized changelogs, build reports

## Creating a Release

### Step 1: Prepare Your Changes

1. Make your changes and commit them
2. Update version in `package.json` if needed
3. Test your build locally:
   ```bash
   deno task build
   ```

### Step 2: Create and Push a Tag

#### For a Regular Release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

#### For Pre-releases:

```bash
# Alpha release
git tag v1.0.0-alpha.1
git push origin v1.0.0-alpha.1

# Beta release
git tag v1.0.0-beta.1
git push origin v1.0.0-beta.1

# Release candidate
git tag v1.0.0-rc.1
git push origin v1.0.0-rc.1
```

### Step 3: Monitor the Workflow

1. Go to the "Actions" tab in your GitHub repository
2. Watch the release workflow run
3. Check the build report for any issues
4. Review the generated release on the "Releases" page

## Release Types and Behavior

### Regular Releases (`v1.0.0`)

- Creates a full release
- Not marked as pre-release
- Includes all assets

### Alpha Releases (`v1.0.0-alpha.1`)

- Marked as pre-release
- Includes 🚧 emoji in title
- Suitable for early testing

### Beta Releases (`v1.0.0-beta.1`)

- Marked as pre-release
- Includes 🧪 emoji in title
- Suitable for feature testing

### Release Candidates (`v1.0.0-rc.1`)

- Marked as pre-release
- Includes 🎯 emoji in title
- Suitable for final testing before release

## Changelog Generation

The advanced release workflow automatically generates changelogs by categorizing commits:

- **🚨 Breaking Changes:** Commits containing "breaking" or "major"
- **✨ New Features:** Commits containing "feat", "feature", or "add"
- **🐛 Bug Fixes:** Commits containing "fix", "bug", or "patch"
- **📝 Other Changes:** All other commits

### Commit Message Guidelines

For better changelog generation, use these prefixes in your commit messages:

```bash
git commit -m "feat: add new lua script support"
git commit -m "fix: resolve build optimization issue"
git commit -m "breaking: change API interface"
git commit -m "docs: update README with new features"
```

## Release Assets

### Basic Release Assets

- `astrodon-{version}.tar.gz` - Full build archive
- `astrodon-{version}.zip` - Windows-friendly archive

### Advanced Release Assets

- `astrodon-{version}.tar.gz` - Complete build with all assets
- `astrodon-{version}.zip` - Windows-friendly format
- `astrodon-{version}-minimal.tar.gz` - Essential files only

## Build Information

Each release includes:

- Build date and time
- Deno runtime version
- File counts and sizes
- Archive sizes
- Release type and status

## Troubleshooting

### Workflow Fails

1. Check the Actions tab for error details
2. Ensure your tag follows the correct format
3. Verify the build works locally first
4. Check that all required files are present in the `dist/` directory

### Missing Assets

1. Verify the build step completed successfully
2. Check that the `dist/` directory contains the expected files
3. Review the build size report in the workflow logs

### Changelog Issues

1. Ensure commit messages follow the guidelines
2. Check that the repository has sufficient history for changelog generation
3. Verify the tag is properly formatted

## Best Practices

1. **Test Before Release:** Always test your build locally before creating a release
2. **Use Semantic Versioning:** Follow semver.org guidelines for version numbers
3. **Write Clear Commit Messages:** Use descriptive commit messages for better changelogs
4. **Review Release Notes:** Check the generated release notes before publishing
5. **Use Pre-releases:** Use alpha/beta/rc tags for testing before final releases

## Workflow Configuration

The workflows are configured with:

- **Deno Version:** v2.4.0
- **Cache Strategy:** Deno dependencies cached for faster builds
- **Artifact Retention:** 30 days for build artifacts
- **Permissions:** Write access to contents and packages

## Customization

You can customize the workflows by:

- Modifying the Deno version in the setup step
- Adjusting the changelog categorization logic
- Adding additional archive formats
- Customizing the release notes template
- Adding additional build steps or checks
