# Biliverse 定制设置入口

本站只维护声明式设置主页、可选项目主题和图片素材。入口探测、状态显示、模块页面、导航与持久化读写均由业务插件安装的 PreferencePanes latest API 负责。

主页 HTML 只以 data 属性声明模块、配置、页面和 CSS 地址。业务插件安装的 PreferencePanes latest API 返回 host.mjs，由它并发 HEAD /configs/{module}、显示版本、加载 /settings/{module} 并调用官方 JSBridge；github.io 不托管运行脚本或模块页面。

## 安装与升级

业务模块本身包含两类规则：

- 配置 Mock：从同版业务仓库的 Gist/Release 取得 BoxJS JSON，非原生 Mock 平台使用同版纯配置响应脚本。
- 通用 API：引用 https://github.com/NSNanoCat/PreferencePanes/releases/latest/download/api.js，提供设置文档、渲染资源及无鉴权 form 存储 API。

移除旧的独立 PreferencePanes 模块，安装更新后的业务模块即可。Enhanced、Global、Redirect、ADBlock 的接入模板均包含配置 Mock 和通用 API。PreferencePanes 0.8.0 将存储请求改为 POST /api/get、set、delete；发布顺序为 API Release → 业务模块模板 → 本站清理。

网站不持有模块字段或默认值。前端从 BoxJS 完整 ID 生成 form 字段名 @root.path，API 使用 util 读写，不重复下载 BoxJS，也不做鉴权或枚举校验。业务脚本选择 PersistentStore 后使用这些设置。

## 本地验证

```sh
pnpm settings:build
pnpm settings:check
pnpm settings:test
pnpm settings:preview
```

预览读取同级业务仓库 dist/config.dev.bundle.js，以及 NSNanoCat/PreferencePanes/dist/api.js，以独立内存模拟代理。先构建这两个仓库。预览不会复制 API 或配置到网站目录。

网站构建只复制主页 HTML、theme.css 和图标素材。原始图标保持不变，处理记录见 icons-manifest.json；官方样式参考见 customer-service-research.md 与 provenance.json。
