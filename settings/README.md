# Biliverse 定制设置入口

本站只维护设置主页、入口可用性判断、常驻顶栏、主题和图片。公共 Navigation/ModuleFrame 是主页使用的静态导航组件；不再复制模块 HTML、app.mjs、配置或读写脚本，也不提供独立设置插件。

主页仅并发 HEAD /configs/{module}，返回 200 才启用入口。点击后由 ModuleFrame 请求 /settings/{module}，通过 Header 提供该模块 JSON 和本站 theme.css 地址。模块文档与渲染脚本由业务插件安装的 PreferencePanes latest API 响应，不由 github.io 托管。常驻顶栏根据容器事件更新状态；页面内容由共用导航滑动切换。

## 安装与升级

业务模块本身包含两类规则：

- 配置 Mock：从同版业务仓库的 Gist/Release 取得 BoxJS JSON，非原生 Mock 平台使用同版纯配置响应脚本。
- 通用 API：引用 https://github.com/NSNanoCat/PreferencePanes/releases/latest/download/api.js，提供设置文档、渲染资源及无鉴权 form 存储 API。

移除旧的独立 PreferencePanes 模块，安装更新后的业务模块即可。发布顺序为 PreferencePanes API Release → 业务模块模板 → 本站清理。当前开发版将存储请求改为 POST /api/get、set、delete；必须先发布新 API，不能将未发布的 latest 地址当作可用资源。

网站不持有模块字段或默认值。前端从 BoxJS 完整 ID 生成 form 字段名 @root.path，API 使用 util 读写，不重复下载 BoxJS，也不做鉴权或枚举校验。业务脚本选择 PersistentStore 后使用这些设置。

## 本地验证

```sh
pnpm settings:build
pnpm settings:check
pnpm settings:test
pnpm settings:preview
```

预览读取同级业务仓库 dist/config.dev.bundle.js，以及 NSNanoCat/PreferencePanes/dist/api.js，以独立内存模拟代理。先构建这两个仓库。预览不会复制 API 或配置到网站目录。

网站构建只复制主页文件、theme.css 和公共导航组件。原始图标保持不变，处理记录见 icons-manifest.json；官方样式参考见 customer-service-research.md 与 provenance.json。
