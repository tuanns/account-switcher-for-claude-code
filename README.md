# Account Switcher for Claude Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

VSCode extension để chuyển đổi nhanh giữa nhiều tài khoản Claude Code đã đăng nhập,
không cần đăng nhập lại.

*Switch quickly between multiple logged-in Claude Code accounts, no re-login
needed. UI available in English and Vietnamese — follows your VS Code display
language ([`--locale`](https://code.visualstudio.com/docs/getstarted/locales)),
defaults to English if your language isn't packaged yet.*

> Đây là extension **cộng đồng, không chính thức** — không phải sản phẩm của
> Anthropic. "Claude" và "Claude Code" là thương hiệu của Anthropic, dùng ở đây
> chỉ để mô tả extension tương thích với Claude Code.
>
> *This is an **unofficial, community** extension — not an Anthropic product.
> "Claude" and "Claude Code" are Anthropic's trademarks, referenced here only
> to describe compatibility.*

## Cách dùng

1. Bấm vào status bar item `Claude: ...` ở góc dưới bên trái.
2. Chọn "Thêm tài khoản mới..." để đăng nhập thêm một tài khoản (mở terminal chạy
   `claude`, hoàn tất OAuth login qua trình duyệt như bình thường).
3. Có 2 cách switch, tuỳ nhu cầu:
   - **Bấm thẳng vào tên profile trong menu chính** → "giữ conversation": chỉ đổi
     credentials dùng chung, **conversation MỚI** mở sau đó (ở cửa sổ này hoặc bất
     kỳ cửa sổ nào khác chưa pin) sẽ dùng tài khoản mới. Lưu ý quan trọng: cách
     này **không** đổi được tài khoản của conversation đang mở sẵn — subprocess
     `claude` đứng sau nó đã đọc `CLAUDE_CONFIG_DIR` một lần lúc mở và giữ nguyên
     suốt vòng đời, ghi đè `_live` trên đĩa sau đó không có tác dụng với nó. Muốn
     thấy tài khoản mới, phải mở conversation mới.
   - **"Mở cửa sổ độc lập với profile khác..."** → chỉ cửa sổ hiện tại dùng riêng
     profile đó, tách khỏi cửa sổ khác, nhưng phải mở conversation mới.
4. Muốn chạy song song nhiều tài khoản ở nhiều cửa sổ độc lập với nhau: dùng mục
   "Mở cửa sổ độc lập..." ở mỗi cửa sổ, không dùng cách switch thường (cách switch
   thường là dùng chung, sẽ đổi luôn ở mọi cửa sổ chưa pin).
5. Dùng VSCode Profiles (Work/Personal/...) để mỗi Profile tự nhớ riêng một tài
   khoản Claude.

Mọi profile dùng chung 1 thư mục `projects/` (lịch sử hội thoại/session) — đổi
tài khoản không làm mất session cũ của bất kỳ project nào.

## Giới hạn hiện tại

- Chỉ hỗ trợ **Windows** desktop VSCode (chưa test remote/WSL/web extension,
  macOS, Linux).
- Phụ thuộc hành vi nội bộ chưa document của extension "Claude Code" chính
  thức (đọc `CLAUDE_CONFIG_DIR` lúc spawn subprocess) — có thể ngừng hoạt động
  nếu Anthropic đổi cách spawn ở bản mới.

## Build & cài đặt local

```bash
npm install
npm run compile
npm run package        # tạo file .vsix
code --install-extension account-switcher-for-claude-code-0.2.0.vsix
```

## Development

```bash
npm test                # chạy unit test (node:test) cho các module logic thuần
npm run watch            # tsc watch mode
```

Nhấn `F5` trong VSCode (mở project này) để launch Extension Development Host và
test trực tiếp.

Xem chi tiết thiết kế tại `docs/superpowers/specs/2026-08-20-claude-profile-switcher-design.md`.

## Đóng góp / Contributing

Repo mã nguồn mở, hoan nghênh issue/PR. *Open source, issues and PRs welcome.*

## Ủng hộ / Support

Nếu extension này có ích, bạn có thể ủng hộ tại: **(link donate — sẽ cập nhật)**.

*If this extension is useful to you, you can support it at: **(donate link —
to be added)**.*

## License

[MIT](LICENSE)
