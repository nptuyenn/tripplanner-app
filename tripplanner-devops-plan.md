# TripPlanner — DevSecOps + GitOps Implementation Plan (v3)

> Bản kế hoạch triển khai một ứng dụng MERN 3 tầng lên **AWS EKS** theo mô hình
> **DevSecOps + GitOps**, thiết kế để dùng làm **project portfolio/CV**.
> Trọng tâm là **DevOps practices** chứ không phải tính năng ứng dụng — ứng dụng
> chỉ cần đủ "thật" để có thứ để build, scan, deploy và monitor.

---

## 0. Định vị project & những gì nó chứng minh (đọc trước khi bắt đầu)

Vì đây là project để phỏng vấn, hãy xác định ngay những **năng lực** mà project
phải thể hiện được — mọi quyết định kỹ thuật phía sau nên phục vụ danh sách này:

| Năng lực DevOps | Thể hiện qua phần nào |
|---|---|
| CI/CD pipeline design | Jenkins CI + GitOps CD tách bạch |
| Security shift-left (DevSecOps) | Trivy, OWASP DC, SonarQube **chặn** pipeline khi fail |
| Containerization | Multi-stage Dockerfile, image nhỏ, non-root |
| Kubernetes | Deployment, Service, probes, resource limits, HPA |
| GitOps | ArgoCD auto-sync, self-heal, repo manifest riêng |
| IaC | Terraform quản lý VPC, IAM, EC2, EKS, node group, add-on và Security Group |
| Observability | Prometheus + Grafana + alert rules + app metrics |
| Secret management | Sealed Secrets / External Secrets (KHÔNG commit secret thô) |
| Documentation | README + architecture diagram + ảnh pipeline |

> **Lưu ý định hướng:** Một sai lầm phổ biến của project CV là dồn công sức vào
> tính năng app. Ở đây làm ngược lại — app giữ tối giản (CRUD trips + auth), thời
> gian dành cho **pipeline, bảo mật, k8s, observability**. Khi phỏng vấn, người ta
> hỏi "tại sao chọn cách này" nhiều hơn "app có chức năng gì".

### Luồng tổng thể

```
Dev push code
   │
   ▼
GitHub (tripplanner-app)  ──webhook──▶  Jenkins CI
                                          │
                          ┌───────────────┴────────────────┐
                          ▼  Trivy FS → OWASP DC → SonarQube │  (security gates)
                          ▼  Build image → Trivy image scan  │
                          ▼  Push Docker Hub (tag = git SHA)  │
                          └───────────────┬────────────────┘
                                          ▼
                          Update image tag trong tripplanner-k8s repo
                                          │
                                          ▼
GitHub (tripplanner-k8s)  ──watch──▶  ArgoCD  ──sync──▶  AWS EKS
                                                            │
                                          Prometheus + Grafana giám sát
```

### Chiến lược repo (2 repo — chuẩn GitOps)

| Repo | Nội dung | Ai ghi vào |
|---|---|---|
| `tripplanner-app` | Source code FE/BE, Dockerfile, Jenkinsfile, tests | Developer |
| `tripplanner-k8s` | `kubernetes/` chứa manifest/Helm/ArgoCD; `terraform/` chứa IaC AWS | CI chỉ cập nhật image trong `kubernetes/`; Developer chạy Terraform |

> **Tại sao tách repo:** GitOps coi Git là "source of truth" cho trạng thái cluster.
> Để app code và manifest chung repo sẽ gây vòng lặp build vô tận (CI sửa manifest →
> trigger CI lại). Tách repo là câu trả lời chuẩn khi bị hỏi. ArgoCD chỉ watch thư mục
> `kubernetes/`; Terraform state không commit vào Git mà lưu ở remote backend S3.

---

## Tech Stack (đã cập nhật version)

### Ứng dụng (MERN — giữ tối giản)

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | React + Vite + Tailwind | SPA, build static, serve bằng nginx |
| Backend | Node.js + Express | REST API `/api/trips`, expose `/metrics` cho Prometheus |
| Database | MongoDB Atlas | Managed, ngoài cluster — không cần quản lý stateful trong k8s |
| Cache | Redis (in-cluster) | Cache API + rate limit; không bật persistence |
| Auth | JWT + bcrypt | Stateless, hợp với scale ngang |

### DevOps Stack

| Hạng mục | Tool | Version / Lưu ý |
|---|---|---|
| CI | Jenkins (Master + Worker agent) | Master & Worker **đồng bộ Java 21** |
| Scan filesystem & image | Trivy | Chạy với `--exit-code 1 --severity HIGH,CRITICAL` |
| Dependency CVE | OWASP Dependency-Check | **Cần NVD API key** (xem Phase 3 lưu ý) |
| Code quality | SonarQube (community, Docker) | Kèm coverage `lcov` từ test |
| Registry | Docker Hub | Tag = **git SHA**, không dùng `latest` |
| CD / GitOps | ArgoCD | Pin một bản stable đã test; không dùng tag `latest` |
| Kubernetes | AWS EKS **v1.35 Standard Support** | EKS truyền thống + Managed Node Group On-Demand; không Auto Mode/Spot/Extended Support |
| IaC | Terraform | AWS provider + module VPC/EKS; pin version đã kiểm thử; remote state trên S3 |
| Package | Helm | Cài kube-prometheus-stack; cân nhắc Helm-hóa app |
| Monitoring | Prometheus + Grafana + Alertmanager | Có alert rules, không chỉ cài rồi để đó |

---

## Nguyên tắc xuyên suốt (cross-cutting — áp dụng ở mọi phase)

Đây là phần làm project "DevOps hơn". Quyết định một lần, áp dụng nhất quán:

1. **Image tagging bất biến (immutable):** mọi image tag = `git short SHA` (hoặc
   `<build>-<sha>`). **Không bao giờ** deploy `:latest`. Lý do: `latest` phá vỡ khả
   năng rollback và truy vết "production đang chạy đúng commit nào".
2. **Branching:** `main` được protect, bắt buộc PR. PR mở → CI chạy (test + scan,
   không push image). Merge vào `main` → CI full (build + push + cập nhật manifest).
3. **Security gate là gate thật:** Trivy/OWASP/Sonar fail thì pipeline **đỏ và dừng**,
   không cho qua. Đây là khác biệt giữa "có chạy scan" và "thực sự làm DevSecOps".
4. **Secret không bao giờ ở dạng thô trong Git** (xem Phase 5).
5. **Mọi workload k8s có:** `resources.requests/limits`, `livenessProbe`,
   `readinessProbe`. Thiếu thì ArgoCD không báo Healthy chính xác và HPA không hoạt động.
6. **Mọi thứ "demo-only" phải ghi chú trong README** để người đọc CV biết bạn *hiểu*
   nó không an toàn cho production (xem danh sách ở Phase cuối).

---

## Hạ tầng AWS (Terraform + PAYG)

> Region: `us-east-1`. Tài khoản dùng mô hình **Pay As You Go**: EC2 On-Demand, EBS và
> EKS control plane tính theo thời gian sử dụng. Không dùng Spot ở bản chính để giảm biến
> số khi demo. Nhớ **Clean Up** sau mỗi buổi làm vì EKS control plane tính tiền theo giờ
> kể cả khi không deploy workload.

### EC2

| Máy | Spec | Cài gì |
|---|---|---|
| **Master EC2** | t3.large · 2vCPU/8GB · 30GB | Jenkins Master, Terraform, kubectl, ArgoCD CLI, SonarQube (Docker), Helm, AWS CLI, **Java 21** |
| **Worker EC2** (Jenkins agent) | t3.large · 2vCPU/8GB · 30GB | Jenkins agent, Docker, Trivy, kubectl, **Java 21** |

> **Lưu ý sizing EKS nodes:** kube-prometheus-stack khá nặng RAM. 2× `t3.medium`
> (2vCPU/4GB) sẽ chật khi chạy đồng thời app + ArgoCD + monitoring stack → dễ gặp
> pod `Pending`. Dùng **`t3.large`** cho node group, hoặc cho phép scale lên 3 node sớm.

### Bảng port Security Group

| Port | Service | Mở ở máy |
|---|---|---|
| 8080 | Jenkins Master UI | Master |
| 9000 | SonarQube | Master |
| 465 | SMTP (email notify) | Master |
| `3xxxx` (NodePort thực tế) | ArgoCD server | Worker nodes |
| `31000` | Frontend (NodePort) | Worker nodes |
| `31100` | Backend (nếu expose trực tiếp) | Worker nodes |
| `3xxxx` (NodePort thực tế) | Grafana | Worker nodes |
| `3xxxx` (NodePort thực tế) | Prometheus | Worker nodes |

> ❗ **Sửa so với bản cũ:** Prometheus/Grafana/ArgoCD khi expose qua **NodePort** sẽ
> nhận port trong dải **30000–32767**, KHÔNG phải 9090/3000/32738 cố định. Mở đúng
> port mà Service thực sự được gán (xem `kubectl get svc`), đừng hard-code 9090/3000.

---

# LỘ TRÌNH THEO PHASE

Mỗi phase gồm: **Mục tiêu** · **Việc cần làm** · **Lưu ý / gotcha** · (nếu có) **Điểm cộng CV**.

---

## Phase 1 — Ứng dụng TripPlanner + Containerization (Tuần 1)

**Mục tiêu:** Có app MERN chạy được local qua Docker Compose, image gọn và an toàn,
đủ "thật" để pipeline có thứ để xử lý.

### Việc cần làm

- [ ] Tạo 2 repo: `tripplanner-app`, `tripplanner-k8s`; bật branch protection cho `main`
- [ ] Backend: Express + Mongoose, REST `GET/POST/PUT/DELETE /api/trips`
- [ ] Backend: JWT auth middleware (register/login, bcrypt hash password)
- [ ] Backend: tích hợp Redis (cache danh sách trips + rate limit)
- [ ] **Backend: expose endpoint `/metrics`** bằng `prom-client` (sẽ dùng ở Phase 6)
- [ ] **Backend: endpoint health `/healthz` (liveness) và `/readyz` (readiness)**
- [ ] **Viết test** (Jest/Vitest) + sinh báo cáo coverage dạng `lcov` (cho SonarQube)
- [ ] Frontend: React + Vite + React Router, gọi API qua biến môi trường base URL
- [ ] Viết Dockerfile multi-stage cho cả FE và BE
- [ ] Viết `docker-compose.yml` test local (FE + BE + Redis), MongoDB dùng Atlas
- [ ] Thêm `.dockerignore` (loại `node_modules`, `.git`, `.env`)
- [ ] Thêm `.gitignore` (chặn `.env`, file secret lọt vào Git)

### Lưu ý

- **Container chạy non-root:** thêm `USER node` (BE) — Trivy/SonarQube sẽ trừ điểm nếu
  chạy root. Đây là việc nhỏ nhưng gây ấn tượng tốt.
- **Dockerfile BE** ở bản cũ copy `node_modules` từ stage builder nhưng builder lại
  `npm ci --only=production` — đúng cho production nhưng nhớ **dev dependencies (test)**
  phải cài ở stage chạy test trong CI, không nằm trong image cuối.
- **Frontend gọi backend ra sao** — quyết định ngay từ giờ (ảnh hưởng manifest Phase 5):
  - *Khuyến nghị:* nginx của frontend reverse-proxy `/api` → Service backend nội bộ
    cluster (`tripplanner-backend:5000`). Tránh expose backend ra NodePort, tránh CORS.
  - *Đơn giản hơn:* frontend gọi thẳng `<node-ip>:31100` — phải xử lý CORS, kém sạch.
- **Health endpoint tách biệt:** `/healthz` chỉ trả 200 nếu process sống; `/readyz`
  kiểm tra kết nối Mongo + Redis. Đừng gộp làm một — k8s dùng chúng cho 2 mục đích khác nhau.

### Điểm cộng CV
- Image cuối < 200MB, non-root, multi-stage → nói được trong phỏng vấn về tối ưu image.
- Có sẵn `/metrics` từ đầu → Phase 6 chỉ việc scrape, thể hiện app-level observability
  chứ không chỉ infra metrics.

---

## Phase 2 — Provisioning hạ tầng AWS bằng Terraform (Tuần 2)

**Mục tiêu:** Một lần `terraform apply` tạo được network, IAM, 2 EC2 Jenkins và EKS
1.35 Standard Support với 2 managed node On-Demand; có thể teardown bằng
`terraform destroy` mà không để sót tài nguyên.

### Việc cần làm

- [ ] Cấu hình AWS CLI bằng IAM Identity Center/assume-role; tránh access key dài hạn
- [ ] Cài Terraform trên máy quản trị; pin Terraform và AWS provider trong `versions.tf`
- [ ] Tạo bootstrap stack cho remote state: S3 bucket bật encryption, versioning và
      state locking (`use_lockfile = true`)
- [ ] Tạo cấu trúc `tripplanner-k8s/terraform/{bootstrap,environments/dev,modules}`
- [ ] Khai báo VPC, subnet, route, Internet Gateway và các tag cần cho EKS
- [ ] Khai báo IAM roles/policies theo least privilege cho EKS, node group và EC2 Jenkins
- [ ] Khai báo SSH key pair, Master EC2 và Worker EC2 bằng Terraform
- [ ] Dùng `user_data` hoặc Ansible để cài Master: Docker, AWS CLI, kubectl, Terraform,
      Helm, Java 21; Worker: Docker, Trivy, kubectl, Java 21
- [ ] Khai báo Security Group cho Master/Worker; giới hạn Jenkins/SonarQube theo source IP
- [ ] **Verify version EKS được hỗ trợ** bằng `aws eks describe-cluster-versions`
- [ ] Khai báo EKS `1.35` với `upgrade_policy.support_type = "STANDARD"`
- [ ] Bật cluster OIDC provider (cần cho IRSA / add-on sau này)
- [ ] Tạo EKS Managed Node Group On-Demand `t3.large`, desired/min 2, max 3
- [ ] Cài EKS managed add-on: VPC CNI, CoreDNS, kube-proxy đúng version cho EKS 1.35
- [ ] Chạy `terraform fmt -check`, `terraform validate`, lưu `terraform plan` làm artifact
- [ ] Review plan rồi mới chạy `terraform apply`
- [ ] `kubectl get nodes` → 2 node `Ready`
- [ ] Test `terraform plan` lần hai không còn drift ngoài dự kiến

### Lưu ý

- **kubectl phải khớp version cluster** (lệch tối đa ±1 minor). Dùng kubectl 1.35 cho cluster 1.35.
- **Terraform state có thể chứa dữ liệu nhạy cảm:** không commit `.tfstate`; S3 backend phải
  bật encryption, versioning, block public access và policy chỉ cho principal quản trị IaC.
- **Bootstrap là bước riêng:** bucket backend phải tồn tại trước khi stack chính chạy.
  Giữ bootstrap config nhỏ và không xóa bucket state trong thao tác destroy hằng ngày.
- **Không dùng `AdministratorAccess` cho EC2 Worker:** Docker Hub/GitHub dùng credentials
  riêng; chỉ cấp quyền AWS thực sự cần cho các stage chạy trên node đó.
- **Managed Node Group max 3 không tự scale:** muốn node tự tăng từ 2 lên 3 phải cài
  Cluster Autoscaler/Karpenter. Bản đầu giữ desired=2; autoscaling là level-up.
- **PAYG/On-Demand:** dễ dự đoán khi demo nhưng vẫn tính phí khi instance chạy. Terraform
  quản lý cả Jenkins EC2 và EKS để một lệnh destroy dọn được phần lớn hạ tầng.

### Điểm cộng CV
- Terraform tạo cả network, compute và EKS; remote state có locking; plan/apply tách biệt.
- Chủ động chọn Standard Support và pin EKS 1.35 → thể hiện quản lý cost/security lifecycle.

---

## Phase 3 — Jenkins + bộ công cụ DevSecOps (Tuần 3)

**Mục tiêu:** Jenkins Master + Worker agent kết nối; SonarQube, Trivy, OWASP sẵn sàng;
credentials và email cấu hình đủ.

### Việc cần làm

- [ ] Cài Jenkins Master (Java 21) tại `:8080`, hoàn tất setup wizard
- [ ] Thiết lập Worker làm agent qua SSH (label `Node`), 2 executors
- [ ] Cài SonarQube community bằng Docker tại `:9000`
- [ ] Cài Trivy trên Worker
- [ ] Cài plugins: OWASP Dependency-Check, SonarQube Scanner, Docker, Docker Pipeline,
      Pipeline Stage View, Email Extension, **Pipeline Utility Steps**
- [ ] `Manage Jenkins → Tools`: cấu hình SonarQube Scanner (`sonar-scanner`),
      OWASP-DC installation (`OWASP-DC`)
- [ ] `Manage Jenkins → System`: khai báo SonarQube server (`sonar-server`) + token
- [ ] Tạo SonarQube **webhook** trỏ về Jenkins (để `waitForQualityGate` nhận kết quả)
- [ ] Cấu hình credentials (bảng dưới)
- [ ] Cấu hình email notification (Gmail App Password + SMTP 465)

### Credentials cần tạo

| ID | Loại | Dùng cho |
|---|---|---|
| `docker-cred` | Username/Password | Docker Hub push |
| `github-token` | Username/Password (PAT ở ô password) | Push manifest sang repo k8s |
| `sonar-token` | Secret text | SonarQube API token |
| `email-cred` | Username/Password | Gmail App Password |
| `nvd-api-key` | Secret text | **Tăng tốc OWASP Dependency-Check** |

### Lưu ý (phần này nhiều bẫy thực tế nhất)

- ❗ **OWASP Dependency-Check tải toàn bộ NVD database ở lần chạy đầu** → có thể mất
  **30–60 phút** và bị **rate-limit/403** từ NVD. Bắt buộc: đăng ký **NVD API key miễn phí**
  và truyền vào (`--nvdApiKey`), đồng thời **cache thư mục data của OWASP-DC** giữa các build
  (đừng để build nào cũng tải lại). Đây là nguyên nhân #1 khiến pipeline "treo" của người mới.
- **SonarQube webhook là bắt buộc** nếu dùng `waitForQualityGate` — không có webhook,
  stage này treo tới hết timeout.
- **Coverage trong Sonar = 0 nếu không truyền lcov:** chạy test sinh `lcov.info`, rồi
  truyền `-Dsonar.javascript.lcov.reportPaths=coverage/lcov.info`. Nếu không, Quality Gate
  về coverage luôn fail/0% và bạn sẽ tưởng cấu hình sai.
- **GitHub webhook → Jenkins** cần Jenkins reachable từ internet (Master public IP:8080).
  Nếu không muốn mở, dùng **SCM polling** (`pollSCM`) — chậm hơn nhưng an toàn hơn.
- **Java đồng bộ:** Master và Worker cùng Java 21 để tránh lỗi agent remoting.
- **`chmod 777 /var/run/docker.sock`** trên Worker là cách "chữa cháy" cho lỗi permission
  khi `docker build` — **demo-only, không an toàn** (mở quyền root qua docker socket). Ghi chú lại.

### Điểm cộng CV
- Cache NVD/Trivy DB + Docker layer cache → biết tối ưu thời gian pipeline.
- Quality Gate có coverage thật → "DevSecOps" có thực chất.

---

## Phase 4 — CI Pipeline (Tuần 4)

**Mục tiêu:** Pipeline `TripPlanner-CI` chạy xanh, scan **chặn được** lỗi, build image
tag bất biến, push Docker Hub, rồi cập nhật manifest (trigger CD).

### Luồng CI (đã sửa thứ tự scan)

```
Checkout
  → Install deps + Run tests (sinh coverage)
  → Trivy filesystem scan        (gate: fail nếu HIGH/CRITICAL)
  → OWASP Dependency-Check       (gate)
  → SonarQube Analysis + Quality Gate   (gate: abortPipeline = true)
  → Docker Build (FE + BE)
  → Trivy IMAGE scan             ← QUÉT TRƯỚC KHI PUSH (sửa so với bản cũ)
  → Docker Push (tag = git SHA)
  → Cập nhật image tag trong repo tripplanner-k8s  (trigger ArgoCD)
```

### Việc cần làm

- [ ] Viết `Jenkinsfile` (CI) trong repo `tripplanner-app`
- [ ] Stage test chạy trước, sinh `lcov` cho Sonar
- [ ] **Trivy gate:** `trivy fs --exit-code 1 --severity HIGH,CRITICAL .`
- [ ] **Sonar gate:** `waitForQualityGate abortPipeline: true`
- [ ] **Trivy image scan đặt TRƯỚC docker push** (không push image bẩn lên registry)
- [ ] Tag image = `git rev-parse --short HEAD` (không dùng `latest`)
- [ ] Stage cuối: clone `tripplanner-k8s`, `sed` cập nhật tag, commit & push
- [ ] Lưu artifact báo cáo scan (HTML) để đính kèm build
- [ ] `post { always { emailext(...) } }` gửi mail kết quả
- [ ] Cấu hình trigger: webhook GitHub (hoặc pollSCM) trên nhánh `main`
- [ ] Test fail có chủ đích (thêm 1 dependency lỗi) để **chứng minh gate thật sự chặn**

### Lưu ý

- **Quyết định kiến trúc CD:** có 2 hướng GitOps, chọn 1 và nói rõ lý do:
  - **(A) CI tự sửa manifest** (cách bản kế hoạch đang dùng): CI clone repo k8s, sed tag,
    push. Đơn giản, dễ hiểu. Nhược: CI có quyền ghi vào repo k8s.
  - **(B) ArgoCD Image Updater** (level-up): ArgoCD tự phát hiện image tag mới trên registry
    và tự cập nhật. CI không cần đụng repo k8s → GitOps "thuần" hơn. Ăn điểm phỏng vấn cao hơn.
- **Đừng để 1 pipeline build cả FE+BE rồi tag chung 1 số** nếu muốn deploy độc lập — cân
  nhắc tag riêng theo service. Với scope demo, tag chung theo commit là chấp nhận được (ghi chú).
- **`abortPipeline: true`** đổi hẳn ý nghĩa project: đây là ranh giới giữa "có cài Sonar"
  và "Sonar thực sự gác cổng". Nếu để `false` thì phải giải thích được vì sao.
- **Test fail có chủ đích** rất đáng làm: chụp lại pipeline đỏ vì CVE/Quality Gate để bỏ vào
  README — bằng chứng trực quan rằng security gate hoạt động.

### Điểm cộng CV
- Ảnh chụp pipeline đỏ (gate chặn) + xanh (sau khi fix) là "story" mạnh khi phỏng vấn.
- Immutable tag + manifest update tự động = hiểu đúng vòng GitOps.

---

## Phase 5 — ArgoCD + GitOps CD (Tuần 5)

**Mục tiêu:** ArgoCD trên EKS tự đồng bộ từ repo `tripplanner-k8s`, self-heal, app live.

### Việc cần làm

- [ ] Viết đầy đủ manifest trong `tripplanner-k8s`:
  - `namespace.yaml`
  - `configmap.yaml` (biến không nhạy cảm: REDIS_URL, NODE_ENV, base URL...)
  - **secret** (MONGO_URI, JWT_SECRET) — xử lý theo phần "secret" bên dưới, KHÔNG commit thô
  - `frontend/`: deployment + service (NodePort 31000)
  - `backend/`: deployment + service (ClusterIP, để nginx FE proxy vào)
  - `redis/`: deployment + service (ClusterIP)
- [ ] **Mỗi Deployment có:** `resources.requests/limits`, `livenessProbe` (`/healthz`),
      `readinessProbe` (`/readyz`)
- [ ] Cài ArgoCD (`kubectl apply` manifest stable), đợi pod Ready
- [ ] Expose ArgoCD server qua NodePort, lấy initial admin password, đổi password
- [ ] Cài ArgoCD CLI (**bản mới**), `argocd login`, thêm EKS cluster
- [ ] Kết nối ArgoCD với repo `tripplanner-k8s`
- [ ] Tạo ArgoCD Application: bật **Auto-Sync + Self-Heal + Prune + Auto-Create Namespace**
- [ ] Test E2E: push code app → CI chạy → manifest cập nhật → ArgoCD sync → app live
- [ ] Mở port NodePort của frontend trên Security Group, truy cập `<node-ip>:31000`

### Xử lý Secret (phần DevOps quan trọng — đừng bỏ qua)

> K8s `Secret` chỉ là **base64**, không phải mã hóa. Commit secret thô vào repo GitOps =
> rò rỉ. Chọn 1 trong các cách (xếp theo độ "ăn điểm"):

| Cách | Mô tả | Độ phù hợp |
|---|---|---|
| **Sealed Secrets** (Bitnami) | Mã hóa secret bằng public key của controller; chỉ controller trong cluster giải mã được → **an toàn để commit vào Git** | ✅ Khuyên dùng cho demo GitOps |
| **External Secrets Operator** | Kéo secret từ AWS Secrets Manager / SSM vào cluster | ✅ "Production-like" nhất, ăn điểm cao |
| SOPS + age/KMS | Mã hóa file trước khi commit | ✅ Ổn |
| `kubectl create secret` thủ công | Tạo ngoài Git, không qua ArgoCD | ⚠️ Đơn giản nhưng "ngoài GitOps" — phải ghi chú |

### Lưu ý

- **MongoDB Atlas network access:** Atlas chặn IP mặc định. Phải whitelist IP **NAT
  Gateway/egress** của EKS node, hoặc `0.0.0.0/0` cho demo (**ghi chú là không an toàn**).
  Đây là lỗi "app không kết nối được DB" hay gặp mà tưởng do code.
- **Private Docker Hub repo** cần `imagePullSecret` trong deployment. Public repo thì không
  — demo nên để public cho gọn (ghi chú).
- **Self-Heal + Prune:** bật để chứng minh GitOps — sửa tay trong cluster sẽ bị ArgoCD
  revert về đúng Git. Đây là "demo moment" rất thuyết phục (sửa replicas bằng kubectl → xem
  ArgoCD kéo về).
- **Sync waves:** nếu Redis phải sẵn sàng trước backend, dùng annotation
  `argocd.argoproj.io/sync-wave` để xếp thứ tự.
- **Probe sai = ArgoCD báo Degraded:** readiness check Mongo/Redis chưa sẵn → pod không
  Ready → app "không lên". Kiểm tra probe trước khi đổ lỗi cho ArgoCD.

### Điểm cộng CV
- Sealed Secrets / External Secrets là điểm khác biệt rõ rệt so với 90% project "Wanderlust clone".
- Demo self-heal trực tiếp khi phỏng vấn = hiểu bản chất GitOps.

---

## Phase 6 — Monitoring & Observability (Tuần 6)

**Mục tiêu:** Không chỉ "cài Prometheus/Grafana" mà có **app metrics, dashboard, và alert
rules** thật sự kích hoạt được.

### Việc cần làm

- [ ] Cài Helm trên Master
- [ ] Cài `kube-prometheus-stack` (Prometheus + Grafana + Alertmanager + exporters) qua Helm
- [ ] Expose Grafana + Prometheus qua NodePort, mở đúng port trên SG
- [ ] Lấy Grafana admin password, đăng nhập
- [ ] **ServiceMonitor cho backend:** để Prometheus scrape `/metrics` của app (đã làm ở Phase 1)
- [ ] Import dashboard hạ tầng: Node Exporter Full (1860), K8s cluster (315/6417), Views/Global (15760)
- [ ] **Tạo 1 dashboard custom** cho app TripPlanner (request rate, latency, error rate — RED method)
- [ ] **Cấu hình alert rules** (PrometheusRule): CPU/Mem cao, pod CrashLoop/restart nhiều,
      backend down, latency p95 vượt ngưỡng
- [ ] Cấu hình Alertmanager gửi cảnh báo (email/Slack/Discord)
- [ ] Test alert: cố tình làm 1 pod crash → xác nhận nhận được cảnh báo

### Lưu ý

- **App-level metrics quan trọng hơn infra metrics** cho CV. Ai cũng import được dashboard
  Node Exporter; ít người expose `/metrics` từ Express và vẽ RED (Rate/Errors/Duration). Đây
  là chỗ tạo khác biệt.
- **kube-prometheus-stack nặng RAM** → lý do Phase 2 chọn `t3.large`. Nếu pod Prometheus
  `Pending`, kiểm tra resource node trước.
- **Alert phải test được:** "có alert rule" mà chưa bao giờ thấy nó kêu thì khó thuyết phục.
  Tự gây sự cố nhỏ để chứng minh đường đi cảnh báo hoạt động (và chụp lại).
- **Đừng expose Grafana/Prometheus public không auth** ngoài demo. Ghi chú.

### Điểm cộng CV
- RED dashboard + alert chạy thật = "observability" có chiều sâu, không chỉ screenshot dashboard mặc định.

---

## Phase 7 — Hardening, Documentation & đóng gói cho CV (song song / cuối tuần 6)

**Mục tiêu:** Biến project chạy được thành project *kể được* trong phỏng vấn.

### Việc cần làm

- [ ] Viết **README** repo `tripplanner-app` và `tripplanner-k8s`:
  - Architecture diagram (vẽ bằng draw.io / Excalidraw)
  - Sơ đồ luồng CI/CD
  - Bảng tech stack + lý do chọn
  - Hướng dẫn chạy lại từ đầu
  - Ảnh: pipeline xanh, pipeline đỏ do gate chặn, ArgoCD synced, Grafana dashboard, alert
- [ ] Viết một mục **"Trade-offs & Production gaps"**: liệt kê thẳng những thứ demo-only và
      bạn sẽ làm gì khác nếu lên production (xem danh sách dưới). **Đây là phần ăn điểm nhất** —
      cho thấy bạn biết giới hạn của chính mình.
- [ ] (Level-up) Thêm pre-commit hooks / lint trong repo app
- [ ] Thêm `Makefile` hoặc script `bootstrap.sh` bọc các lệnh Terraform và bootstrap

### Danh sách "demo-only" cần ghi rõ trong README (chứng tỏ bạn hiểu)

- IAM `AdministratorAccess` trên Worker → production dùng least-privilege + IRSA
- `chmod 777 docker.sock` → production dùng rootless build / Kaniko / BuildKit
- Atlas mở `0.0.0.0/0` → production whitelist NAT IP / PrivateLink
- Expose qua NodePort không TLS → production dùng Ingress + ALB + cert (HTTPS)
- Jenkins/SonarQube/Grafana public không hardening → production để sau VPN/SSO

---

## Level-up (làm sau khi 6 phase chạy ổn — để project nổi bật hơn)

Không bắt buộc cho bản đầu, nhưng mỗi cái dưới đây đều là một "câu chuyện" phỏng vấn:

| Level-up | Đổi gì | Vì sao ăn điểm |
|---|---|---|
| **Terraform CI plan** | PR tự chạy fmt/validate/plan; apply cần approval | Thể hiện workflow IaC an toàn, không chỉ chạy local |
| **Terratest / terraform test** | Kiểm thử module hạ tầng | Nâng IaC từ “tạo được” thành “kiểm chứng được” |
| **Helm chart cho app** | Đóng gói manifest thành chart có values | Quản lý cấu hình theo môi trường (dev/prod) |
| **Kustomize overlays** | base + overlay theo env | Thay thế cho Helm nếu thích, vẫn ăn điểm |
| **ArgoCD Image Updater** | Bỏ stage CI sửa manifest | GitOps "thuần", CI không cần quyền ghi repo k8s |
| **App-of-Apps pattern** | 1 ArgoCD app quản nhiều app con | Quản lý nhiều service có cấu trúc |
| **Ingress + ALB + TLS** | Thay NodePort bằng Ingress HTTPS | Production-like, có domain + cert |
| **HPA** | Tự scale pod theo CPU/mem | Thể hiện hiểu autoscaling (cần resource requests) |
| **Trivy trong CI + Trivy Operator** | Scan liên tục trong cluster | Continuous security, không chỉ scan lúc build |
| **NetworkPolicy** | Hạn chế traffic giữa pod | Bảo mật mạng cluster |

---

## Clean Up (PAYG — chạy sau mỗi buổi để tránh tốn phí)

```bash
# Chạy trong tripplanner-k8s/terraform/environments/dev
terraform plan -destroy -out=tfplan.destroy
terraform apply tfplan.destroy
```

> Review destroy plan trước khi apply. Không destroy bootstrap S3 bucket chứa state trong
> cleanup hằng ngày. Sau destroy, kiểm tra AWS Resource Explorer/Console xem còn Load
> Balancer, EBS volume, Elastic IP, NAT Gateway hay EC2 nào không. Bật AWS Budget/billing
> alert để phát hiện tài nguyên PAYG chạy quên.

---

## Checklist tổng

### Phase 1 — App + Container
- [ ] 2 repo tạo xong, `main` được protect
- [ ] Backend API + JWT + Redis hoạt động
- [ ] `/metrics`, `/healthz`, `/readyz` có sẵn
- [ ] Test + coverage lcov chạy được
- [ ] Frontend gọi backend đúng (quyết định proxy vs trực tiếp)
- [ ] Dockerfile multi-stage, non-root, image gọn
- [ ] Docker Compose chạy local OK

### Phase 2 — Hạ tầng
- [ ] Terraform remote state S3: encryption + versioning + locking
- [ ] `fmt`, `validate`, `plan`, `apply` chạy thành công
- [ ] Terraform tạo Master & Worker, user data cài đủ tooling, cùng Java 21
- [ ] EKS **1.35 Standard Support** + Managed Node Group On-Demand t3.large tạo xong
- [ ] `kubectl get nodes` → 2 node Ready
- [ ] OIDC provider associated, add-on đúng version
- [ ] Security Group mở đúng port
- [ ] Apply lần hai không có drift; destroy dọn sạch stack dev

### Phase 3 — Jenkins + DevSecOps
- [ ] Jenkins Master + Worker agent kết nối
- [ ] SonarQube `:9000`, webhook về Jenkins OK
- [ ] Trivy trên Worker
- [ ] OWASP-DC có **NVD API key** + cache data dir
- [ ] Plugins + credentials đủ
- [ ] Email notification test thành công

### Phase 4 — CI
- [ ] Test + coverage feed vào Sonar
- [ ] Trivy/OWASP/Sonar **chặn** được pipeline (test fail có chủ đích)
- [ ] Trivy image scan **trước** push
- [ ] Image tag = git SHA, push Docker Hub OK
- [ ] Manifest repo k8s được cập nhật tự động

### Phase 5 — ArgoCD / GitOps
- [ ] Manifest đầy đủ, có probes + resource limits
- [ ] Secret xử lý bằng Sealed Secrets / External Secrets (không commit thô)
- [ ] ArgoCD auto-sync + self-heal + prune bật
- [ ] E2E: push → CI → CD → app live tại `<node-ip>:31000`
- [ ] Demo self-heal được (sửa tay → ArgoCD revert)

### Phase 6 — Monitoring
- [ ] Prometheus scrape app `/metrics` qua ServiceMonitor
- [ ] Grafana: dashboard infra + **dashboard app (RED)**
- [ ] Alert rules cấu hình + **test kêu được**
- [ ] Alertmanager gửi cảnh báo (email/Slack)

### Phase 7 — CV polish
- [ ] README + architecture diagram + ảnh pipeline/ArgoCD/Grafana
- [ ] Mục "Trade-offs & Production gaps" viết rõ
- [ ] (Tùy chọn) script bootstrap dựng lại

---

*Kế hoạch TripPlanner DevSecOps + GitOps · Terraform · AWS EKS 1.35 Standard Support · PAYG On-Demand · ~6 tuần + level-ups · Định hướng portfolio/CV*
