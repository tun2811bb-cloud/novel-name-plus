# Novel NAME Plus · Local ChatGPT Edition

> Trích xuất danh từ riêng từ tiểu thuyết Trung Quốc, phân nhóm Hán–Việt và xuất TXT cho Quick Translator. **Không cần API key**: dùng **Sign in with ChatGPT** chính thức, với quyền của gói ChatGPT đã được người dùng cho phép. Đây là phần mềm **chạy cục bộ**, không phải dịch vụ AI đặt trên GitHub Pages.

## Trạng thái phát triển

**v0.3 – Mã nguồn thử nghiệm.** Đã chạy kiểm thử tự động cho bộ chia chương/đoạn, kiểm tra khóa, loại trùng và xuất TXT. Chưa xác thực kết nối OAuth bằng tài khoản Plus thật và chưa thử đóng gói EXE trên máy Windows. Không được xem đây là bản thương mại hay bản đã kiểm chứng khả năng quét hàng nghìn chương liên tục.

## Cài đặt (Windows)

Cài [Node.js 22.12+](https://nodejs.org) và [Git](https://git-scm.com/download/win). Tải mã nguồn repository về máy hoặc giải nén tệp ZIP phát hành. Mở PowerShell tại thư mục dự án:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
npm start
```

Script sẽ tải **OpenAI Sign in with ChatGPT DevKit** chính thức từ `openai/sign-in-with-chatgpt-devkit`, biên dịch gói `@siwc/local`, đặt SDK dưới `vendor/siwc-local` và cài ứng dụng Electron. Phần SDK này không được đưa vào mã nguồn do giấy phép và để dễ cập nhật bản chính thức. **Không nhập API key, mật khẩu hoặc cookie ChatGPT vào dự án.**

Khi mở ứng dụng: chọn TXT → đăng nhập **Tiếp tục với ChatGPT** → cấp quyền dùng ChatGPT plan → chọn mô hình → **Lọc NAME**. Sau đó có thể **Rà lượt hai**, sửa danh sách và xuất file.

## Tính năng v0.3

1. Đọc TXT UTF-8; thử GB18030 nếu không giải mã được UTF-8. Dán văn bản thủ công.
2. Nhận tiêu đề kiểu `第N章`, `第N回`, `第N节`; chia đều thành đoạn 4.000–8.500 ký tự không bỏ qua chương dài.
3. Gọi AI qua SDK `@siwc/local` (OAuth của OpenAI; quyền `chatgpt.tokens.use.direct`). Không tự gửi truyện khi chỉ nạp file; mỗi đoạn chỉ được gửi khi nhấn chạy.
4. 14 nhóm: Nhân vật, biệt danh, danh xưng, đạo hiệu/tôn hiệu, địa danh, tổ chức, công pháp, pháp thuật, cảnh giới, sinh vật, thực vật, vật phẩm, kinh thư, khác.
5. Chỉ chấp nhận khóa NAME xuất hiện nguyên văn trong đoạn nguồn; ghi nhận bản dịch mâu thuẫn vào `alternatives` để kiểm tra.
6. Tạm dừng, tự thử lại các lỗi tạm thời tối đa 3 lần, lưu tiến độ sau mỗi đoạn dưới thư mục dữ liệu ứng dụng.
7. Bảng lọc theo nhóm/từ khóa, sửa tên Việt, sửa nhóm, đánh dấu đã duyệt, thêm/xóa khóa.
8. Chất lượng v0.2: hậu tố **đứng sau tên, viết thường**, địa danh xử lý riêng; các cụm chức danh số hiệu và từ phổ thông được loại khỏi NAME.
9. Bản dịch còn **bất kỳ chữ Hán nào** sẽ bị đưa vào **Cần rà soát** và không thể xuất vào Quick Translator. Tên quốc tế nghi ngờ **cũng bị chặn xuất**, kể cả khi người dùng cố chuyển trạng thái; phải có căn cứ và xác nhận cách viết Latin, không tự đoán tên.
10. Các trạng thái: **NAME chính thức**, **Thuật ngữ**, **Cần rà soát**, **Loại**. Mặc định chỉ xuất NAME chính thức; có tùy chọn xuất cả thuật ngữ.
11. Trang kết quả phân trang 80 mục, tìm kiếm có trì hoãn ngắn để giảm giật; kết nối SDK khởi tạo sau khi cửa sổ đã hiển thị.
12. Có thể **nhập lại TXT NAME cũ** ở trang Kết quả để rà soát mà **không cần gọi AI**. Các mục nghi vấn vẫn giữ trong bảng để sửa hoặc khôi phục.
13. Xuất `*_NAME_PHAN_LOAI.txt` (có tiêu đề nhóm) và `*_NAME_QUICK_TRANSLATOR.txt` (chỉ `中文=Tiếng Việt`, sắp thứ tự khóa dài trước).

## Cập nhật trong ứng dụng (Windows)

- Cài **Novel-NAME-Plus-Setup-0.3.0.exe** một lần từ [GitHub Releases](https://github.com/tun2811bb-cloud/novel-name-plus/releases). Không dùng Portable nếu muốn tự cập nhật.
- Ứng dụng tự kiểm tra phiên bản GitHub Releases sau khi cửa sổ mở. Bản mới sẽ hiển thị **Tải cập nhật → Cài và khởi động lại**; bạn cũng có thể bấm **Kiểm tra cập nhật** ở góc trên.
- Trước khi cài, ứng dụng lưu các dự án từ `app.userData/projects` vào `app.userData/update-backups`. **Đóng/tạm dừng tác vụ quét đang chạy trước khi cập nhật.**
- Bộ dữ liệu dự án vẫn ở nguyên đường dẫn userData qua các phiên bản; trường tên và trạng thái mới của v0.3 tương thích dự án v0.1/v0.2.
- Phiên bản **Portable** không hỗ trợ cập nhật trực tiếp; sẽ mở GitHub Releases để tải bản mới. Các phiên bản trước v0.3 cũng cần cài bản Setup một lần để khởi tạo cơ chế cập nhật.
- **Điều kiện phát hành**: mỗi phiên bản mới phải có GitHub Release công khai, gói Setup và tệp `latest.yml`. Workflow `.github/workflows/windows.yml` được kích hoạt khi file `.github/RELEASE_REQUEST` thay đổi; chỉ phát hành sau khi build và kiểm thử thành công. Không ghi đè release cùng phiên bản.
- Windows có thể hiện cảnh báo SmartScreen vì bản thử nghiệm chưa được ký số. **Không bỏ qua cảnh báo bảo mật nếu chưa kiểm tra nguồn phát hành.** Để phân phối rộng rãi nên có chữ ký số ứng dụng.

## Kiểm định tên quốc tế v0.3

- Tên quốc tế quen thuộc được định danh rõ như `杰克=Jack`, `杰森=Jason`, `汉尼拔=Hannibal`, `马丁=Martin` được giữ đúng cách viết Latin.
- Các tên khả nghi như `顿克斯`, `费罗恩`, `蛮斯格`, `休斯格`, `罗斯杰`, `科娃` bị đưa vào **Cần rà soát**, kể cả khi AI đoán chúng là tên Trung Quốc hoặc bản cũ từng đánh dấu **Giữ**.
- Tên quốc tế chưa xác minh **không được xuất vào TXT sạch**; phải sửa bản dịch sang tên Latin thực sự có căn cứ, chọn nguồn gốc **Quốc tế**, rồi bấm **Xác minh tên Latin**. Ngay cả thao tác xác nhận cũng bị chặn nếu còn ký tự Hán hoặc rõ ràng là cách phiên âm Hán Việt.
- Trường hợp nhận diện nhầm tên Trung Quốc, chọn nguồn gốc **Tên Trung** để xác nhận thủ công (không áp dụng cho những tên quốc tế đã biết chắc).
- Phát hiện hình thái tên chỉ là phương pháp rà soát rủi ro, **không thể thay thế việc đọc ngữ cảnh truyện**. Không tự động suy đoán tên Latin cho những mục chưa đủ thông tin.

## Các giới hạn cần biết

- **Hạn mức**: Đây là dùng hạn mức ChatGPT Plus/Pro đủ điều kiện, không phải AI không giới hạn. Có thể kiểm tra trong [Settings → Usage](https://chatgpt.com/settings/usage).
- **Không dùng trên GitHub Pages**: GitHub Pages chỉ dùng để giới thiệu và phát hành mã nguồn. OAuth và việc gọi AI phải chạy trên máy cá nhân; triển khai thành một website AI từ xa cần OpenAI cấp quyền riêng.
- **Độ chính xác**: AI có thể bỏ sót hoặc dịch sai NAME. Kiểm tra thủ công trước khi nhập từ điển chính. Bước rà hai tốn thêm hạn mức; chỉ kích hoạt khi bạn muốn.
- **Số lần xuất hiện** đang biểu thị số lượt AI phát hiện qua các đoạn, không phải thống kê số lần từ xuất hiện trong toàn bộ truyện.
- **Giữ bí mật**: File truyện chỉ được xử lý trên máy trước khi gửi từng đoạn có chủ đích đến OpenAI. Token OAuth do SDK lưu dưới kho mã hóa của hệ điều hành, không xuất ra trình duyệt hoặc GitHub.
- **Chưa hỗ trợ DOCX / EPUB**, chưa có bảng đối chiếu vị trí NAME theo từng chương và chưa có từ điển chung toàn cục. Đây là tính năng cho bản tiếp theo.
- **Mã nguồn mới, không sao chép từ `thiendiepdt/novel-name-extractor`**. Không cần gắn giấy phép GPL của repository đó nếu chỉ tham khảo luồng xử lý mà không sao chép mã.

## GitHub Actions

- `Kiểm thử NAME`: chạy kiểm thử JS và kiểm tra cú pháp, không cần tài khoản ChatGPT.
- `Đóng gói Windows và phát hành bản cập nhật`: tự chạy khi tệp `.github/RELEASE_REQUEST` được thay đổi. Sau khi kiểm thử/đóng gói thành công, GitHub Release xuất hiện ở mục **Releases**. Vẫn có `Run workflow` để tạo artifact kiểm thử mà không tự phát hành. **Chưa xác minh build Windows / OAuth bằng tài khoản thật**.

## Kiến trúc

```
src/index.html + style.css + renderer.mjs
    ├─ Chọn TXT / chia đoạn (core.mjs)
    ├─ Giao diện kiểm tra / kết quả
    └─ Electron preload (chỉ cho phép các thao tác đã khai báo)
          ↓ IPC
src/main.cjs + updater.cjs (tiến trình đáng tin cậy)
    ├─ OpenAI @siwc/local → OAuth loopback 127.0.0.1 → Responses API
    ├─ Electron safeStorage → mã hóa token
    ├─ app.userData/projects → tiến độ (JSON)
    ├─ dialog.saveFile → TXT UTF-8
    └─ electron-updater → GitHub Releases (NSIS), backup trước khi cài
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

## Thay đổi v0.2 và kiểm thử trên file mẫu

Trên bộ 993 NAME do người dùng cung cấp, quy tắc tĩnh v0.2 phân thành 762 NAME giữ mặc định, 158 thuật ngữ tùy chọn, 18 cần kiểm tra, 55 loại. Đây **không phải** tỷ lệ chính xác có đối chiếu nguyên tác; thuật ngữ và các mục bị loại có thể được người dùng đưa trở lại. Phần dữ liệu mẫu người dùng **không được đưa lên GitHub**.

Bản cài đầu tiên và OAuth ChatGPT Plus vẫn cần thử nghiệm thực tế trên Windows. V0.2 ưu tiên độ an toàn đầu ra và độ mượt giao diện; không tự nhận bảo đảm mọi NAME đều đúng hoặc mọi thiết bị đều mở nhanh hơn.
