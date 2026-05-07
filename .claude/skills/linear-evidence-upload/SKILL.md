---
name: linear-evidence-upload
description: Use when a GenUI Linear workflow already decided a local image must be uploaded to Linear and embedded as Markdown.
---

# Linear Evidence Upload

This is a helper skill, not a user-facing workflow entry point.

Use it only when:

- a local image path already exists
- the caller already decided the image is required evidence
- the goal is to obtain a Linear `assetUrl` and Markdown image snippet

This skill does not decide whether an image should be uploaded. It only performs the upload contract and reports success or failure.

## Critical: Do NOT Use Local Paths in Markdown

**Wrong approach** (images will NOT display):
```markdown
![Evidence](C:\path\to\image.png)
```
Linear CLI converts local paths to `uploads.linear.app` URLs which require authentication and fail in Linear Web UI.

**Correct approach** (images display correctly):
1. Upload via `linear issue attach` to get a **public URL** (`public.linear.app`)
2. Embed the public URL in Markdown

## Workflow

Read [references/upload-contract.md](references/upload-contract.md) for the full contract.

### Step 1: Upload Image

```bash
linear issue attach <issue-id> <local-image-path> --title "Evidence"
```

This outputs a public URL like:
```
https://public.linear.app/<workspace-id>/<asset-id>/<file-id>
```

### Step 2: Return Results

Return one of:

**Success:**
```
✓ Upload succeeded
  - localPath: <original-local-path>
  - assetUrl: https://public.linear.app/...
  - markdown: ![<title>](https://public.linear.app/...)
```

**Failure:**
```
✗ Upload failed
  - localPath: <original-local-path>
  - attempts: 3
  - error: <final-error-message>
```

## Prerequisites

- `LINEAR_API_KEY` must be available in environment
- `linear` CLI must be installed and authenticated
- Local image path must exist before upload

If `LINEAR_API_KEY` is missing, stop and report: `"LINEAR_API_KEY not available. Upload aborted."`

## Do Not

- **Do NOT** write `![](<local-path>)` in Markdown — images will not display
- **Do NOT** use MCP base64 attachment helpers — use Linear CLI `attach` command
- **Do NOT** silently proceed if API key is missing
- **Do NOT** swallow upload failures without reporting
