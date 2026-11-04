# Novel NAME Plus · Local ChatGPT Edition

**Repository chính:** https://github.com/tun2811bb-cloud/novel-name-plus

> Trích xuất danh từ riêng từ tiểu thuyết Trung Quốc, phân nhóm Hán–Việt và xuất TXT cho Quick Translator. **Không cần API key**: dùng **Sign in with ChatGPT** chính thức, với quyền của gói ChatGPT đã được người dùng cho phép. Đây là phần mềm **chạy cục bộ**, không phải dịch vụ AI đặt trên GitHub Pages.

## Trạng thái phát triển

**v0.1 – Mã nguồn thử nghiệm.** Đã chạy kiểm thử tự động cho bộ chia chương/đoạn, kiểm tra khóa, loại trùng và xuất TXT. Chưa xác thực kết nối OAuth bằng tài khoản Plus thật và chưa thử đóng gói EXE trên máy Windows. Không được xem đây là bản thương mại hay bản đã kiểm chứng khả năng quét hàng nghìn chương liên tục.

## Cài đặt (Windows)

Cài [Node.js 22.12+](https://nodejs.org) và [Git](https://git-scm.com/download/win). Tải mã nguồn repository về máy hoặc giải nén tệp ZIP phát hành. Mở PowerShell tại thư mục dự án:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
npm start
```

Script sẽ tải **OpenAI Sign in with ChatGPT DevKit** chính thức từ `openai/sign-in-with-chatgpt-devkit`, biên dịch gói `@siwc/local`, đặt SDK dưới `vendor/siwc-local` và cài ứng dụng Electron. Phần SDK này không được đưa vào mã nguồn do giấy phép và để dễ cập nhật bản chính thức. **Không nhập API key, mật khẩu hoặc cookie ChatGPT vào dự án.**

Khi mở ứng dụng: chọn TXT → đăng nhập **Tiếp tục với ChatGPT** → cấp quyền dùng ChatGPT plan → chọn mô hình → **Lọc NAME**. Sau đó có thể **Rà lượt hai**, sửa danh sách và xuất file.

## Tính năng v0.1

1. Đọc TXT UTF-8; thử GB18030 nếu không giải mã được UTF-8. Dán văn bản thủ công.
2. Nhận tiêu đề kiểu `第N章`, `第N回`, `第N节`; chia đều thành đoạn 4.000–8.500 ký tự không bỏ qua chương dài.
3. Gọi AI qua SDK `@siwc/local` (OAuth của OpenAI; quyền `chatgpt.tokens.use.direct`). Không tự gửi truyện khi chỉ nạp file; mỗi đoạn chỉ được gửi khi nhấn chạy.
4. 14 nhóm: Nhân vật, biệt danh, danh xưng, đạo hiệu/tôn hiệu, địa danh, tổ chức, công pháp, pháp thuật, cảnh giới, sinh vật, thực vật, vật phẩm, kinh thư, khác.
5. Chỉ chấp nhận khóa NAME xuất hiện nguyên văn trong đoạn nguồn; ghi nhận bản dịch mâu thuẫn vào `alternatives` để kiểm tra.
6. Tạm dừng, tự thử lại các lỗi tạm thời tối đa 3 lần, lưu tiến độ sau mỗi đoạn dưới thư mục dữ liệu ứng dụng.
7. Bảng lọc theo nhóm/từ khóa, sửa tên Việt, sửa nhóm, đánh dấu đã duyệt, thêm/xóa khóa.
8. Xuất `*_NAME_PHAN_LOAI.txt` (có tiêu đề nhóm) và `*_NAME_QUICK_TRANSLATOR.txt` (chỉ `中文=Tiếng Việt`, sắp thứ tự khóa dài trước).

## Các giới hạn cần biết

- **Hạn mức**: Đây là dùng hạn mức ChatGPT Plus/Pro đủ điều kiện, không phải AI không giới hạn. Có thể kiểm tra trong [Settings → Usage](https://chatgpt.com/settings/usage).
- **Không dùng trên GitHub Pages**: GitHub Pages chỉ dùng để giới thiệu và phát hành mã nguồn. OAuth và việc gọi AI phải chạy trên máy cá nhân; triển khai thành một website AI từ xa cần OpenAI cấp quyền riêng.
- **Độ chính xác**: AI có thể bỏ sót hoặc dịch sai NAME. Kiểm tra thủ công trước khi nhập từ điển chính. Bước rà hai tốn thêm hạn mức; chỉ kích hoạt khi bạn muốn.
- **Số lần xuất hiện** đang biểu thị số lượt AI phát hiện qua các đoạn, không phải thống kê số lần từ xuất hiện trong toàn bộ truyện.
- **Giữ bí mật**: File truyện chỉ được xử lý trên máy trước khi gửi từng đoạn có chủ đích đến OpenAI. Token OAuth do SDK lưu dưới kho mã hóa của hệ điều hành, không xuất ra trình duyệt hoặc GitHub.
- **Chưa hỗ trợ DOCX / EPUB**, chưa có bảng đối chiếu vị trí NAME theo từng chương và chưa có từ điển chung toàn cục. Đây là tính năng cho bản tiếp theo.
- **Mã nguồn mới, không sao chép từ `thiendiepdt/novel-name-extractor`**. Không cần gắn giấy phép GPL của repository đó nếu chỉ tham khảo luồng xử lý mà không sao chép mã.

## GitHub Actions

- `Test NAME core`: chạy kiểm thử JS và kiểm tra cú pháp, không cần tài khoản ChatGPT.
- `Build Windows Portable`: vào **Actions → Build Windows Portable → Run workflow** để xây dựng EXE trên Windows của GitHub Actions. Sau khi workflow thành công, tải file dưới mục **Artifacts**. Build này hiện **chưa được xác minh thực tế**.

## Kiến trúc

```
src/index.html + style.css + renderer.mjs
    ├─ Chọn TXT / chia đoạn (core.mjs)
    ├─ Giao diện kiểm tra / kết quả
    └─ Electron preload (chỉ cho phép các thao tác đã khai báo)
          ↓ IPC
src/main.cjs (tiến trình đáng tin cậy)
    ├─ OpenAI @siwc/local → OAuth loopback 127.0.0.1 → Responses API
    ├─ Electron safeStorage → mã hóa token
    ├─ app.userData/projects → tiến độ (JSON)
    └─ dialog.saveFile → TXT UTF-8
```

Chạy kiểm tra phần thuần JS:

```powershell
npm test
```

## Nguồn tài liệu & giấy phép

- [OpenAI Sign in with ChatGPT · Quickstart](https://developers.openai.com/siwc/quickstart)
- [OpenAI cookbook · Tích hợp ứng dụng mã nguồn mở](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt)
- [OpenAI DevKit · mã nguồn SDK](https://github.com/openai/sign-in-with-chatgpt-devkit)
- [Giới hạn sử dụng ChatGPT plan trong ứng dụng](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)

Phần mã nguồn **Novel NAME Plus** do dự án này tự xây dựng được phát hành theo **MIT License**. SDK `@siwc/local` tải từ OpenAI có **giấy phép Noncommercial riêng**, giữ nguyên các thông báo bản quyền đi kèm. Không được cho rằng giấy phép MIT áp dụng cho mã SDK OpenAI. Mục đích là công cụ cá nhân, phi thương mại.

## Lộ trình tiếp theo

- Kiểm thử OAuth với tài khoản Plus thực tế trên Windows và kiểm tra lỗi đăng nhập/đổi mô hình.
- Chạy thử TXT 70–500 chương, đánh giá mức bỏ sót và trùng NAME; tối ưu chi phí hạn mức.
- Bổ sung bộ nhớ từ điển chung, tham chiếu chương, kiểm tra Hán Việt nâng cao và import TXT/EPUB/DOCX.
