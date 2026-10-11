
# ☁️ NT533.R12.1 - LAB 02: OPENSTACK API

## 📌 Thông tin bài Lab

- **Môn học:** Hệ tính toán phân bố
- **Lớp:** NT533.R12.1
- **Bài thực hành:** Lab 02 - OpenStack API
- **Nhóm:** 10

## 👥 Thành viên và phân công công việc

| STT | Họ và tên | MSSV | Câu phụ trách |
|-----|-----------|------|---------------|
| 1 | Nguyễn Nhật Long Hưng | 24520611 | Câu 8 |
| 2 | Nguyễn Nhật Thanh | 24521633 | Câu 7 |
| 3 | Trần Phú Thành | 24521641 | Câu 1, 2, 3, 5 |
| 4 | Võ Diệp Thành | 24521644 | Câu 4, 6 |

### 🛠️ Phân chia nhiệm vụ

| Thành viên | Công việc thực hiện |
|------------|---------------------|
| **Trần Phú Thành** | Xác thực Token, quản lý Flavor, Image, Network, Subnet, Router, Security Group và cấu hình mạng. Xây dựng giao diện React cho các chức năng tương ứng. |
| **Võ Diệp Thành** | Quản lý Instance, tạo VM, cấu hình Floating IP, Web Server, User Data và giao diện quản lý VM. |
| **Nguyễn Nhật Thanh** | Triển khai Load Balancer, Listener, Pool, Health Monitor, Member và giao diện quản lý Load Balancer. |
| **Nguyễn Nhật Long Hưng** | Xây dựng chức năng Scale Up/Down VM, cập nhật Load Balancer, thống kê VM và tích hợp giao diện. |

## 📖 Giới thiệu

Lab 02 tập trung vào việc sử dụng **OpenStack REST API** để quản lý tài nguyên điện toán đám mây.

Nhóm xây dựng ứng dụng **OpenStack Manager** bằng React, kết hợp Axios để giao tiếp với OpenStack API và Postman để kiểm thử các chức năng.

### Nội dung bài Lab

| Câu | Nội dung |
|-----|----------|
| 1 | Xác thực Token, liệt kê Flavor và Image |
| 2 | Liệt kê, tạo, xóa Network và Subnet |
| 3 | Liệt kê, tạo, xóa Router |
| 4 | Quản lý và tạo Instance |
| 5 | Cấu hình Network, Subnet, Router và Security Group |
| 6 | Triển khai VM, Floating IP, Web Server và User Data |
| 7 | Triển khai Load Balancer và các thành phần liên quan |
| 8 | Scale Up/Down VM và tự động cập nhật Load Balancer |

## 💻 Công nghệ sử dụng

- **Frontend:** React, Vite, JavaScript
- **API:** OpenStack REST API, Axios
- **API Testing:** Postman
- **Version Control:** Git, GitHub

## 🚀 Hướng dẫn chạy ứng dụng

**1. Clone Repository**

```bash
git clone <REPOSITORY_URL>
```

**2. Truy cập thư mục project**

```bash
cd openstack-manager
```

**3. Cài đặt thư viện**

```bash
npm install
```

**4. Chạy ứng dụng**

```bash
npm run dev
```

Truy cập địa chỉ: http://localhost:5173/

> **Lưu ý:** Cần cài đặt Node.js và có tài khoản OpenStack hợp lệ với quyền truy cập Project tương ứng.

## 📂 Cấu trúc dự án

```text
openstack-manager/
├── src/
│   ├── components/
│   │   ├── AuthTab.jsx
│   │   ├── NetworkTab.jsx
│   │   ├── RouterTab.jsx
│   │   └── NetworkConfigTab.jsx
│   ├── services/
│   │   └── openstackClient.js
│   └── App.jsx
├── package.json
└── vite.config.js
```

*Cấu trúc sẽ tiếp tục được mở rộng khi các thành viên tích hợp chức năng.*

## 🔒 Lưu ý

- Không đưa mật khẩu, Token hoặc SSH Private Key lên GitHub.
- Kiểm tra tài nguyên trước khi thực hiện thao tác xóa.
