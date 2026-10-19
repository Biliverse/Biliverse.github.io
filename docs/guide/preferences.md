# ⚙️ 偏好面板

Biliverse 的[偏好面板](https://biliverse.github.io/settings/)用于配置 Enhanced、Global、Redirect 和 ADBlock，无需安装 BoxJs。面板使用 [PreferencePanes](https://github.com/NSNanoCat/PreferencePanes)，可从 Bilibili App 内或浏览器进入。

## 进入设置页面

1. 安装并启用最新版 [Enhanced](./enhanced#安装链接)。Enhanced 提供设置首页和共用存储接口；配置其他模块时，还需安装并启用对应的 [Global](./global#安装链接)、[Redirect](./redirect#安装链接) 或 [ADBlock](./ad-block#安装链接)。请更新完整的模块／插件／覆写，不要只更新脚本。
2. 保持代理工具运行，确认模块已启用，且 `biliverse.github.io`、`app.bilibili.com` 的 HTTPS 解密生效。
3. 打开 Bilibili App，依次进入「我的」→「Biliverse 哔哩万象」，再选择需要配置的模块。也可点击官网导航栏的「偏好面板」，或用同一设备的浏览器打开 <https://biliverse.github.io/settings/>。
4. 选择显示版本号的模块进入设置。修改选项或输入内容后自动保存；重新进入面板可核对保存结果。

设置保存在当前代理工具的持久化存储中，与 BoxJs 共用数据。更换设备或代理工具后，设置不会自动同步。

入口显示「未安装」或设置无法保存时，请检查 Enhanced 和对应模块是否均已更新并启用、浏览器流量是否经过该代理工具，以及 HTTPS 解密是否生效。仅打开网页不能代替安装模块。

## 配置来源与优先级

使用偏好面板前，请将模块／插件参数中的「[储存] 配置类型」设为「持久化存储优先」（`Storage=PersistentStore`），避免参数覆盖面板中保存的设置。

| 配置类型 | 参数值 | 优先级（由高到低） |
| --- | --- | --- |
| 持久化存储优先 | `PersistentStore` | 偏好面板／BoxJs → 模块／插件参数 → 脚本默认值 |
| 插件配置优先 | `Argument` | 模块／插件参数 → 偏好面板／BoxJs → 脚本默认值 |
| 仅使用默认配置 | `database` | 只使用脚本默认值 |

Enhanced 和 ADBlock 的新安装默认使用 `PersistentStore`；Global 和 Redirect 的模块参数默认仍为 `Argument`。旧安装已保存的配置类型不会随更新自动改变，请按当前模块的实际参数确认。

Enhanced 在 App「分区」→「自定义标签页」中保存的标签顺序始终优先于模块参数，不受上述配置优先级影响。

## 选择对应面板

| 面板 | 设置内容 |
| --- | --- |
| [Enhanced](./enhanced) | 首页、默认标签页、底部导航栏、分区及 iPhone／iPad「我的」页面 |
| [Global](./global) | CDN 主机名类型、启用自动识别与分流的地区、各地区的代理策略名称 |
| [Redirect](./redirect) | 港澳台 OverseaVideo、国际版 BStar、中国大陆 PCDN 与 MCDN 的目标主机名 |
| [ADBlock](./ad-block) | 开屏、推荐、Story、搜索、番剧、直播、动态、播放页、弹幕、评论及隐私设置 |

### Enhanced 的首页标签页

「[首页] 标签页」会打开 Bilibili 原生「分区」页面。进入「自定义标签页」后，可选择、排序或清空标签；保存结果同时用于「快捷访问」和「首页标签栏」。完整说明见 [Enhanced 使用方式](./enhanced#使用方式)。

### ADBlock 的可选设置

Story 商业按钮过滤和响应链接跟踪参数清理默认开启；搜索结果跟踪参数、直播推荐回调、直播预载链接 `trackid`、个人动态流广告卡片及严格隐私设置可按需启用。空降助手默认关闭，需要时在「[弹幕] 空降助手」中开启。

推荐流中的「屏蔽 UP 主直播推广」需要填写 UP 主 UID，多个 UID 使用英文逗号分隔。各选项的默认状态见 [ADBlock 默认设置](./ad-block#默认设置)。

### Redirect 的 CDN 选择

OverseaVideo、BStar 和 PCDN 均可选择 `upos-sz-mirrorhwo1.bilivideo.com` 或 `upos-sz-mirror08c.bilivideo.com`，默认仍为阿里云 CDN。MCDN 使用独立的目标主机名选项。

## 与 BoxJs 共用设置

偏好面板和 BoxJs 修改的是同一份持久化数据，后保存的值生效；实际读取顺序由配置类型决定。BoxJs 的安装与订阅方法见 [BoxJs 指南](./box-js)。Enhanced 目前继续兼容 BoxJs，复杂设置建议通过偏好面板或 App 原生页面完成。

当前设置与缓存使用 `Biliverse` 存储空间。旧 `BiliBili` 空间的数据不会自动迁移，更新后请重新配置。
