# Phase 1 Todo — App + Containerization

Tài liệu này là checklist thao tác để hoàn tất Phase 1. Codex không chạy các lệnh
CLI bên dưới; bạn tự chạy từng bước và chỉ đánh dấu `[x]` khi kết quả thực tế đúng
với mục **Hoàn thành khi**.

## Trạng thái hiện tại

Phần mã nguồn đã được scaffold nhưng **chưa được kiểm chứng bằng install, lint,
test, build hoặc Docker**:

- Backend Express, Mongoose, JWT, bcrypt, Redis, health check và Prometheus metrics.
- Frontend React, Vite, Tailwind và các màn hình auth/CRUD trips.
- Test Vitest/Supertest.
- Dockerfile frontend/backend, nginx và Docker Compose.

Vì vậy, các mục liên quan đến mã nguồn vẫn để trống cho tới khi bạn tự chạy và
xác nhận.

---

## 1. Chuẩn bị workspace và dependencies

- [ ] Cài dependencies cho npm workspaces.
- [ ] Có `package-lock.json` ở thư mục gốc.
- [ ] Không có lỗi dependency nghiêm trọng.

### Cách thực hiện

Tại `D:\tripplanner-app`, chạy:

```powershell
npm install
```

Kiểm tra file `package-lock.json` xuất hiện ở thư mục gốc.

### Hoàn thành khi

- Lệnh kết thúc với exit code `0`.
- Thư mục `node_modules` và file `package-lock.json` tồn tại.
- Không sửa tay nội dung `package-lock.json`.

### Nếu gặp lỗi

- `EACCES`/`EPERM`: đóng dev server hoặc tiến trình đang giữ `node_modules`, rồi thử lại.
- Network/registry timeout: kiểm tra proxy, VPN và `npm config get registry`.
- Gửi toàn bộ output lỗi cho Codex; không chỉ gửi dòng cuối.

---

## 2. Tạo MongoDB Atlas cho môi trường development

- [ ] Tạo Atlas Free cluster.
- [ ] Tạo database user riêng cho TripPlanner.
- [ ] Chỉ allowlist IP hiện tại.
- [ ] Lấy được connection string cho Node.js.

### Cách thực hiện

1. Đăng nhập MongoDB Atlas và tạo project `tripplanner-dev`.
2. Chọn **Create cluster → Free**.
3. Chọn AWS và region gần bạn; Free cluster chỉ hỗ trợ một số region.
4. Đặt tên cluster, ví dụ `tripplanner-dev`.
5. Tạo database user, ví dụ `tripplanner_app`; dùng mật khẩu ngẫu nhiên mạnh.
6. Trong Network Access, chọn **Add My Current IP Address**.
7. Chọn **Connect → Drivers → Node.js** và sao chép URI.
8. Đổi `<password>` thành mật khẩu database user và thêm database name:

```text
mongodb+srv://tripplanner_app:<password>@<cluster-host>/tripplanner?retryWrites=true&w=majority
```

Hướng dẫn chính thức:

- https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/
- https://www.mongodb.com/docs/atlas/connect-to-database-deployment/

### Hoàn thành khi

- Cluster ở trạng thái Available/Ready.
- URI chứa database `/tripplanner`.
- IP hiện tại có trong IP Access List.
- Không dùng `0.0.0.0/0` ở giai đoạn local.

### Lưu ý

Database user khác với tài khoản đăng nhập Atlas. Nếu mật khẩu chứa ký tự đặc biệt,
phải URL-encode phần mật khẩu trong URI.

---

## 3. Cấu hình environment variables

- [ ] Có `backend/.env` cho chạy local.
- [ ] Có `.env` ở thư mục gốc cho Docker Compose.
- [ ] Hai file `.env` đều bị Git ignore.

### Cách thực hiện trong IDE

Sao chép `backend/.env.example` thành `backend/.env`, rồi điền:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb+srv://...
REDIS_URL=redis://localhost:6379
JWT_SECRET=mot-chuoi-ngau-nhien-toi-thieu-32-ky-tu
JWT_EXPIRES_IN=1d
```

Sao chép `.env.example` thành `.env`, rồi điền:

```env
MONGO_URI=mongodb+srv://...
JWT_SECRET=mot-chuoi-ngau-nhien-toi-thieu-32-ky-tu
JWT_EXPIRES_IN=1d
BACKEND_PORT=5000
FRONTEND_PORT=3000
```

Tự kiểm tra Git ignore:

```powershell
git check-ignore .env backend/.env
```

### Hoàn thành khi

Lệnh trên in ra cả `.env` và `backend/.env`. Không chụp màn hình hoặc commit nội
dung hai file này.

---

## 4. Khởi động Redis local

- [ ] Redis container chạy và ở trạng thái healthy.
- [ ] Redis trả về `PONG`.

### Cách thực hiện

```powershell
docker compose up -d redis
docker compose ps
docker compose exec redis redis-cli ping
```

### Hoàn thành khi

- `docker compose ps` hiển thị Redis là `running`/`healthy`.
- Lệnh cuối trả về `PONG`.

### Nếu gặp lỗi Docker config

Máy từng báo không đọc được:

```text
C:\Users\User\.docker\config.json
```

Nếu lỗi tái diễn, kiểm tra Docker Desktop đang chạy và tài khoản Windows hiện tại
có quyền đọc file đó. Không xóa file nếu chưa sao lưu.

---

## 5. Kiểm chứng backend

- [ ] Backend khởi động tại port `5000`.
- [ ] Liveness trả `200`.
- [ ] Readiness trả `200` khi MongoDB và Redis đều sẵn sàng.
- [ ] Metrics có dữ liệu Prometheus.

### Cách thực hiện

Mở terminal thứ nhất:

```powershell
npm run dev -w backend
```

Kiểm tra bằng browser hoặc terminal khác:

```text
http://localhost:5000/healthz
http://localhost:5000/readyz
http://localhost:5000/metrics
```

Kết quả mong đợi:

```json
{"status":"ok"}
```

```json
{
  "status": "ready",
  "checks": {
    "mongo": true,
    "redis": true
  }
}
```

Trong `/metrics` phải có tối thiểu:

```text
tripplanner_http_requests_total
tripplanner_http_request_duration_seconds
```

### Hoàn thành khi

- `/healthz` vẫn trả `200` nếu một dependency tạm thời lỗi.
- `/readyz` trả `503` nếu tắt Redis hoặc MongoDB không kết nối được.
- Backend không in secret hoặc toàn bộ Mongo URI ra log.

---

## 6. Kiểm chứng auth và CRUD trips qua giao diện

- [ ] Frontend chạy tại port `5173`.
- [ ] Đăng ký được user mới.
- [ ] Đăng nhập được.
- [ ] Tạo, xem, sửa và xóa trip.
- [ ] User không đăng nhập không truy cập được dashboard.

### Cách thực hiện

Giữ backend và Redis đang chạy. Mở terminal thứ hai:

```powershell
npm run dev -w frontend
```

Mở:

```text
http://localhost:5173
```

Thực hiện theo thứ tự:

1. Tạo tài khoản với password từ 8 ký tự.
2. Đăng xuất rồi đăng nhập lại.
3. Tạo trip với ngày kết thúc sau ngày bắt đầu.
4. Refresh trang; trip vẫn phải tồn tại.
5. Sửa destination, status hoặc notes.
6. Xóa trip và xác nhận nó biến mất sau refresh.
7. Mở DevTools → Network, kiểm tra request dùng `/api/...`, không gọi cứng host backend.

### Hoàn thành khi

Toàn bộ luồng trên chạy không có lỗi console nghiêm trọng và dữ liệu tồn tại trong
Atlas sau khi refresh.

---

## 7. Kiểm chứng Redis cache và rate limit

- [ ] Danh sách trips được cache.
- [ ] Thay đổi trip làm cache cũ bị vô hiệu hóa.
- [ ] Auth endpoint có rate limit.

### Cách thực hiện

1. Mở DevTools → Network.
2. Gọi `GET /api/trips` lần đầu; response header mong đợi:

```text
X-Cache: MISS
```

3. Reload dashboard trong vòng 60 giây; response tiếp theo mong đợi:

```text
X-Cache: HIT
```

4. Tạo/sửa/xóa trip, rồi reload; request đầu tiên sau thay đổi phải là `MISS`.

Để chứng minh rate limit trong test, không cần cố tình khóa tài khoản thủ công trên
trình duyệt. Test tự động hoặc một script riêng ở bước CI sẽ phù hợp hơn.

### Hoàn thành khi

Cache HIT/MISS hoạt động đúng và dữ liệu không bị cũ sau mutation.

---

## 8. Chạy lint và automated tests

- [ ] ESLint backend/frontend không có lỗi.
- [ ] Toàn bộ test pass.
- [ ] Sinh được báo cáo `lcov.info`.

### Cách thực hiện

```powershell
npm run check
npm test
npm run test:coverage
```

### Hoàn thành khi

- Ba lệnh đều exit code `0`.
- Có file:

```text
backend/coverage/lcov.info
```

- Test bao phủ tối thiểu health/readiness, metrics, auth, protected routes, CRUD và cache.

### Nếu test fail

Gửi tên test fail, expected/received và stack trace cho Codex. Không giảm assertion
hoặc bỏ test chỉ để pipeline xanh.

---

## 9. Production build frontend

- [ ] Vite production build thành công.
- [ ] Không có secret trong bundle frontend.

### Cách thực hiện

```powershell
npm run build
```

### Hoàn thành khi

- Lệnh exit code `0`.
- Có thư mục `frontend/dist`.
- Không đưa `MONGO_URI`, `JWT_SECRET` hoặc credentials vào biến `VITE_*`.

---

## 10. Chuẩn bị lockfile cho Docker build

Dockerfile hiện dùng `npm ci`, vì vậy mỗi build context cần lockfile tương ứng.

- [ ] Có `backend/package-lock.json`.
- [ ] Có `frontend/package-lock.json`.

### Cách thực hiện

```powershell
npm install --package-lock-only --prefix backend
npm install --package-lock-only --prefix frontend
```

Sau khi tạo, kiểm tra hai lockfile được Git track. Nếu npm xử lý hai thư mục như
workspace và không tạo lockfile riêng, dừng tại đây và gửi output cho Codex để đổi
Dockerfile sang dùng root workspace lockfile; không thay `npm ci` thành `npm install`
trong production image.

---

## 11. Build và kiểm tra container images

- [ ] Backend image build thành công.
- [ ] Frontend image build thành công.
- [ ] Cả hai container chạy non-root.
- [ ] Image không chứa `.env`, test hoặc source map không cần thiết.

### Cách thực hiện

```powershell
docker compose build
docker compose up -d
docker compose ps
docker compose exec backend id
docker compose exec frontend id
docker images
```

### Hoàn thành khi

- Tất cả service ở trạng thái running/healthy.
- `id` của backend và frontend không trả về UID `0`.
- Frontend mở được tại `http://localhost:3000`.
- Backend không được public trực tiếp qua host trong Compose; nginx proxy `/api` vào
  service nội bộ `backend:5000`.
- Image backend mục tiêu dưới khoảng `200 MB`; ghi lại kích thước thật để đưa vào README.

---

## 12. Kiểm chứng Docker Compose end-to-end

- [ ] Có thể dựng toàn bộ stack bằng một lệnh.
- [ ] Frontend chỉ sẵn sàng sau backend healthy; backend đợi Redis healthy.
- [ ] Dữ liệu trip vẫn tồn tại sau khi recreate container.

### Cách thực hiện

```powershell
docker compose down
docker compose up --build
```

Mở `http://localhost:3000` rồi lặp lại register/login/CRUD.

Sau khi kiểm tra:

```powershell
docker compose down
```

### Hoàn thành khi

- FE → nginx → backend → Atlas hoạt động.
- Redis chỉ giữ cache/rate-limit; mất Redis data không làm mất trip trong Atlas.
- `docker compose down` dừng stack sạch sẽ.

Docker Compose hiện dùng health check cùng `depends_on.condition: service_healthy`,
đúng cơ chế chờ dependency sẵn sàng:
https://docs.docker.com/compose/how-tos/startup-order/

---

## 13. Kiểm tra bảo mật và nội dung Git

- [ ] Không có secret trong Git.
- [ ] Không có `node_modules`, coverage hoặc dist trong Git.
- [ ] Docker image/backend chạy non-root.
- [ ] JWT secret production đủ mạnh.

### Cách thực hiện

```powershell
git status --short
git check-ignore .env backend/.env node_modules frontend/dist backend/coverage
```

Tự rà soát các file chuẩn bị commit, đặc biệt tìm:

```text
mongodb+srv://
JWT_SECRET=
password=
```

### Hoàn thành khi

Không có giá trị secret thật trong file được Git track. `.env.example` chỉ chứa
placeholder.

---

## 14. GitHub repositories và branch protection

- [ ] Repo `tripplanner-app` đã push lên GitHub.
- [ ] Repo `tripplanner-k8s` đã được tạo để dùng từ Phase 2/5.
- [ ] `main` của app repo được protect.

### Cách thực hiện

1. Tạo hai private/public repository trên GitHub bằng giao diện web.
2. Push workspace hiện tại vào `tripplanner-app`.
3. Trong Settings → Branches/Rulesets:
   - Require pull request before merging.
   - Require status checks sau khi CI được tạo.
   - Block force pushes.
   - Block branch deletion.
4. `tripplanner-k8s` có thể chỉ cần README ở thời điểm này.

### Hoàn thành khi

Không thể push/merge tùy tiện vào `main` trái với ruleset đã chọn.

---

## 15. README và bằng chứng Phase 1

- [ ] README mô tả kiến trúc local.
- [ ] Có hướng dẫn chạy local và Docker.
- [ ] Có bảng API endpoints và environment variables.
- [ ] Ghi kích thước image và kết quả test.
- [ ] Chụp ảnh UI và coverage để dùng cho portfolio.

### Nội dung README tối thiểu

1. Project overview.
2. Local architecture: Browser → Vite/nginx → Express → Atlas + Redis.
3. Prerequisites.
4. Environment setup.
5. Local development commands.
6. Docker Compose commands.
7. API endpoint table.
8. Health/readiness semantics.
9. Test and coverage commands.
10. Security notes: non-root image, secrets ignored, Atlas IP allowlist.

### Hoàn thành khi

Một người khác clone repo, đọc README và có thể dựng lại Phase 1 mà không hỏi bạn
thêm thông tin bí mật hoặc bước ngầm.

---

## Definition of Done — Phase 1

Chỉ đánh dấu Phase 1 hoàn thành khi toàn bộ mục sau đều đúng:

- [ ] Register/login và CRUD trips chạy end-to-end.
- [ ] MongoDB Atlas và Redis được tích hợp đúng vai trò.
- [ ] `/healthz`, `/readyz`, `/metrics` trả kết quả đúng.
- [ ] Lint, tests, coverage và frontend build đều pass.
- [ ] Có `backend/coverage/lcov.info` cho SonarQube.
- [ ] Docker images build được và chạy non-root.
- [ ] Docker Compose dựng được toàn stack.
- [ ] Không có secret hoặc build artifact trong Git.
- [ ] README đủ để người khác tái tạo.
- [ ] GitHub app repo có branch protection.

Khi tất cả mục này được đánh dấu, cập nhật checklist Phase 1 trong
`tripplanner-devops-plan.md`, tạo tag Git ví dụ `phase-1-complete`, rồi mới chuyển
sang Terraform/AWS ở Phase 2.
