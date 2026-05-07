# Upload Contract

## The Problem

Linear CLI handles local image paths in Markdown descriptions differently than direct attachments:

| Method | Result URL | Accessibility |
|--------|-----------|---------------|
| `![](local/path.png)` in Markdown | `uploads.linear.app/...` (private) | **Requires auth** — Linear UI fails to load |
| `linear issue attach <issue-id> <path>` | `public.linear.app/...` (public) | **Publicly accessible** — Works everywhere |

**Wrong approach**: Writing `![](C:\path\to\image.png)` in issue description results in broken images in Linear Web UI.

**Correct approach**: Upload first via `attach`, get the public URL, then embed that URL in Markdown.

## Workflow

### Step 1: Upload Image

```bash
linear issue attach <issue-id> <local-image-path> --title "Image title"
```

Output includes the public URL:
```
✓ Uploaded image.png
✓ Attachment created: Image title
https://public.linear.app/<workspace-id>/<asset-id>/<file-id>
```

### Step 2: Capture Public URL

Extract the `public.linear.app` URL from the output. This URL is:
- Publicly accessible (no auth required)
- Cacheable (max-age=31536000)
- Permanent (associated with the Linear asset)

### Step 3: Embed in Markdown

Use the public URL directly:

```markdown
![Image title](https://public.linear.app/...)
```

### Alternative: Upload with Comment

For one-shot upload + comment:

```bash
linear issue attach <issue-id> <path> --title "Title" --comment "Evidence attached"
```

The comment will include the attachment reference, and the image will be visible in the issue timeline.

## Error Handling

### Missing API Key

If `LINEAR_API_KEY` is not set:
- Stop immediately
- Report: `"LINEAR_API_KEY not available in environment. Upload aborted."`
- Do not proceed with any upload attempt

### Upload Failure

If upload fails after retries:
- Return failure report with:
  - Original local path
  - Number of retry attempts
  - Final error message
- Never silently swallow failures

### Invalid Local Path

If the local image path does not exist:
- Check path existence before attempting upload
- Report: `"Local image path does not exist: <path>"`

## Retry Policy

- Maximum 3 retry attempts for transient failures
- On final failure, report all attempts in the failure summary

## Output Format

### Success

```
✓ Upload succeeded
  - localPath: <original-local-path>
  - assetUrl: https://public.linear.app/...
  - markdown: ![<title>](https://public.linear.app/...)
```

### Failure

```
✗ Upload failed
  - localPath: <original-local-path>
  - attempts: 3
  - error: <final-error-message>
```

## Do Not

- **Do NOT** write `![](<local-path>)` in Markdown descriptions — images will not display
- **Do NOT** use MCP base64 attachment helpers — use Linear's official `fileUpload` flow via CLI
- **Do NOT** silently proceed if API key is missing
- **Do NOT** swallow upload failures without reporting
