# Account Switcher for Claude Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Switch quickly between multiple logged-in Claude Code accounts, no re-login
needed. UI available in English and Vietnamese — follows your VS Code display
language ([`--locale`](https://code.visualstudio.com/docs/getstarted/locales)),
defaults to English if your language isn't packaged yet.

*(VSCode extension để chuyển đổi nhanh giữa nhiều tài khoản Claude Code đã
đăng nhập, không cần đăng nhập lại.)*

> This is an **unofficial, community** extension — not an Anthropic product.
> "Claude" and "Claude Code" are Anthropic's trademarks, referenced here only
> to describe compatibility.
>
> *(Đây là extension cộng đồng, không chính thức — không phải sản phẩm của
> Anthropic. "Claude" và "Claude Code" là thương hiệu của Anthropic, dùng ở
> đây chỉ để mô tả extension tương thích với Claude Code.)*

## Usage

1. Click the `Claude: ...` status bar item in the bottom-left corner.
2. Pick "Add a new account..." to log in another account (opens a terminal
   running `claude`, complete the OAuth login in your browser as usual).
3. Two ways to switch, depending on what you need:
   - **Click a profile name directly in the main menu** → "keep conversation"
     mode: only swaps the shared credentials; any **new** conversation opened
     afterward (in this window or any other unpinned window) uses the new
     account. Important: this does **not** change the account of a
     conversation that's already open — the `claude` subprocess behind it read
     `CLAUDE_CONFIG_DIR` once when it started and keeps that value for its
     whole lifetime, so overwriting the shared dir afterwards has no effect on
     it. Open a new conversation to actually see the new account.
   - **"Open an independent window with another profile..."** → only the
     current window uses that profile exclusively, isolated from other
     windows, but it opens a new conversation to do so.
4. To run multiple accounts side by side in independent windows: use "Open an
   independent window..." in each window rather than the regular switch
   (regular switch is shared — it changes every unpinned window at once).
5. Use VS Code Profiles (Work/Personal/...) so each Profile remembers its own
   Claude account automatically.

*(1. Bấm vào status bar item `Claude: ...` ở góc dưới bên trái. 2. Chọn "Thêm
tài khoản mới..." để đăng nhập thêm một tài khoản. 3. Có 2 cách switch: bấm
thẳng tên profile trong menu chính = "giữ conversation" (chỉ đổi credentials
dùng chung, conversation MỚI mở sau đó dùng tài khoản mới, KHÔNG đổi được
conversation đang mở sẵn); "Mở cửa sổ độc lập..." = chỉ cửa sổ này dùng riêng
profile đó, phải mở conversation mới. 4. Muốn chạy song song nhiều tài khoản:
dùng "Mở cửa sổ độc lập..." ở mỗi cửa sổ. 5. Dùng VSCode Profiles để mỗi
Profile tự nhớ riêng một tài khoản Claude.)*

All profiles share one `projects/` directory (conversation/session history) —
switching accounts never loses a project's existing session history.

*(Mọi profile dùng chung 1 thư mục `projects/` — đổi tài khoản không làm mất
session cũ của bất kỳ project nào.)*

## Current limitations

- **Windows** desktop VS Code only (remote/WSL/web extension, macOS, and
  Linux are untested).
- Relies on undocumented internal behavior of the official "Claude Code"
  extension (reading `CLAUDE_CONFIG_DIR` when it spawns its subprocess) — this
  could stop working if Anthropic changes how it spawns in a future release.
- **Don't use the same profile from two processes at once** (e.g. two windows
  pinned to the same profile, or "live" mode with several windows/subprocesses
  on the same account running long conversations in parallel). Every process
  sharing one `.credentials.json` holds the same refresh token in memory; if
  Anthropic's OAuth refresh tokens are single-use/rotating, whichever process
  refreshes first invalidates the others' copy, and a subsequent failed
  refresh has been observed to wipe `accessToken`/`refreshToken` to empty
  strings instead of failing safely — forcing a re-login. This looks like an
  edge case in the official CLI's refresh error handling, not something this
  extension's own file operations trigger (they never write to a profile's
  own `.credentials.json`, only to the shared `_live` copy). If it happens,
  just log in again for that profile's directory.

*(Chỉ hỗ trợ Windows desktop VSCode. Phụ thuộc hành vi nội bộ chưa document
của extension "Claude Code" chính thức — có thể ngừng hoạt động nếu Anthropic
đổi cách spawn ở bản mới. Tránh dùng cùng 1 profile từ 2 tiến trình cùng lúc
— dễ gây race lúc refresh token, có thể làm credentials bị ghi trắng, phải
đăng nhập lại.)*

## Build & install locally

```bash
npm install
npm run compile
npm run package        # produces the .vsix file
code --install-extension account-switcher-for-claude-code-0.2.1.vsix
```

## Development

```bash
npm test                # runs unit tests (node:test) for the pure logic modules
npm run watch            # tsc watch mode
```

Press `F5` in VS Code (with this project open) to launch the Extension
Development Host and test it live.

See the full design doc at
`docs/superpowers/specs/2026-08-20-claude-profile-switcher-design.md`.

## Contributing

Open source, issues and PRs welcome.

*(Repo mã nguồn mở, hoan nghênh issue/PR.)*

## Support

If this extension is useful to you, you can support it at: **(donate link —
to be added)**.

*(Nếu extension này có ích, bạn có thể ủng hộ tại: link donate sẽ cập nhật
sau.)*

## License

[MIT](LICENSE)
