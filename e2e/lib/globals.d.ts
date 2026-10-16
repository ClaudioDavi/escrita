// Obsidian's globals, as seen from inside page.evaluate callbacks. Typed loosely on purpose:
// the harness reads the app's internals, which the public .d.ts does not describe.
declare const app: any;
interface Window { app: any }
