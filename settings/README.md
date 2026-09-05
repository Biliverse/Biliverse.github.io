# Biliverse 本地设置

页面入口位于“我的”页面的官方“设置”项之后。Enhanced 负责插入入口和根页面；点击模块后进入对应插件自己的分支页面。每个插件负责自己的配置 GET/POST 和页面资源，使用既有的 `getStorage` 读取本地配置。

## 资源与请求

| URL | 处理模块 |
| --- | --- |
| `https://app.bilibili.com/biliverse/settings/` | Enhanced：内嵌的 HTML、CSS、JS、项目图片 |
| `/biliverse/settings/api/Enhanced` | Enhanced 设置处理器 |
| `/biliverse/settings/api/Global` | Global 设置处理器 |
| `/biliverse/settings/api/Redirect` | Redirect 设置处理器 |
| `/biliverse/settings/api/ADBlock` | ADBlock 设置处理器 |

这些地址由各自插件的本机代理脚本返回。它们不是哔哩哔哩官方接口，也不需要在该域名部署服务。对应功能模块需要安装，页面才能读取和保存该模块的设置。HTTPS 需对 `app.bilibili.com` 启用 MITM。

手机使用 `sections_v2[].items[]`，iPad 使用 `ipad_*_sections`。只有上游或 Enhanced 过滤后的页面仍存在官方 `bilibili://user_center/setting` 项时才插入，不猜测其它页面位置。重复处理不会重复添加。Enhanced 的 Mine 自定义开关关闭时仍可插入入口。入口图标使用现有 Biliverse GitHub 组织头像地址，HTML 内的 logo 来自 Universe `database/icon.png`，四个产品图标来自各自 `src/assets/icon_rounded_108x.png`。

## 配置语义

页面设置定义从各项目 `arguments-builder.full.config.ts` 的 `argsFull` 生成，包含全部已声明选项：Enhanced 12、Global 8、Redirect 6、ADBlock 31。ADBlock 额外显示一个“配置类型”，用于切回模块参数；该项是本地页面的存储控制，不冒充其原有 argument 项。

GET 返回当前脚本的实际有效配置。保存以 `BiliBili.<模块>.Settings` 为路径，保持 BoxJS 存储兼容，并保留未显示的设置、其它模块及 Caches。正常保存会先保留当前有效配置，再将本次修改写入，并切换到 `PersistentStore`。各模块 `setENV` 优先读取该 profile 的本地 `Storage` 选择；未保存过本地选择时维持原有 argument 行为。

“配置类型”提供三个选择：

- 本地设置：使用页面/BoxJS 配置。
- 模块参数：恢复 argument 优先，本地仍保存数据以便切换回来。
- 默认配置：使用插件作者的 database 默认设置。

更改在下一次插件请求时生效；已经缓存到哔哩哔哩 App 的导航或页面仍需刷新/重新进入。网页不会改变代理软件的模块启用开关，不会安装尚不存在的模块。Redirect 模块内的静态 URL Rewrite 规则由安装参数生成，不会因网页保存而即时重编译；其脚本处理范围以现有 Request 逻辑为准。云端 Workers/纯 Rewrite 版本不能使用本机持久化设置，此页面仅针对本地脚本版本。

## 样式来源

`bilibili-form.css` 直接选取国际版 `com.bilibili.inter` 6.4.0（91000200）包内 AppSettings H5 1.1.2 的 `form-group`、`form-row`、`v-toggle` 样式，去掉 Vue 编译产生的 scope 属性。来源文件名与 SHA-256 见 `provenance.json`。保留官方组件的类名和结构，表单渲染及保存代码由本项目实现。没有复制官方业务 JS，也不依赖第三方域名的 JSBridge 权限。

HTML、图片、主题变量及样式都已内嵌，不需要在线加载官方 CDN；根据 App UA 的 `themeId` 或系统深色偏好选择主题。Hilo 公开 CDN 的访问不稳定，因此没有把它作为页面运行依赖。这里的样式来源记录不等同于确认官方发布了对外开放的 SDK 或授权条款。

## 开发与发布

仓库布局必须为同级的 `Biliverse.github.io`、`Enhanced`、`Global`、`Redirect`、`ADBlock`，并安装四个模块已有依赖。生成器直接导入 TypeScript argument 定义，需要支持类型剥离的 Node.js（本次使用 24.19）。

```sh
node scripts/build-settings.mjs
node scripts/build-settings.mjs --check
node --test settings/settings.test.mjs
node scripts/preview-settings.mjs
```

生成器同时更新 `docs/public/settings/index.html` 和四个模块的 `src/function/settings.mjs`，不要手改这些生成文件。新增或修改 argument 时重新运行生成器。各模块继续使用原有 Rollup 和 arguments-builder 命令构建正式版/开发版脚本、Surge/Loon/Stash 等模板。纯 Rewrite 模板保持原行为。

预览地址为 `http://127.0.0.1:8791/biliverse/settings/`，使用独立内存存储，通过实际四个 Request 处理器响应，不读取用户代理配置。预览内存数据在服务退出后消失。静态 Pages 地址只提供页面资源；本地 Mock 才提供读写能力。

发布时需要同时发布更新后的模块脚本和模块规则。只上传 Pages HTML 不会让已安装的旧模块自动支持本地接口。当前没有修改用户的现用 Surge 配置，也没有发布远端版本。

## 验证

`settings.test.mjs` 覆盖手机/iPad 入口顺序与去重、关闭 Mine 自定义时入口保留、所有模块的参数读取/本地保存/切回参数、空数组保存后真实 Tab 消费、未知字段/非法值/重复值/跨域访问、存储写入失败、其它模块与 Caches 保留，以及无外链 HTML。浏览器预览使用同一处理器，验证响应式布局、开关和表单保存。
