# 百工 · Local AI Workbench 前端

保留基础管理框架、默认仅加载 **AI 聊天** 的桌面工作台。无个人会话、业务数据库、已加载外部资源、模型权重或密钥。AI 获客经营中心不在此发布中。

本仓库为私有仓库，下载者须先获得仓库访问权限。前端需要配套后端，不是可独立调用模型的网页。

## 下载与安装

后端使用 [baigong 的 workbench-backend 分支](https://github.com/David7583/baigong/tree/workbench-backend)，不是数据流水线的 main 分支。前端使用本仓库 main 分支。建议用 Git 克隆；也可在各仓库使用 Code → Download ZIP，并将解压目录改为下面的名称。

已验证范围为 Windows x64，Python 3.12、Node.js 24、Git。其他系统尚未完成桌面验证。安装依赖需要联网，模型调用需要用户自己的服务和许可。

```powershell
git clone --branch workbench-backend --single-branch https://github.com/David7583/baigong.git baigong
git clone https://github.com/David7583/baigong-workbench-frontend.git baigong-workbench-frontend
cd baigong
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
& .\.venv\Scripts\python.exe setup_workbench_v0001.py
cd ..\baigong-workbench-frontend
npm ci
npm start
```

两个目录并列放置即可；路径按脚本位置解析，不要求固定盘符。目录名或位置不同，可在启动前设置：

```powershell
$env:WORKBENCH_BACKEND_ROOT = (Resolve-Path '..\我的后端目录').Path
npm start
```

`WORKBENCH_PYTHON` 可显式指定后端的 Python 解释器。后台聊天在 Windows 优先使用同环境的 `pythonw.exe`，不经 PowerShell 启动；标准输出与错误保存在后端启动日志中。

Electron 的首次启动可能下载其二进制。如网络不允许访问 GitHub Releases，请配置你自己的代理后运行 `npx install-electron --no`。不要关闭 TLS 校验。本次依赖包通过 `npm ci` 安装；桌面验收使用已有的同版本 Electron 44.4.5 二进制，未把本机下载网络问题表述为新电脑安装已完全验证。

## 首次聊天

1. 首页点击“独立 AI 对话”。没有密钥也能打开界面、管理会话和查看设置。
2. 在后端配置自己的模型服务。默认示例为 OpenAI 的 `gpt-4.1-mini`；模型是否可用以你的账户及服务返回为准，可修改后端的模型目录和聊天配置。
3. 在启动工作台的环境中设置 `OPENAI_API_KEY`，不要把密钥写入 Git。聊天页面“模型与连接”中的总许可、应用许可需要由你显式开启；初始状态均关闭。
4. 发送消息。未配置服务或未授权时显示真实错误，不生成演示回答。历史会话与运行状态保存在后端本机目录，后续启动保留。

其他栏目是基础管理入口，初始没有加载业务资源。扫描、选择、加载和解除加载由用户操作；解除加载不会删除原始文件。部分专业资源需要另行安装依赖，本包不宣称附带所有插件、软件、数据库或向量检索环境。

## 界面

以下为隔离空环境的真实截图，没有个人数据或模拟成交/模型结果。

![空工作台，仅聊天已加载](docs/images/01-empty-workbench.png)

![聊天工作区](docs/images/02-chat.png)

![模型与连接配置](docs/images/03-model-settings.png)

## 结构与验证

- `desktop/`：Electron 沙箱窗口和受限桌面桥。
- `workspace/`、`visualization/`：工作台视图及公共图结构契约。
- `chat/`：现有聊天界面；API、模型调用和数据存储在后端。
- `tests/`：隔离桌面回归。必须指向测试后端运行副本，不能指向个人工作台。

```powershell
$env:WORKBENCH_BACKEND_ROOT = (Resolve-Path '..\测试后端').Path
npm test
```

发布记录和限制见 [验收说明](docs/RELEASE_VALIDATION.md)。本项目沿用百工 Apache-2.0 许可；第三方静态资源保留自身许可证，npm 依赖不随源码捆绑。
