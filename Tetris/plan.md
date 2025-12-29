# Kế hoạch tạo game xếp gạch (HTML/JavaScript)

## 1) Mục tiêu
- Tạo game xếp gạch (phong cách Tetris) chạy trong trình duyệt.
- UI hiện đại, giàu cảm giác chuyển động và phản hồi.
- Gameplay tăng độ khó theo level, cân bằng giữa thử thách và giải trí.

## 2) Phạm vi tính năng
- Bàn chơi lưới 10x20, khối rơi gồm 7 tetromino chuẩn.
- Điều khiển: trái/phải, xoay, rơi nhanh, rơi tức thì, pause.
- Tính điểm theo số hàng xoá và combo.
- Level tăng dần theo số hàng xoá, tốc độ rơi tăng theo level.
- Màn hình: Start, Pause, Game Over.

## 3) Quy tắc gameplay cốt lõi
- Mỗi lượt sinh ngẫu nhiên một khối (bag 7 để công bằng).
- Khối rơi theo tốc độ hiện tại; khi chạm đáy hoặc khối khác thì cố định.
- Xoá hàng đầy, cộng điểm và tăng bộ đếm hàng xoá.
- Game over khi khối mới không thể đặt vào vị trí spawn.

## 4) Kiến trúc và dữ liệu
- State chính:
  - board: ma trận 20x10
  - activePiece: hình dạng, vị trí, hướng
  - nextQueue: danh sách khối kế tiếp
  - score, level, lines, gameStatus
- Game loop:
  - tick theo timer (setInterval hoặc requestAnimationFrame + accumulator)
  - mỗi tick: thử rơi xuống 1 ô, kiểm tra va chạm
- Input:
  - lắng nghe keydown, xử lý debouncing cho xoay
- Rendering:
  - Canvas 2D hoặc div grid (ưu tiên Canvas để mượt)
  - vẽ board, khối đang rơi, preview khối kế tiếp

## 5) UI/UX hiện đại
- Layout: main board + sidebar (score/level/next)
- Typography: dùng font hiển thị đặc trưng (ví dụ: 'Space Grotesk', 'Bebas Neue')
- Màu sắc: nền gradient, khối có màu neon nhẹ, viền mảnh
- Motion: hiệu ứng xuất hiện, rung nhẹ khi xoá hàng, glow khi đạt level mới
- Responsive: co giãn phù hợp mobile và desktop

## 6) Cơ chế tăng độ khó
- Level tăng mỗi 10 hàng xoá.
- Tốc độ rơi: giảm khoảng delay theo level (ví dụ: 1000ms -> 150ms).
- Điểm thưởng: level cao cho điểm cao hơn (multiplier).

## 7) Kế hoạch triển khai theo giai đoạn
### Giai đoạn 1: Nền tảng gameplay
- Tạo cấu trúc project, canvas, lưới game.
- Cài đặt logic khối rơi, va chạm, xoá hàng.
- Thêm hệ thống điểm và level.

### Giai đoạn 2: UI/UX hiện đại
- Thiết kế layout, sidebar, typography.
- Thêm hiệu ứng nền và chuyển động.
- Hiển thị trạng thái (start, pause, game over).

### Giai đoạn 3: Hoàn thiện và cân bằng
- Cân chỉnh tốc độ tăng độ khó.
- Thêm âm thanh/FX (tuỳ chọn).
- Kiểm thử input và hiệu năng.

## 8) Kiểm thử và tinh chỉnh
- Test logic va chạm và xoay khối ở biên.
- Test độ mượt khi tăng tốc độ cao.
- Điều chỉnh điểm số và tốc độ để gameplay hấp dẫn.

## 9) Kết quả mong đợi
- Một game xếp gạch chạy mượt, UI hiện đại, dễ chơi nhưng có thử thách.
- Có thể mở rộng thêm chế độ hoặc theme sau này.
