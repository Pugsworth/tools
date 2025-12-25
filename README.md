# Pugsworth Tools

A collection of web-based tools, each hosted in its own branch and deployed to a subfolder on GitHub Pages.

## Repository Structure

- **`master` branch**: Contains the main landing page (`index.html`) and the deployment workflow.
- **`tool/*` branches**: Each branch starting with `tool/` contains a standalone web tool.

## How to Add a New Tool

### Simple Static Tool
1.  **Create a new branch**: `git checkout -b tool/your-tool-name`
2.  **Develop**: Create an `index.html` in the root.
3.  **Back Link**: Add `<a href="../../">← Back to Tools</a>`.
4.  **Push**: `git push origin tool/your-tool-name`

### React or Vue Tool
1.  **Create from template**:
    - For React: `git checkout -b tool/your-tool-name template/react`
    - For Vue: `git checkout -b tool/your-tool-name template/vue`
2.  **Develop**: Build your app as usual.
3.  **Push**: `git push origin tool/your-tool-name`

> [!NOTE]
> The deployment workflow automatically detects `package.json` and runs `npm install` and `npm run build`. It also handles the base path for Vite apps.

## Deployment

The repository uses GitHub Actions to automatically deploy:
- The `master` branch to the root of the GitHub Pages site.
- Any `tool/*` branch to a subfolder under `tools/`.

> [!IMPORTANT]
> Ensure that GitHub Pages is configured to deploy from the `gh-pages` branch.
