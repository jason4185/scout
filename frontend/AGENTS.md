<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## SCOUT architecture
- Use TanStack file-based routes with shared SCOUT chrome in the root and unique leaf metadata; this preserves typed navigation and independently shareable pages.
- Keep all fictional business records in src/demo/mockData.ts and mutations in the pure transition adapter in src/demo/demoStore.tsx; this isolates phase-one simulation from future contract integration.
- Demo state is ephemeral React context with a reset action, never persistence or external calls; refresh restores the sample dataset.
- Reserve the frozen alert price on submission, settle only approval, and release rejected/inconclusive reservations; enforce spend, paid-alert and submission caps in the adapter.
- Keep reusable UI in src/components/scout and design roles in src/styles.css; this provides consistent styling and independent integration boundaries.
