# Biliverse 本地设置

页面入口名为 `Biliverse`，位于“我的”页面“推荐服务”首位，目标地址为 `https://biliverse.github.io/settings/`。Enhanced 负责插入入口，根页面来自 GitHub Pages；每次进入主页面（包括浏览器后退恢复）并发 HEAD 探测四个模块，探测期间入口禁用，成功后才可点击。正常点击在同一 HTML 文档内切换到模块页，各模块仍只处理自己的设置 GET/POST/HEAD。

### 页面导航

根菜单、模块页、选项页使用 History API 和 hash 路由，不通过 `location.assign` 跳转整页。进入时内容从右侧滑入、旧页向左滑出；返回反向播放，浏览器前进/后退使用同一历史栈。页面 DOM、未保存的输入和滚动位置在当前会话内保留；返回根菜单仅刷新 HEAD 可用性检测，不重新下载 HTML/CSS。保存成功后失效该模块的缓存页面，下次展示使用保存后的设置。开启系统“减少动态效果”时关闭滑动动画。

`/settings/<Module>/` 原生 Mock 直达地址继续兼容，但返回根菜单也在当前文档内完成；各静态页面带相同导航壳，URL 用于确定初始页面。常规主入口导航不再触发分支 HTML 请求。

## 资源与请求

| URL | 处理模块 |
| --- | --- |
| `https://biliverse.github.io/settings/` | GitHub Pages：根 HTML、CSS、JS、项目图片 |
| `/settings/<Module>/` | 模块分支页；Surge/Loon/Egern 原生静态 Mock，其余直接访问 Pages |
| `/settings/assets/<Module>.html` | 原生 Mock 的远程资源源，不匹配任何 Mock/API 规则 |
| `/settings/logo.png` | Pages 静态图片，供 App 中的入口使用 |
| `/settings/api/Enhanced` | Enhanced 设置处理器 |
| `/settings/api/Global` | Global 设置处理器 |
| `/settings/api/Redirect` | Redirect 设置处理器 |
| `/settings/api/ADBlock` | ADBlock 设置处理器 |

设置 API 由各自插件的本机代理脚本返回，全部位于 `biliverse.github.io` 命名空间。页面用同源请求访问 `/settings/api/<Module>`，插件关闭或失效时探测失败并禁用对应入口；根页面仍可打开。自定义设置请求不占用官方域名，需对 `biliverse.github.io` 启用 MITM；插件原有业务的 MITM 主机保持不变。

### 静态 Mock

Surge 示例（位于各模块自己的模板中）：

```ini
[Map Local]
^https://biliverse\.github\.io/settings/Enhanced/(?:\?.*)?$ data-type=file data="https://biliverse.github.io/settings/assets/Enhanced.html" status-code=200 header="Content-Type:text/html; charset=utf-8"
```

Loon 沿用仓库的旧版 Rewrite 语法，在 `[Rewrite]` 中用 `mock-response-body data-type=html data-path=<资源 URL>`。Egern 通过仓库已有 Surge 转换器生成 `map_locals`。匹配地址与下载源地址分离，避免资源下载命中自身规则。根页面、logo、其它模块页面和 API 都不匹配这条静态规则。

Stash 官方当前 Mock 文档只提供 text/base64，Quantumult X 的官方静态 echo 示例仅说明本地文件，Shadowrocket 的远程文件 Mock 在本次未确认；这些模板不增加未经确认的资源参数，而由 Pages 的 `/settings/<Module>/index.html` 直接提供相同页面。所有平台的静态 HTML 均不再通过 JS 请求处理器生成。HTML 内嵌页面 JS、图标和本地适配 CSS，官方客服基础 CSS 由浏览器额外加载。

依据：[Surge Map Local](https://manual.nssurge.com/http/map-local.html)、[Loon Rewrite](https://nsloon.app/en/docs/Rewrite/)、[Stash Mock](https://stash.wiki/http-engine/rewrite#mock)、[Quantumult X 官方示例](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf)。

手机使用 `sections_v2` 中标题为“推荐服务”的分组，缺失时在“更多服务”前创建；iPad 使用 `ipad_recommend_sections`。插入前清理旧分组中的同 URI 入口，重复处理不会重复添加。原快捷区四项不变，Enhanced 的 Mine 自定义开关关闭时仍可插入入口。入口图标使用 `https://biliverse.github.io/settings/logo_settings_light.png`，为透明底新版；原有 `logo.png` 保留不变。

### 设置图标

主图标新增 `settings/logo_settings_light.png`、`logo_settings_dark.png`，四个产品在各自 `src/assets/` 新增 `icon_settings_light.png`、`icon_settings_dark.png`。来源分别是原始 `settings/logo.png` 和各项目透明版 `icon.png`，不再使用带白底的 rounded 图标。按非零 Alpha 的最小边界裁切，居中补齐正方形后等比缩放为 256×256；非正方形图案保留必要留白，不拉伸、不切掉内容。

亮色版保持原图颜色，暗色版 RGB 向白色提亮 12%，两版 Alpha 完全一致。页面用 `picture` 选择资源：App UA 的 `themeId` 优先，否则跟随 `prefers-color-scheme` 并响应系统切换。原生“我的”入口只有已确认的单一 `icon` 字段，使用两种背景均可辨识的透明亮色版，不虚构夜间图片字段。

使用 Python 3 + Pillow 运行 `python3 scripts/prepare-settings-icons.py` 可重复生成新增文件，`python3 settings/icons.test.py` 验证 Alpha、居中、尺寸及原图 SHA-256；来源记录见 `icons-manifest.json`。原图及旧发布文件不覆盖。生成后运行下面的页面构建命令更新 HTML 内嵌资源。

## 配置语义

页面设置定义从各项目 `arguments-builder.full.config.ts` 的 `argsFull` 生成，包含全部已声明选项：Enhanced 12、Global 8、Redirect 6、ADBlock 31。ADBlock 额外显示一个“配置类型”，用于切回模块参数；该项是本地页面的存储控制，不冒充其原有 argument 项。

GET 返回当前脚本的实际有效配置。保存以 `BiliBili.<模块>.Settings` 为路径，保持 BoxJS 存储兼容，并保留未显示的设置、其它模块及 Caches。正常保存会先保留当前有效配置，再将本次修改写入，并切换到 `PersistentStore`。各模块 `setENV` 优先读取该 profile 的本地 `Storage` 选择；未保存过本地选择时维持原有 argument 行为。

“配置类型”提供三个选择：

- 本地设置：使用页面/BoxJS 配置。
- 模块参数：恢复 argument 优先，本地仍保存数据以便切换回来。
- 默认配置：使用插件作者的 database 默认设置。

更改在下一次插件请求时生效；已经缓存到哔哩哔哩 App 的导航或页面仍需刷新/重新进入。网页不会改变代理软件的模块启用开关，不会安装尚不存在的模块。Redirect 模块内的静态 URL Rewrite 规则由安装参数生成，不会因网页保存而即时重编译；其脚本处理范围以现有 Request 逻辑为准。云端 Workers/纯 Rewrite 版本不能使用本机持久化设置，此页面仅针对本地脚本版本。

## 样式来源

页面通过 `index.html` 的 stylesheet 链接直接加载官方移动端客服中心 CSS，四个圆形模块入口使用其中 `self-panel` / `self-item` 的布局规则。`bilibili-self-service.css` 仅保留固定尺寸、主题颜色和状态适配，不再复制基础 flex 布局。客服中心的页面访问、源码证据和适配范围见 [独立调研记录](customer-service-research.md)。不引入官方客服 JSBridge 和埋点；二级设置表单保持原样。

`bilibili-form.css` 直接选取国际版 `com.bilibili.inter` 6.4.0（91000200）包内 AppSettings H5 1.1.2 的 `form-group`、`form-row`、`v-toggle` 样式，去掉 Vue 编译产生的 scope 属性。来源文件名与 SHA-256 见 `provenance.json`。保留官方组件的类名和结构，表单渲染及保存代码由本项目实现。没有复制官方业务 JS，也不依赖第三方域名的 JSBridge 权限。

HTML 内嵌图片、主题变量和本地适配 CSS；客服中心基础样式直接加载官方 CDN 的带哈希版本链接，首次打开需要该资源可达，原生 HTML Mock 本身不会把外部 CSS 内嵌。浏览器可按服务器缓存规则缓存样式。根据 App UA 的 `themeId` 或系统深色偏好选择主题。这里的样式来源记录不等同于确认官方发布了对外开放的 SDK 或授权条款。

## 开发与发布

仓库布局必须为同级的 `Biliverse.github.io`、`Enhanced`、`Global`、`Redirect`、`ADBlock`，并安装四个模块已有依赖。生成器直接导入 TypeScript argument 定义，需要支持类型剥离的 Node.js（本次使用 24.19）。

```sh
node scripts/build-settings.mjs
node scripts/build-settings.mjs --check
node --test settings/settings.test.mjs
node scripts/preview-settings.mjs
```

生成器更新 `docs/public/settings/` 下的根页面、logo、四份 `assets/<Module>.html` 和四份 `<Module>/index.html`，同时更新四个模块的 `src/function/settings.mjs`（只含 schema 和 API 逻辑，不含 HTML）。不要手改生成文件。新增或修改 argument 时重新运行生成器。各模块继续用原有 Rollup 和 arguments-builder 构建正式版/开发版。纯 Rewrite 模板保持原行为。

预览默认地址为 `http://127.0.0.1:8791/settings/`（可通过 `PORT` 改端口），静态文件直接读取 Pages 输出，API 调用实际四个 Request 处理器，使用独立内存存储，不读取用户代理配置。预览内存数据在服务退出后消失。

发布时先部署 Pages 静态文件，再更新模块脚本和规则。Pages 自动工作流只监听 `main`，推送 `dev` 不会让新增资源 URL 上线；模块脚本不能弥补未部署的静态资源。不要把配置数据写入 Pages 的 `settings/api/` 目录，该路径仅用于本机脚本响应。

## 验证

`settings.test.mjs` 覆盖入口顺序与去重、配置读写、HEAD、存储失败、缓存保留、静态路径/API/跨模块边界、Mock 下载源不被再次拦截、静态源与 Pages 直接访问页一致，以及脚本不包含 HTML。Surge 静态规则另以本机 `surge-cli --check` 校验；Egern 检查转换产物。浏览器预览验证独立静态页导航及保存，不代表所有代理 App 已实机验证。
