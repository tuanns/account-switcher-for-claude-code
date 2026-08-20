# Claude Profile Switcher — Design Spec

Date: 2026-08-20
Status: Approved (design phase)

## 1. Problem

Người dùng có nhiều tài khoản Claude (đăng nhập qua Claude Code CLI / extension VSCode
chính thức "Claude Code" của Anthropic). Hiện tại muốn đổi tài khoản phải logout/login
lại (chạy lại OAuth flow qua trình duyệt), mất thời gian và phiền khi cần chuyển qua
lại thường xuyên (ví dụ tài khoản cá nhân vs tài khoản công ty).

## 2. Goal

Xây một VSCode extension (`claude-profile-switcher`, đặt tại thư mục dự án
`switch.profile`) cho phép:

- Lưu nhiều "profile" Claude, mỗi profile ứng với một tài khoản đã đăng nhập.
- Chuyển active profile chỉ bằng một cú click, áp dụng ngay cho panel chat của
  extension "Claude Code" chính thức — không cần đăng nhập lại.
- Mở nhiều cửa sổ VSCode song song, mỗi cửa sổ dùng một tài khoản khác nhau.
- Mỗi VSCode Profile (Work/Personal/...) tự nhớ tài khoản Claude riêng, không cần
  chọn lại mỗi lần mở.

## 3. Cơ chế nền tảng (đã verify)

### 3.1 `CLAUDE_CONFIG_DIR`

Claude Code CLI (`@anthropic-ai/claude-code`, cài tại
`C:\nvm4w\nodejs\node_modules\@anthropic-ai\claude-code\cli.js`) đọc biến môi trường
`CLAUDE_CONFIG_DIR` để xác định thư mục config, thay cho mặc định `~/.claude`. Đã
verify trực tiếp trong source (grep `CLAUDE_CONFIG_DIR` trong `cli.js`):

```
r8 = () => (process.env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), ".claude")).normalize("NFC")
```

Khi set biến này, **toàn bộ** state của một "tài khoản" nằm trong thư mục đó:

- `<dir>/.credentials.json` — OAuth token (`accessToken`, `refreshToken`,
  `expiresAt`, `refreshTokenExpiresAt`, `scopes`, `subscriptionType`,
  `rateLimitTier`, `organizationUuid`).
- `<dir>/.claude.json` (hoặc `<dir>/.config.json` nếu đã tồn tại) — config chính,
  gồm `oauthAccount` (email, org, display name...), `projects`, `mcpServers`, cache...

→ Mỗi tài khoản = một thư mục `CLAUDE_CONFIG_DIR` riêng, hoàn toàn độc lập, không
cần thao tác thủ công trên JSON.

### 3.2 Extension "Claude Code" chính thức dùng chung Extension Host

Đã verify trong `extension.js` của `anthropic.claude-code-2.1.237-win32-x64`: mỗi
khi spawn subprocess `claude` cho một conversation, extension đọc
`process.env.CLAUDE_CONFIG_DIR` tại thời điểm spawn (hàm `zA()` / `ZP()` gọi thẳng
`process.env.CLAUDE_CONFIG_DIR`).

Trên desktop VSCode, các extension không phải web-extension chạy chung một
Node.js Extension Host process cho mỗi cửa sổ (window) → nếu extension của ta set
`process.env.CLAUDE_CONFIG_DIR = <path>` bằng code, extension "Claude Code" chính
thức trong CÙNG cửa sổ sẽ đọc được giá trị mới ngay lập tức ở subprocess kế tiếp.

Đây là hành vi **nội bộ, chưa document chính thức** — có thể thay đổi ở bản sau của
extension chính thức. Rủi ro này được chấp nhận có ý thức (xem mục 8).

### 3.3 Cô lập theo cửa sổ và theo VSCode Profile

- Mỗi cửa sổ VSCode = một Extension Host process riêng → set env trong cửa sổ A
  không ảnh hưởng cửa sổ B. Mở nhiều cửa sổ, mỗi cửa sổ switch sang profile khác
  nhau = nhiều tài khoản chạy song song, không cần code thêm.
- `ExtensionContext.globalState` đã được VSCode cô lập theo từng VSCode Profile
  (mỗi Profile có storage riêng trên đĩa) → lưu "active Claude profile id" vào
  `globalState` là đủ để mỗi VSCode Profile tự nhớ tài khoản riêng, không cần cơ
  chế bổ sung.

## 4. Data model & lưu trữ

### 4.1 Danh sách profile (dùng chung mọi VSCode Profile/window)

File JSON tại `%USERPROFILE%\.claude-profiles\profiles.json`:

```jsonc
{
  "profiles": [
    {
      "id": "uuid-v4",
      "name": "Work",              // tên gợi nhớ, user đặt
      "dirPath": "C:\\Users\\tuanns\\.claude-profiles\\work",
      "email": "user@company.com", // cache, đọc từ oauthAccount sau khi login/switch
      "organizationName": "Acme",  // cache
      "createdAt": "2026-08-20T..."
    }
  ]
}
```

Thư mục `dirPath` của mỗi profile chính là `CLAUDE_CONFIG_DIR` cho profile đó.

Trường hợp đặc biệt: profile "Default" tạo từ first-run migration (mục 5.4) trỏ
thẳng `dirPath` vào `~/.claude` (không copy/move), để không phá vỡ setup hiện có
của user.

### 4.2 Active profile theo từng VSCode Profile

`context.globalState.get/update('activeProfileId')` — key đơn giản, giá trị là
`id` của profile trong `profiles.json`. Nhờ VSCode tự cô lập `globalState` theo
Profile, mỗi VSCode Profile có giá trị riêng.

## 5. Components & luồng thao tác

### 5.1 Extension activation

- Đọc `profiles.json` (tạo file rỗng nếu chưa có).
- Đọc `activeProfileId` từ `globalState`.
- Nếu có active profile hợp lệ → set `process.env.CLAUDE_CONFIG_DIR` ngay trong
  `activate()`, trước khi user có cơ hội mở chat panel (activation event
  `onStartupFinished`).
- Nếu chưa có profile nào → chạy first-run migration (5.4).
- Render status bar item.

### 5.2 Status bar item

- Hiển thị `$(account) Claude: <name active profile>`.
- Click → QuickPick:
  - Danh sách profile (profile active có dấu check), chọn 1 cái khác → switch.
  - `$(add) Thêm tài khoản mới...`
  - `$(gear) Quản lý profile...` (rename / xoá)

### 5.3 Switch profile

1. Set `process.env.CLAUDE_CONFIG_DIR = <dirPath của profile được chọn>`.
2. `context.globalState.update('activeProfileId', id)`.
3. Cập nhật status bar.
4. Gọi lệnh `claude-vscode.newConversation` (best-effort, bọc try/catch — nếu
   lệnh không tồn tại do extension chính thức đổi id lệnh, chỉ log, không throw).
5. Show notification: "Đã chuyển sang <name>. Đã mở conversation mới dùng tài
   khoản này." (tab cũ vẫn giữ nguyên account cũ, không bị mất).

### 5.4 Thêm tài khoản mới (login)

1. Input box: nhập tên gợi nhớ (validate không trùng, không rỗng).
2. Tạo `dirPath` mới = `%USERPROFILE%\.claude-profiles\<slug-từ-tên>`.
3. `vscode.window.createTerminal({ name: 'Claude Login: <name>', env: {
   CLAUDE_CONFIG_DIR: dirPath } })`, `terminal.show()`, `terminal.sendText('claude')`.
4. Extension watch (`fs.watch` hoặc polling nhẹ, timeout ~5 phút) file
   `<dirPath>/.credentials.json` xuất hiện.
5. Khi xuất hiện → đọc `<dirPath>/.claude.json` lấy `oauthAccount.emailAddress`,
   `organizationName` để cache → ghi profile mới vào `profiles.json` → hỏi user có
   muốn switch sang ngay không.
6. Nếu timeout / user đóng terminal mà chưa login xong → huỷ, xoá thư mục rỗng đã
   tạo, không lưu profile.

### 5.5 First-run migration

- Điều kiện: `profiles.json` rỗng/chưa tồn tại **và** `~/.claude/.credentials.json`
  tồn tại.
- Tự động tạo profile `"Default"` với `dirPath = ~/.claude` (giữ nguyên vị trí gốc,
  không di chuyển file), set làm active. Không hỏi gì thêm, không có bước login mới
  — tài khoản hiện tại của user tiếp tục hoạt động y như trước khi cài extension.

### 5.6 Quản lý profile (rename / xoá)

- Rename: chỉ đổi `name` trong `profiles.json`, không đụng `dirPath`.
- Xoá: confirm dialog (destructive) → nếu là profile "Default" trỏ vào `~/.claude`,
  chỉ xoá khỏi danh sách (KHÔNG xoá `~/.claude` thật); nếu là profile tự tạo trong
  `.claude-profiles/`, hỏi thêm "Xoá luôn thư mục credentials trên đĩa?" trước khi
  `fs.rm` — mặc định là không xoá file, chỉ gỡ khỏi danh sách, để tránh mất token
  ngoài ý muốn.
- Nếu xoá profile đang active → fallback active profile khác nếu có, hoặc clear
  `process.env.CLAUDE_CONFIG_DIR` (về mặc định `~/.claude`) nếu không còn profile
  nào.

## 6. Terminal `claude` command (bonus, tận dụng API chính thức)

Ngoài chat panel, extension cũng dùng
[`ExtensionContext.environmentVariableCollection`](VSCode API chính thức) để set
`CLAUDE_CONFIG_DIR` cho **terminal integrated mới mở** — đây là API được document
chính thức (không phải hack), đảm bảo lệnh `claude` gõ tay trong terminal cũng nhất
quán với profile đang active trên chat panel. Terminal đã mở từ trước không bị ảnh
hưởng (giới hạn vốn có của API này).

## 7. Error handling

| Tình huống | Xử lý |
|---|---|
| `claude` CLI không có trong PATH khi "Thêm tài khoản mới" | Báo lỗi rõ ràng, gợi ý cài Claude Code CLI trước |
| Login timeout (>5 phút không thấy `.credentials.json`) | Huỷ, dọn thư mục rỗng, thông báo user thử lại |
| `profiles.json` corrupt / parse lỗi | Backup file lỗi thành `.json.bak`, tạo file rỗng mới, thông báo user |
| Lệnh `claude-vscode.newConversation` không tồn tại (extension chính thức đổi id) | Log cảnh báo, vẫn switch env thành công, hướng dẫn user tự mở conversation mới |
| Xoá profile đang active | Fallback theo mục 5.6 |
| Hai action switch profile gọi gần như đồng thời (double-click) | Debounce theo `id` đang xử lý, bỏ qua click trùng lặp trong khi đang xử lý |

## 8. Rủi ro đã biết & giới hạn scope

- **Phụ thuộc hành vi nội bộ chưa document** của extension "Claude Code" chính
  thức (mục 3.2). Nếu Anthropic đổi cách spawn subprocess ở bản mới, phần "switch
  ảnh hưởng ngay chat panel" có thể ngừng hoạt động — phần dùng qua terminal
  (mục 6) vẫn hoạt động bình thường vì dùng API chính thức. Cần re-verify khi
  extension chính thức update lên major version mới.
- Token OAuth lưu plaintext trong từng thư mục profile — rủi ro tương đương cách
  Claude Code lưu hiện tại (`~/.claude/.credentials.json`), không tăng thêm.
- Chỉ target Windows desktop VSCode trong v1. Không hỗ trợ remote/WSL/web
  extension, không hỗ trợ macOS/Linux path conventions (có thể mở rộng sau).
- Không tự động refresh/kiểm tra hạn token — việc này Claude Code CLI đã tự lo
  trong mỗi thư mục config riêng của nó.

## 9. Testing

- Unit test cho `profiles.json` read/write (thêm, sửa, xoá, corrupt-recovery).
- Manual test checklist:
  1. First-run migration đúng khi đã có `~/.claude` sẵn.
  2. Thêm profile mới, login thành công, xuất hiện trong danh sách với email đúng.
  3. Switch profile → mở conversation mới trong chat panel → xác nhận đúng account
     (kiểm tra qua UI hiển thị email/org nếu extension chính thức có hiển thị, hoặc
     qua lệnh `/status` trong chat).
  4. Mở 2 cửa sổ VSCode, switch 2 profile khác nhau ở mỗi cửa sổ → xác nhận độc lập.
  5. Tạo 2 VSCode Profile (Work/Personal), mỗi cái switch sang 1 Claude profile,
     đóng mở lại từng VSCode Profile → xác nhận tự nhớ đúng.
  6. Terminal integrated mới mở dùng đúng `CLAUDE_CONFIG_DIR` của profile active.
  7. Rename, xoá profile (kể cả xoá profile đang active).

## 10. Out of scope (v1)

- Publish lên VSCode Marketplace (giả định dùng local/personal, chưa cần publisher
  id chính thức — sẽ hỏi lại nếu cần publish sau).
- Sync profile giữa nhiều máy.
- Hỗ trợ API key profile (non-OAuth) — chỉ scope OAuth login hiện tại.
