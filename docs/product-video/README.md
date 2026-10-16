# Local AI Workbench · 60 秒产品宣传片

成片：`Local_AI_Workbench_60s.mp4`。1920×1080、30 fps、60 秒，H.264 / AAC，中文合成旁白与烧录中文字幕。可选外挂字幕为 `Local_AI_Workbench_zh.srt`。

## 一条命令重建

在本目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\rebuild.ps1
```

需要 Python 3.12+、FFmpeg / FFprobe 在 PATH 中。脚本在工程自己的 `.build/venv` 安装 Pillow 与 NumPy，不修改工作台环境。首次安装依赖需要联网；素材完整后渲染本身离线执行。也可直接在已有依赖的 Python 环境运行 `python source/render.py`。

中文字体默认使用 Windows 微软雅黑，字体文件不随工程分发。其他系统安装 Noto Sans CJK，并通过 `VIDEO_FONT`、`VIDEO_FONT_BOLD` 指定字体路径。跨字体重建的字形会不同。渲染使用保留的旁白，不需要再次调用在线语音服务。

## 文件结构

- `source/render.py`：动态图形、逐帧合成、原创音乐、混音、字幕、编码与自动验收。
- `source/capture.cjs`：真实 Electron 操作与连续界面采集；只操作独立安装副本。
- `source/voice.py`、`source/narration.json`：中文旁白脚本及可选语音再生成。
- `assets/`：Logo、界面截图、68 帧实录、7 段旁白、虚构家庭样本、工作流快照、原创背景音乐。
- `evidence/`：实际执行结果、录制时序、音频时序、成片验证、响度及分镜联系表。
- `ASSETS.md`、`assets_manifest.json`：素材来源、使用边界与逐文件 SHA-256。
- `poster.jpg`：项目展示封面。

源码仓库只保存制作代码、文档、轻量预览及验收数据。完整 `assets/` 和成片通过未发布草稿 Release 附件交付，不进入普通源码提交。使用源码仓库重建时，先将工程素材包解压到本目录，使 `assets/`、`source/`、`evidence/` 同级。

## 分镜与事实边界

| 时间 | 画面 | 素材性质 |
| --- | --- | --- |
| 0–10 秒 | 产品名称、Logo、整体工作台 | 真实界面截图与宣传动画 |
| 10–16 秒 | 读取文件 → 提取信息 → 年份整理 → 时间线 | 显著标记为场景目标与概念动画，非真实运行结果 |
| 16–26 秒 | 端口逐一连接、保存与校验 | 实际 UI 连线录制，按剪辑节奏调整播放时间 |
| 26–31 秒 | 五节点执行、输入输出与结果摘录 | 真正执行虚构样本，结果由后端记录核验 |
| 31–35 秒 | AI 分析与应用权限状态 | 真实设置界面；未授权、未调用模型 |
| 35–43.5 秒 | 工具、资源、规范、权限、任务之间的关系 | 基于代码的架构示意，结合真实规范中心截图 |
| 43.5–50 秒 | 工具管理与本地/云端边界 | 真实界面，不承诺所有数据永不离开本机 |
| 50–60 秒 | 产品全景、名称、结束语 | 真实界面与品牌字幕 |

实际运行使用 `json → filter → select → template → output`：从三个虚构条目中筛选 1988 年，提取事件字段，生成“1988 年｜第一张全家福”。它验证数据传递和执行留痕，不宣称自动 OCR、全量文件提取或智能历史事实核实已完成。所有样本均为人为构造，不含真实家庭资料。

## 验收与限制

渲染器自动检查尺寸、帧率、1800 帧总数、60 秒时长、编码格式、音视频时长差、旁白时间槽以及全片解码完整性。字幕使用同一旁白时序表，与合成音频同步；它是按整句显示的字幕，不是逐字卡拉 OK。

人工视觉检查包括八个关键分镜和编码后抽帧。仅录制与测试了 Windows，未测试 macOS / Linux 的应用录制。真实模型调用数为零，外部语音合成只收到本片公开产品介绍文案。

## 可选：重新录制或生成配音

重新录制需要把干净的前后端发布源码放到 `.build/backend`、`.build/frontend`，初始化该后端并安装依赖；指定 `VIDEO_NODE_MODULES` 指向包含 Electron 与 Playwright 的目录，`WORKBENCH_PYTHON` 指向独立后端使用的 Python。然后运行 `node source/capture.cjs` 和 `node source/capture.cjs --permissions`。录制脚本不会连接个人工作台。

配音再生成需要 `edge-tts` 和网络：`python source/voice.py`。默认使用 `zh-CN-XiaoxiaoNeural`；可通过 `VIDEO_TTS_PROXY` 指定代理。脚本不会把工作台数据发送给语音服务。

本工程随项目采用 Apache-2.0 许可证；第三方语音、字体及用户 Logo 的权利和服务条款分别适用，详见素材清单。
