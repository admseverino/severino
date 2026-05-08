# React + TypeScript + Next.js — AI Dev Rules

## TypeScript

1. **No `any`.** Use `unknown` and narrow it, or define a proper type/interface.
2. **Prefer `interface` for object shapes, `type` for unions/intersections/primitives.**
3. **Type all function signatures** — parameters and return values, always.
4. **Use `as` casts only as a last resort.** If you need one often, your types are wrong.
5. **Enable strict mode** in `tsconfig.json`. Never disable it to silence errors.

## React

1. **Functional components only.** No class components.
2. **One component per file.** Name the file after the component (`UserCard.tsx`).
3. **Derive state when possible.** Don't duplicate data across multiple `useState` calls that could be computed from one.
4. `**useEffect` is a last resort** for synchronization, not for logic that belongs in event handlers.
5. **Never mutate state directly.** Always return new objects/arrays.
6. **Keys in lists must be stable and unique** — never use array index as key for dynamic lists.

## Next.js

1. **Default to Server Components.** Add `"use client"` only when you actually need interactivity, browser APIs, or hooks.
2. **Data fetching lives in Server Components or Route Handlers** — not in `useEffect` on the client.
3. **Use `next/image`** instead of `<img>` for all images. Use `next/link` instead of `<a>` for all internal navigation.
4. **Use App Router conventions:** `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`. Don't invent your own structure.
5. **Colocate routes with their components.** A route's exclusive components live inside its route folder, not in a global `/components`.

## General

1. **No unused imports, variables, or dead code.** Clean it before committing.
2. **Small, single-responsibility components and functions.** If you need to scroll to understand it, split it.
3. **Handle all states:** loading, empty, and error — not just the happy path.
4. **Accessibility is not optional.** Interactive elements must be keyboard-navigable and have proper ARIA labels.
5. Make it simple and make it robust.

