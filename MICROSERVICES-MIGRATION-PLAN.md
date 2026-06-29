# TripPlanner — Microservices Migration Plan

## 1. Mục tiêu

Chuyển backend hiện tại thành một hệ thống microservices nhỏ để học:

- Cách xác định ranh giới service.
- Service ownership và database ownership.
- Xác thực giữa nhiều service.
- Routing qua gateway.
- Build, test, deploy và rollback từng service độc lập.
- Quan sát lỗi trong hệ thống phân tán.

Phiên bản đầu chỉ có hai business service:

1. `auth-service`
2. `trip-service`

`notification-service` và message broker chỉ được thêm sau khi hai service lõi
hoạt động ổn định.

---

## 2. Kiến trúc mục tiêu

```text
Browser
   │
   ▼
Frontend nginx / Vite proxy
   ├── /api/auth/*  ──────▶ Auth Service :5001
   │                          ├── Auth database
   │                          └── Redis rate limit
   │
   └── /api/trips/* ──────▶ Trip Service :5002
                              ├── Trip database
                              └── Redis cache
```

Giai đoạn sau:

```text
Trip Service ──TripCreated event──▶ Message Broker ──▶ Notification Service
```

Frontend tiếp tục gọi cùng các endpoint hiện tại:

```text
/api/auth/register
/api/auth/login
/api/trips
```

Nhờ vậy frontend gần như không cần biết backend đã được tách thành nhiều service.

---

## 3. Các quyết định kiến trúc

### 3.1 Monorepo

Giữ toàn bộ source code trong repo `tripplanner-app`:

```text
tripplanner-app/
├── frontend/
├── services/
│   ├── auth-service/
│   └── trip-service/
├── packages/               # Chỉ thêm khi thực sự cần shared code
├── docker-compose.yml
└── package.json
```

Với số lượng service nhỏ, monorepo giúp:

- Dễ thay đổi API và frontend trong cùng một pull request.
- Dễ chạy toàn bộ hệ thống local.
- Dùng chung quy ước lint/test.
- Pipeline có thể build theo đường dẫn thay đổi.

Không chia mỗi service thành một Git repository ở giai đoạn này.

### 3.2 Gateway

Không tạo một API Gateway service riêng ngay lập tức.

- Local development: Vite proxy route theo path.
- Docker: nginx route theo path.
- Kubernetes: Ingress hoặc frontend nginx route tới Kubernetes Service.

Routing:

```text
/api/auth/*  → auth-service
/api/trips/* → trip-service
```

### 3.3 Database ownership

Dùng cùng một MongoDB Atlas cluster để tiết kiệm nhưng tách logical database:

```text
tripplanner_auth
tripplanner_trips
```

Quy tắc:

- Auth Service chỉ truy cập `tripplanner_auth`.
- Trip Service chỉ truy cập `tripplanner_trips`.
- Không service nào đọc collection của service còn lại.
- `ownerId` trong trip là một ID dạng string; MongoDB không tạo foreign key sang
  database của Auth Service.

Nếu dữ liệu hiện tại chỉ là dữ liệu học tập, tạo database mới và đăng ký lại user
đơn giản hơn viết data migration. Nếu cần giữ dữ liệu, export/import users và trips
thành hai database trước khi xóa backend cũ.

### 3.4 JWT

Migration được chia thành hai bước:

1. Giữ HS256/shared `JWT_SECRET` khi vừa tách service để giảm số thay đổi cùng lúc.
2. Khi hệ thống chạy ổn, chuyển sang RS256:
   - Auth Service giữ private key và ký token.
   - Trip Service chỉ giữ public key để xác minh.

Trip Service tự xác minh JWT, không gọi Auth Service trên mỗi request.

### 3.5 Redis

Ban đầu dùng chung một Redis instance nhưng tách namespace:

```text
auth:rate-limit:*
trips:cache:*
```

- Auth Service sở hữu rate-limit keys.
- Trip Service sở hữu cache keys.
- Không service nào đọc keys thuộc namespace còn lại.

### 3.6 Giao tiếp giữa service

Hai service lõi không cần gọi trực tiếp nhau trong request path:

- Auth Service phát JWT.
- Trip Service xác minh JWT và lấy `sub` làm `ownerId`.

Notification được triển khai bất đồng bộ sau:

- Trip Service publish event.
- Notification Service consume event.
- Trip creation không thất bại chỉ vì Notification Service đang down.

---

## 4. Phase A — Đóng băng baseline monolith

### Việc cần làm

- [ ] Đảm bảo frontend, backend, Redis và Atlas đang chạy.
- [ ] Chạy lint, test, coverage và frontend build.
- [ ] Kiểm tra Docker Compose end-to-end.
- [ ] Commit toàn bộ thay đổi hợp lệ.
- [ ] Tạo Git tag cho phiên bản monolith ổn định.

### Kết quả

Có một baseline có thể quay lại nếu migration gặp lỗi. Không xóa thư mục `backend`
trước khi hai service mới vượt qua test end-to-end.

### Commit gợi ý

```text
chore: finalize monolith baseline
```

---

## 5. Phase B — Tạo cấu trúc services

### Cấu trúc

```text
services/
├── auth-service/
│   ├── src/
│   ├── tests/
│   ├── package.json
│   └── Dockerfile
└── trip-service/
    ├── src/
    ├── tests/
    ├── package.json
    └── Dockerfile
```

### Việc cần làm

- [ ] Thêm hai service vào npm workspaces.
- [ ] Mỗi service có `app.js` và `server.js` riêng.
- [ ] Mỗi service có config validation riêng.
- [ ] Mỗi service có error handler riêng.
- [ ] Mỗi service có `/healthz`, `/readyz`, `/metrics`.
- [ ] Dùng port `5001` cho Auth và `5002` cho Trips.
- [ ] Chưa chuyển business logic ở bước này.

### Kết quả

Hai service có thể khởi động tối thiểu và trả health check.

### Commit gợi ý

```text
chore: scaffold auth and trip services
```

---

## 6. Phase C — Tách Auth Service

### Chuyển từ backend cũ

- User model.
- Register/login routes.
- bcrypt password hashing.
- JWT issuing.
- Auth rate limiter.
- MongoDB connection.
- Redis connection dành cho rate limit.
- Auth tests.

### Environment

```env
PORT=5001
AUTH_MONGO_URI=mongodb+srv://.../tripplanner_auth
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=...
JWT_EXPIRES_IN=1d
```

### Việc cần làm

- [ ] Auth Service kết nối database riêng.
- [ ] `POST /api/auth/register` hoạt động.
- [ ] `POST /api/auth/login` hoạt động.
- [ ] Token vẫn chứa `sub` là user ID.
- [ ] Password không xuất hiện trong response/log.
- [ ] Rate limit keys dùng prefix `auth:rate-limit:`.
- [ ] Unit và API tests pass.

### Kết quả

Frontend có thể đăng ký và đăng nhập qua Auth Service.

### Commit gợi ý

```text
feat(auth): extract authentication service
```

---

## 7. Phase D — Tách Trip Service

### Chuyển từ backend cũ

- Trip model.
- Trip routes và service.
- JWT verification middleware.
- Redis cache.
- MongoDB connection.
- Trip tests.

### Environment

```env
PORT=5002
TRIP_MONGO_URI=mongodb+srv://.../tripplanner_trips
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=...
```

### Việc cần làm

- [ ] Trip Service kết nối database riêng.
- [ ] Xác minh token mà Auth Service phát hành.
- [ ] Dùng JWT `sub` làm `ownerId`.
- [ ] CRUD trips hoạt động.
- [ ] User chỉ đọc/sửa/xóa trip của chính mình.
- [ ] Cache keys dùng prefix `trips:cache:`.
- [ ] Mutation làm cache cũ bị invalidation.
- [ ] Unit và API tests pass.

### Kết quả

User đăng nhập từ Auth Service có thể dùng token để CRUD qua Trip Service.

### Commit gợi ý

```text
feat(trips): extract trip service
```

---

## 8. Phase E — Cập nhật frontend proxy và nginx

### Vite development proxy

```text
/api/auth  → http://localhost:5001
/api/trips → http://localhost:5002
```

### nginx Docker proxy

```text
/api/auth/  → http://auth-service:5001
/api/trips/ → http://trip-service:5002
```

### Việc cần làm

- [ ] Frontend vẫn chỉ gọi relative path `/api/...`.
- [ ] Không hard-code service host trong React source.
- [ ] Login/register route tới Auth Service.
- [ ] Trip requests route tới Trip Service.
- [ ] Refresh SPA route không trả nginx 404.

### Commit gợi ý

```text
feat(gateway): route API paths to backend services
```

---

## 9. Phase F — Cập nhật Docker Compose

### Services

```text
frontend
auth-service
trip-service
redis
```

MongoDB Atlas tiếp tục nằm ngoài Compose.

### Startup dependencies

```text
Redis healthy
   ├──▶ Auth Service healthy
   └──▶ Trip Service healthy
             │
             ▼
         Frontend
```

### Việc cần làm

- [ ] Mỗi business service có Dockerfile multi-stage.
- [ ] Container chạy non-root.
- [ ] Auth và Trip Service không publish port trong full Compose.
- [ ] Frontend là entry point duy nhất ở port `3000`.
- [ ] Redis chỉ publish `127.0.0.1:6379` khi cần hybrid local development.
- [ ] Health checks hoạt động cho cả hai service.
- [ ] `docker compose up --build` dựng được toàn hệ thống.

### Commit gợi ý

```text
build: run auth and trip services with Compose
```

---

## 10. Phase G — Test end-to-end

### Luồng bắt buộc

```text
Register
  → Login
  → Receive JWT
  → Create trip
  → List trip
  → Update trip
  → Delete trip
```

### Test failure scenarios

- [ ] Token thiếu hoặc sai bị trả `401`.
- [ ] User A không truy cập trip của User B.
- [ ] Auth Service down: login mới thất bại.
- [ ] Auth Service down: token còn hạn vẫn dùng Trip Service được.
- [ ] Redis down: readiness phản ánh đúng trạng thái.
- [ ] Mongo Auth down không làm Trip Service crash.
- [ ] Mongo Trips down không làm Auth Service crash.

### Kết quả

Failure của một service không làm service còn lại dừng process ngoài những dependency
mà service đó thực sự cần.

### Commit gợi ý

```text
test: add cross-service end-to-end coverage
```

---

## 11. Phase H — Chuyển JWT sang RS256

### Việc cần làm

- [ ] Tạo RSA key pair cho development.
- [ ] Auth Service nhận private key qua secret.
- [ ] Trip Service nhận public key qua config/secret.
- [ ] Token dùng algorithm `RS256`.
- [ ] Trip Service từ chối algorithm không được allowlist.
- [ ] Không commit private key.
- [ ] Có kế hoạch key rotation bằng `kid`/JWKS ở giai đoạn sau.

### Kết quả

Trip Service có thể verify token nhưng không thể tự ký token hợp lệ.

### Commit gợi ý

```text
feat(auth): use asymmetric JWT signing
```

---

## 12. Phase I — Xóa backend monolith

Chỉ thực hiện khi tất cả test end-to-end đã pass.

### Việc cần làm

- [ ] Kiểm tra không file nào import từ `backend/`.
- [ ] Xóa workspace `backend`.
- [ ] Xóa backend cũ khỏi Docker Compose.
- [ ] Xóa environment variables không còn dùng.
- [ ] Cập nhật README và architecture diagram.
- [ ] Chạy lại lint, tests, coverage, builds và Compose.

### Commit gợi ý

```text
refactor: remove legacy monolith backend
```

---

## 13. Cập nhật CI/CD

Pipeline dùng path-based execution:

```text
frontend/**              → test/build frontend image
services/auth-service/** → test/build auth image
services/trip-service/** → test/build trip image
```

### Việc cần làm

- [ ] Test từng workspace độc lập.
- [ ] Scan filesystem và dependencies từng service.
- [ ] SonarQube project hoặc module coverage rõ ràng.
- [ ] Build ba image riêng.
- [ ] Scan image trước khi push.
- [ ] Tag từng image bằng Git SHA.
- [ ] Chỉ rebuild service bị ảnh hưởng; shared package thay đổi thì build dependents.
- [ ] Có một E2E job sau khi các image cần thiết được build.

### Images

```text
tripplanner-frontend:<sha>
tripplanner-auth:<sha>
tripplanner-trips:<sha>
```

---

## 14. Cập nhật Kubernetes/GitOps

### Workloads

```text
frontend Deployment + Service
auth-service Deployment + Service
trip-service Deployment + Service
redis Deployment + Service
```

### Việc cần làm

- [ ] Resource requests/limits cho từng Deployment.
- [ ] Liveness, readiness và startup probes cho từng service.
- [ ] ConfigMap riêng theo service.
- [ ] Secret access theo least privilege.
- [ ] NetworkPolicy:
  - Frontend/gateway được gọi Auth và Trips.
  - Auth và Trips được gọi Redis.
  - Auth không được gọi Trip Service trực tiếp.
- [ ] ServiceMonitor riêng cho Auth và Trips.
- [ ] Dashboard tách request rate/error/latency theo service.
- [ ] Alert xác định đúng service đang lỗi.

Terraform provision hạ tầng AWS/EKS không cần thay đổi lớn; phần thay đổi chủ yếu nằm
ở container pipeline và Kubernetes manifests.

---

## 15. Optional — Notification Service

Chỉ thêm sau khi hai service lõi ổn định.

### Luồng

```text
Trip Service
  → publish TripCreated
  → Message Broker
  → Notification Service
```

### Nội dung học

- Event schema và versioning.
- At-least-once delivery.
- Idempotent consumer.
- Retry và dead-letter queue.
- Correlation ID và distributed tracing.

Không thêm Notification Service nếu chưa có một hành vi thực tế cần chạy bất đồng
bộ, ví dụ email nhắc lịch.

---

## 16. Definition of Done

Migration hoàn thành khi:

- [ ] Auth và Trips là hai process/image độc lập.
- [ ] Mỗi service sở hữu database riêng.
- [ ] Frontend gọi qua cùng `/api` contract cũ.
- [ ] Trip Service verify JWT mà không gọi Auth Service mỗi request.
- [ ] Hai service có health, readiness và metrics riêng.
- [ ] Tests từng service và E2E test đều pass.
- [ ] Docker Compose dựng được toàn hệ thống.
- [ ] Backend monolith cũ đã được xóa.
- [ ] CI build/scan image theo service.
- [ ] Kubernetes deploy và rollback từng service độc lập.
- [ ] README phản ánh đúng kiến trúc mới.

---

## 17. Những điều cần tránh

- Không tách service nhưng vẫn dùng chung model/database.
- Không tạo một package `shared` chứa toàn bộ business entities.
- Không để Trip Service gọi Auth Service trên mọi request chỉ để verify token.
- Không thêm message broker khi chưa có use case bất đồng bộ.
- Không xóa monolith trước khi E2E test của service mới chạy xanh.
- Không thay đổi API frontend, database ownership, JWT algorithm và CI/CD trong cùng
  một commit lớn.
