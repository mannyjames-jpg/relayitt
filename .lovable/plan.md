# Dashboard keyboard and summary updates

## What will change
- Add the dynamic task-count browser title and dashboard-wide keyboard shortcuts for capture, task movement, completion, and shortcut help.
- Add an accessible shortcuts dialog that opens only from the `?` key and closes with Escape.
- Add late/follow-up and up-next lines beneath the greeting, using the dashboard's visible task data and existing follow-up rules.
- Replace the source dropdown with accessible filter pills that scroll only within their row on phones.
- Add the requested checkbox press feedback and reduced-motion override.

## Technical details
- Expose the Quick Capture input through a React ref.
- Mark task title and completion controls with data attributes so dashboard keyboard navigation follows visible DOM order and skips collapsed panels.
- Preserve focus after keyboard completion by watching for the completed row to leave the rendered list, then focus the same visible index or the final task.
- Reuse the existing Dialog and Button components and current visual tokens; add no packages.
- Limit edits to `dashboard.tsx`, `HeroSummary.tsx`, `QuickCapture.tsx`, `TaskRow.tsx`, and `styles.css`.

## Verification
- Check keyboard behavior and dialog handling in the signed-in dashboard.
- Check the 390px viewport for summary truncation, pill-only horizontal scrolling, and no page overflow.
- Exercise add, expand, complete/undo, step, delete/undo, follow-up, and voice controls where the available session permits.
- Confirm the latest preview build and browser console are clean.
