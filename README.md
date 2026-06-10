# 今天吃什么

一个纯静态的随机选餐网页。项目使用 Python 自带的 HTTP Server 提供局域网访问，
不依赖 Flask、Node.js 或数据库。

## 功能

- 按菜系、正餐/轻食/甜品、预算和辣度筛选
- 短动画随机抽取，可再次点击立即揭晓
- 暂时跳过不想吃的菜品，并支持撤销和本地持久化
- 结果可直接搜索附近餐厅或外卖
- 支持安装到 iOS/Android 主屏幕，并可离线使用
- 支持键盘操作、屏幕阅读器状态播报和减少动态效果
- 针对桌面、手机和 320px 窄屏布局优化

## 环境要求

- Ubuntu 或其他常见 Linux 发行版
- Bash
- Python 3

在 Ubuntu 上可通过以下命令确认 Python 3 已安装：

```bash
python3 --version
```

## 启动服务

在项目根目录执行：

```bash
./run.sh start
```

服务默认监听 `0.0.0.0:8080`，并在后台运行。首次执行会自动创建：

- `logs/app.log`：服务日志
- `run/app.pid`：后台进程 PID
- `run/app.port`：服务实际使用的端口

脚本会在服务已经运行时阻止重复启动。

## 关闭服务

```bash
./run.sh stop
```

脚本会读取 `run/app.pid` 并停止对应服务。服务未运行时会显示提示，不会报错退出。

## 重启服务

```bash
./run.sh restart
```

该命令会先停止现有服务，再重新启动。

## 查看状态

```bash
./run.sh status
```

服务运行时会显示运行状态、PID、监听端口、日志位置和局域网访问地址，例如：

```text
服务状态: 运行中
PID: 12345
监听端口: 8080
访问地址: http://192.168.1.100:8080
日志文件: /path/to/choose_what_to_eat/logs/app.log
```

## 手机访问

1. 确保 Ubuntu 服务器和手机连接到同一个家庭局域网。
2. 执行 `./run.sh start` 或 `./run.sh status` 获取访问地址。
3. 在手机浏览器中打开显示的地址，例如 `http://192.168.1.100:8080`。

如果手机无法访问，请检查 Ubuntu 防火墙是否允许 TCP 端口 `8080`：

```bash
sudo ufw allow 8080/tcp
```

仅在启用了 UFW 且确实需要开放该端口时执行此命令。

## 安装为 PWA

PWA 安装和 Service Worker 需要安全上下文：

- 本机开发可使用 `http://localhost:8080`
- 手机或正式部署应使用 HTTPS
- 直接通过局域网 IP 打开的普通 HTTP 页面可以浏览，但浏览器通常不会允许安装和离线缓存

Android Chrome：打开站点后，从浏览器菜单选择“添加到主屏幕”或“安装应用”。

iOS Safari：打开站点后，点击“分享”，再选择“添加到主屏幕”。iOS 会以独立应用模式启动。

首次在线打开页面后，核心页面、样式、脚本、菜单数据和图标会被缓存，之后可离线访问。

## 可选配置

默认端口为 `8080`。可以通过环境变量临时指定其他监听地址或端口：

```bash
HOST=0.0.0.0 PORT=9000 ./run.sh start
```

`status` 会从运行信息中读取实际端口。执行 `restart` 时如未再次指定 `PORT`，
服务会恢复使用默认端口 `8080`。

## 项目结构

```text
.
├── css/
│   └── style.css
├── data/
│   └── foods.json
├── js/
│   ├── app.js
│   └── food-rules.js
├── icons/
│   ├── apple-touch-icon.png
│   ├── icon-192.png
│   ├── icon-512.png
│   └── app-icon-source.png
├── tests/
│   └── food-rules.test.js
├── logs/              # 首次运行时创建
│   └── app.log
├── run/               # 首次运行时创建
│   ├── app.pid
│   └── app.port
├── .gitignore
├── index.html
├── manifest.json
├── README.md
├── service-worker.js
└── run.sh
```

`logs/` 和 `run/` 是运行时目录，不需要手动创建，也不应提交其中的日志和 PID 文件。

## 运行测试

测试使用 Node.js 内置测试运行器，不需要安装依赖：

```bash
node --test tests/food-rules.test.js
```

测试覆盖菜单字段和重复 ID 校验、筛选属性推导、组合筛选以及菜品排除。

## 数据维护

`data/foods.json` 是唯一菜单数据源。页面分类会根据该文件动态生成；每道菜需要包含：

```text
id, name, category, cuisine, tags, reason, image, emoji
```

用餐类型、预算档位和辣度由 `js/food-rules.js` 根据菜名、菜系和标签推导。
