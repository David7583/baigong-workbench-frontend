# GitHub 协作设置检查与建议

检查日期：2026-10-16。仓库：`David7583/baigong-workbench-frontend`。

当前状态：公开仓库；Issues 已开启；Discussions 关闭；main 分支保护接口返回 404，仓库 rulesets 为空；GitHub Actions 工作流数量为 0。

以下仅为建议，本次未修改仓库协作设置：

1. 为 main 配置 Branch Protection 或 Ruleset：通过 PR 合并、至少一名审核者批准、阻止强推与删除、要求解决对话。只有 CI 已实际部署且成功运行后再设置必需状态检查，避免不存在的检查阻塞所有合并。维护者独自维护时应明确审核与例外处理方式。
2. 保留 Issues，并补充缺陷报告与需求模板，要求复现步骤、运行环境、脱敏日志；明确不得提交密钥与个人数据。
3. 可开启 Discussions，将安装问答、使用分享和路线讨论与缺陷单分开。
4. 建议先引入低权限 Actions：`permissions: contents: read`，使用 `pull_request` 事件，执行依赖锁定安装、静态检查和隔离测试。不要对不可信 PR 使用带密钥的 `pull_request_target`。Electron 集成测试可单独在 Windows runner 上执行。
5. 给媒体工程配置源码检查与素材清单核验；完整视频渲染作为可手动触发任务，产物进入短期 Actions artifacts 或经批准的 Release 资产，避免提交大文件。

本次使用独立分支和 Draft PR。视频与完整工程包放在未发布的草稿 Release，供维护者预览；草稿资产通常只有有权限的维护者可访问，不能当作已公开发布的正式版本。未经用户批准不合并 main、不发布正式 Release。
