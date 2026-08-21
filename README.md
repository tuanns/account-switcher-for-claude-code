# Claude Profile Switcher

VSCode extension để chuyển đổi nhanh giữa nhiều tài khoản Claude Code đã đăng nhập,
không cần đăng nhập lại.

## Cách dùng

1. Bấm vào status bar item `Claude: ...` ở góc dưới bên trái.
2. Chọn "Thêm tài khoản mới..." để đăng nhập thêm một tài khoản (mở terminal chạy
   `claude`, hoàn tất OAuth login qua trình duyệt như bình thường).
3. Chọn một profile có sẵn trong danh sách để switch — chat panel "Claude Code" sẽ
   tự động mở conversation mới dùng tài khoản vừa chọn.
4. Mở nhiều cửa sổ VSCode, mỗi cửa sổ switch sang một profile khác nhau để chạy
   song song nhiều tài khoản.
5. Dùng VSCode Profiles (Work/Personal/...) để mỗi Profile tự nhớ riêng một tài
   khoản Claude.

## Build & cài đặt local

```bash
npm install
npm run compile
npm run package        # tạo file .vsix
code --install-extension claude-profile-switcher-0.1.0.vsix
```

## Development

```bash
npm test                # chạy unit test (node:test) cho các module logic thuần
npm run watch            # tsc watch mode
```

Nhấn `F5` trong VSCode (mở project này) để launch Extension Development Host và
test trực tiếp.

Xem chi tiết thiết kế tại `docs/superpowers/specs/2026-08-20-claude-profile-switcher-design.md`.
