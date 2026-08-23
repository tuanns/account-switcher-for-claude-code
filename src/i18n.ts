/**
 * Matches `vscode.l10n.t`'s signature: a template with `{0}`, `{1}`, ...
 * placeholders plus positional args.
 *
 * A few modules (`addProfileLogic.ts`, `statusBarText.ts`) are pure logic
 * unit-tested with plain `node --test`, where the real `vscode` module
 * doesn't exist — they can't import it directly. They accept an optional
 * `Translate` function instead, defaulting to `identityTranslate` (which
 * just substitutes placeholders into the literal Vietnamese source string,
 * so existing tests that call them with no translator keep getting exactly
 * the same output as before). Real callers running inside the extension
 * host pass `vscode.l10n.t` itself.
 */
export type Translate = (template: string, ...args: Array<string | number | boolean>) => string;

export const identityTranslate: Translate = (template, ...args) =>
  template.replace(/\{(\d+)\}/g, (_, i: string) => String(args[Number(i)] ?? ''));
