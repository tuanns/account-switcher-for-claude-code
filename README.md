# Claude Profile Switcher

VSCode extension để chuyển đổi nhanh giữa nhiều tài khoản Claude Code đã đăng nhập,
không cần đăng nhập lại.

## Cách dùng

1. Bấm vào status bar item `Claude: ...` ở góc dưới bên trái.
2. Chọn "Thêm tài khoản mới..." để đăng nhập thêm một tài khoản (mở terminal chạy
   `claude`, hoàn tất OAuth login qua trình duyệt như bình thường).
3. Có 2 cách switch, tuỳ nhu cầu:
   - **Bấm thẳng vào tên profile trong menu chính** → "giữ conversation": chỉ đổi
     credentials, conversation đang mở tiếp tục dùng được ngay, không cần mở mới.
     Lưu ý: cách này dùng chung 1 khe "đang chạy" cho mọi cửa sổ chưa pin — switch
     ở cửa sổ này thì cửa sổ khác (chưa pin) cũng đổi theo.
   - **"Mở cửa sổ độc lập với profile khác..."** → chỉ cửa sổ hiện tại dùng riêng
     profile đó, tách khỏi cửa sổ khác, nhưng phải mở conversation mới.
4. Muốn chạy song song nhiều tài khoản ở nhiều cửa sổ độc lập với nhau: dùng mục
   "Mở cửa sổ độc lập..." ở mỗi cửa sổ, không dùng cách switch thường (cách switch
   thường là dùng chung, sẽ đổi luôn ở mọi cửa sổ chưa pin).
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
