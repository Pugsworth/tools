# Pugsworth Tools

A collection of web-based tools, each hosted in its own branch and deployed to a subfolder on GitHub Pages.

## Repository Structure

- **`master` branch**: Contains the main landing page (`index.html`) and the deployment workflow.
- **`tool/*` branches**: Each branch starting with `tool/` contains a standalone web tool.

## How to Add a New Tool

1.  **Create a new branch**:
    ```bash
    git checkout -b tool/your-tool-name
    ```
2.  **Develop your tool**:
    - Create an `index.html` file in the root of the branch.
    - Ensure all links to assets are relative.
    - Add a "Back to Tools" link: `<a href="../../">← Back to Tools</a>`.
3.  **Push the branch**:
    ```bash
    git push origin tool/your-tool-name
    ```
4.  **Update the landing page**:
    - Switch back to the `master` branch.
    - Add a new card to the `grid` in `index.html` linking to `tools/your-tool-name/`.

## Deployment

The repository uses GitHub Actions to automatically deploy:
- The `master` branch to the root of the GitHub Pages site.
- Any `tool/*` branch to a subfolder named after the tool.

> [!IMPORTANT]
> Ensure that GitHub Pages is configured to deploy from the `gh-pages` branch.
