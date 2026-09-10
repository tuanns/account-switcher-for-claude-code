# Profile Switcher for Claude Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Switch quickly between multiple logged-in Claude Code accounts, no re-login
needed. UI available in English and Vietnamese — follows your VS Code display
language ([`--locale`](https://code.visualstudio.com/docs/getstarted/locales)),
defaults to English if your language isn't packaged yet.

*(VSCode extension để chuyển đổi nhanh giữa nhiều tài khoản Claude Code đã
đăng nhập, không cần đăng nhập lại.)*

> **Open source — read the code before you install it.** This extension
> touches your Claude Code credentials (`.credentials.json`), so don't just
> take our word that it's safe: every line is public at
> [github.com/tuanns/account-switcher-for-claude-code](https://github.com/tuanns/account-switcher-for-claude-code),
> under the MIT license, free to audit, fork, or build yourself from source
> instead of installing the packaged `.vsix`.
>
> *(Mã nguồn mở — hãy tự đọc code trước khi cài. Extension này đụng vào
> credentials Claude Code của bạn (`.credentials.json`), nên đừng chỉ tin lời
> chúng tôi nói là an toàn: toàn bộ code đều công khai tại
> [github.com/tuanns/account-switcher-for-claude-code](https://github.com/tuanns/account-switcher-for-claude-code),
> giấy phép MIT, tự do kiểm tra, fork, hoặc tự build từ source thay vì cài
> file `.vsix` đóng gói sẵn.)*

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

All profiles share the same `projects/` (conversation/session history),
`plugins/`, and `skills/` — switching accounts never loses a project's
session history, installed plugins, or installed skills. Only credentials
and account identity stay per-profile.

*(Mọi profile dùng chung `projects/`, `plugins/`, `skills/` — đổi tài khoản
không làm mất session cũ, plugin hay skill đã cài của bất kỳ project nào.
Chỉ credentials và danh tính tài khoản là riêng theo từng profile.)*

### Pinning a specific workspace to an account

The regular switch (and even "Open an independent window...") is stored
app-wide: switching accounts in *any* window updates that shared state, so a
window you didn't touch can end up on the wrong account the next time it
re-reads it. If you have a project that must always use one specific
account no matter what happens in your other windows, use **"Pin this
workspace to a profile..."** in the menu instead — it's stored per
folder/workspace, not shared with any other window, and always resolves to
that profile's own directory (never the shared "live" one), so it's
completely immune to switches made anywhere else. Use **"Unpin this
workspace"** to go back to following the regular app-wide switch.

*(Switch thường (kể cả "Mở cửa sổ độc lập...") đều lưu chung toàn ứng dụng —
đổi tài khoản ở BẤT KỲ cửa sổ nào cũng cập nhật state dùng chung đó, nên một
cửa sổ bạn không hề đụng vào vẫn có thể bị đổi sang tài khoản khác ở lần đọc
tiếp theo. Nếu có project bắt buộc phải luôn dùng đúng 1 tài khoản bất kể các
cửa sổ khác làm gì, dùng **"Ghim thư mục này với 1 profile..."** trong menu —
lưu riêng theo từng thư mục/workspace, không dùng chung với cửa sổ nào khác,
và luôn trỏ thẳng vào thư mục riêng của profile đó (không bao giờ qua thư mục
"live" dùng chung) nên hoàn toàn miễn nhiễm với switch ở nơi khác. Dùng **"Bỏ
ghim thư mục này"** để quay lại dùng theo switch chung toàn ứng dụng.)*

## Current limitations

- Developed and tested on **Windows** desktop VS Code. Nothing in the code is
  Windows-specific (paths use `path.join`, the one OS branch already handles
  `which` vs `where`, and the directory-sharing symlinks fall back to plain
  symlinks — no special handling needed — on non-Windows per Node's docs), so
  it likely works as-is on **macOS/Linux** desktop VS Code too, but this
  hasn't actually been run there yet — remote/WSL/web extension are also
  untested. Try it and report back if something's off.
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

*(Được phát triển và test trên Windows desktop VSCode. Code không có gì
Windows-riêng (path dùng `path.join`, nhánh OS đã xử lý đúng `which`/`where`,
symlink chia sẻ thư mục tự động fallback về symlink thường trên non-Windows)
nên nhiều khả năng chạy được luôn trên macOS/Linux desktop VSCode, nhưng
chưa thực sự chạy thử trên đó — remote/WSL/web extension cũng chưa test.
Cứ thử và báo lại nếu có gì bất thường. Phụ thuộc hành vi nội bộ chưa
document của extension "Claude Code" chính thức — có thể ngừng hoạt động
nếu Anthropic đổi cách spawn ở bản mới. Tránh dùng cùng 1 profile từ 2 tiến
trình cùng lúc — dễ gây race lúc refresh token, có thể làm credentials bị
ghi trắng, phải đăng nhập lại.)*

## Build & install locally

```bash
npm install
npm run compile
npm run package        # produces the .vsix file
code --install-extension account-switcher-for-claude-code-0.4.1.vsix
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

Open source, issues and PRs welcome:
**[github.com/tuanns/account-switcher-for-claude-code](https://github.com/tuanns/account-switcher-for-claude-code)**.

*(Repo mã nguồn mở, hoan nghênh issue/PR:
[github.com/tuanns/account-switcher-for-claude-code](https://github.com/tuanns/account-switcher-for-claude-code).)*

## Support

If this extension is useful to you, you can support it via PayPal
(**[paypal.me/tuanns285](https://paypal.me/tuanns285)**) or the **Sponsor**
button on this repo's GitHub page (GitHub Sponsors).

*(Nếu extension này có ích, bạn có thể ủng hộ qua PayPal
([paypal.me/tuanns285](https://paypal.me/tuanns285)) hoặc nút **Sponsor**
trên trang GitHub của repo này (GitHub Sponsors).)*

## License

[MIT](LICENSE)
