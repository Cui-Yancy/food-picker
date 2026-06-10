# 今天吃什么

一个支持家庭局域网共享的随机选餐网页。项目使用 Python 标准库同时提供静态页面和
JSON REST API，不依赖 Flask、Node.js、数据库或其他第三方运行时依赖。

## 功能

- 按菜系、正餐/轻食/甜品、预算和辣度筛选
- 家庭成员通过局域网共享自定义餐厅和菜品
- 支持新增、编辑、删除和手动同步共享美食
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

服务由 `server.py` 提供，同时处理页面资源和 `/api/` 请求。请勿再使用
`python3 -m http.server` 启动，否则家庭共享功能无法写入数据。

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

首次在线打开页面后，核心页面、样式、脚本、最近一次合并菜单和图标会被缓存，
之后可使用最近一次成功同步的菜单离线抽取。

静态页面可以离线打开，但家庭共享库必须连接到 Ubuntu 家庭服务器才能同步和修改。
合并菜单 API 使用网络优先策略：在线时总是获取服务器最新数据，离线时才回退到缓存。
新增、编辑和删除 API 始终只走网络。

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
│   ├── custom_items.json
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
│   ├── food-rules.test.js
│   └── test_server_api.py
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
├── server.py
└── run.sh
```

`logs/` 和 `run/` 是运行时目录，不需要手动创建，也不应提交其中的日志和 PID 文件。

## 运行测试

前端规则测试使用 Node.js 内置测试运行器：

```bash
node --test tests/food-rules.test.js
```

服务端 API 测试使用 Python 标准库：

```bash
python3 -m unittest tests/test_server_api.py -v
```

测试覆盖菜单字段和重复 ID 校验、显式筛选属性、组合筛选、共享记录增删改、
revision 冲突、输入校验和 JSON 持久化。

## 数据维护

`data/foods.json` 是只读预设菜单，仍可按原方式人工维护。页面分类会根据预设菜单和
家庭共享菜单动态生成；每道预设菜需要包含：

```text
id, name, category, cuisine, tags, reason, image, emoji
```

用餐类型、预算档位和辣度由 `js/food-rules.js` 根据菜名、菜系和标签推导。

`data/custom_items.json` 是家庭共享可写数据。请优先通过页面中的“家庭美食库”管理，
不要在服务运行期间手工编辑。服务端每次修改都会：

- 在进程锁内读取最新 revision
- 将旧文件备份为 `data/custom_items.json.bak`
- 写入同目录临时文件并同步到磁盘
- 使用原子替换更新正式文件

共享数据最多 1000 条。编辑和删除会检查 revision；如果另一台设备已经修改数据，
当前操作会提示刷新后重试，避免静默覆盖。

## 备份与恢复

建议定期备份 `data/custom_items.json`。恢复时：

```bash
./run.sh stop
cp /path/to/backup/custom_items.json data/custom_items.json
./run.sh start
```

如果最近一次写入后的文件异常，可在停止服务后检查
`data/custom_items.json.bak`，确认内容完整后再替换正式文件。

## API

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务健康检查 |
| `GET` | `/api/foods` | 获取预设与共享合并菜单 |
| `GET` | `/api/custom-items` | 获取共享库及 revision |
| `POST` | `/api/custom-items` | 新增共享美食 |
| `PUT` | `/api/custom-items/{id}` | 修改共享美食 |
| `DELETE` | `/api/custom-items/{id}` | 删除共享美食 |

修改和删除必须通过 `If-Match` 请求头携带当前 revision。项目不提供用户登录或权限
管理，因此应只在可信家庭局域网内开放端口，不要直接映射到公网。
