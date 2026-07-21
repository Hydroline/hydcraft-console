# HydCraft Console Memory

## UI Implementation Preference

- HTML 结构中，非必要不要直接写 `style` 内联样式，优先使用 Tailwind CSS 与 Nuxt UI 提供的能力完成样式表达。
- `<style scoped>` 不是禁用，但应只用于 Tailwind CSS / Nuxt UI 难以表达的复杂状态、动画、第三方组件覆盖或结构性样式；普通布局与视觉优先留在模板 class。
- `:style` / 内联 `style` 只用于运行时计算值、第三方库注入 HTML、canvas / map 等 Tailwind CSS 无法静态表达的场景；静态样式不要回退成 inline style。

## UI System Discipline

- 优先复用 `app.config.ts` 中的 Nuxt UI 主题配置，以及 `assets/styles/base/tailwind.css` 中的 design token，不要在页面里重新发明一套颜色、表面层级、尺寸语义。
- 颜色、语义色、表面层级、字号与字体倾向，优先通过 token 与 class 表达，不要在局部组件里散落硬编码色值。
- 对 Nuxt UI 组件的定制，优先走 theme / config / class 扩展，不要为了一个局部视觉点把整个组件手写替换掉。
- 基础信息卡片默认优先使用 `rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950` 这套配色与圆角；只有在语义或视觉方向明确不同的时候再局部调整。

## Utils Directory Discipline

- `utils/` 不要长期平铺堆放领域文件；只允许保留极少数真正的顶层稳定入口，默认都应按领域拆进子文件夹，例如 `utils/profile/*`、`utils/community/*`、`utils/links/*`。
- 当某个 util 已明显服务于特定业务域、页面族、或模块契约时，优先新建对应子目录，不要继续把文件散放在 `utils/` 根下。
- 做 utils 重构时，先按领域边界整理目录，再决定是否保留或收缩顶层 re-export 入口；不要为了“先能用”长期保留一堆平铺 shim。

## Error And i18n Discipline

- 服务端业务错误统一通过 `createApiError` / `createBadRequestError` 抛出，不要直接散落 `createError` 拼结构。
- 错误 code 保持英语、大写、下划线风格；HTTP status 与错误 code 分离，前端展示依赖 i18n 映射，不直接展示裸文案。
- 新增错误 code 时，默认同步补各 locale 的 `errors` 文案；至少不能只补一个语言后就结束。
- 面向用户的失败提示统一走 i18n；日志与内部诊断信息可以保留英文技术描述。
- `console.error` / `console.warn` 的标签前缀优先使用稳定的英文大写错误标识，方便检索，例如 `PROFILE_ATTACHMENT_CLEANUP_FAILED`。
- 当前项目可将 i18n 视为“全局可用”，模板层优先复用全局能力，不要在能直接使用全局能力的地方重复包一层相同语义的实现。
- 但要区分边界：模板可直接使用全局注入能力；`script setup` / 组合式逻辑内若需要响应式 locale 与类型安全，仍应优先使用 `useI18n()` 或现有封装，而不是误以为模板侧全局能力可无差别替代脚本侧调用。
- 任何对 `locales/` 下文案的修改，都必须同步检查并补齐对应语言文件，不能只改单一语言后结束；新增 key、改 key、删 key 时都按“所有已支持 locale 一起收口”处理。
- 任何新增面向用户的文案、错误提示、状态文案或内容标题时，默认同时补齐对应 i18n 文本，不允许留下仅单语言可见的中间态。

## Event And Side-Effect Boundary

- Service 负责核心数据库操作与数据合法性校验，成功后发事件；异步清理、发信、联动修复等副作用放到 event handler / plugin 层。
- API handler 保持薄层：鉴权、读参、调用 service、返回结果，不在 handler 里堆业务细节。
- 新增业务节点时，先想清楚是否应该补事件，而不是让两个业务模块直接互相调用。
- 定时清理、附件替换清理、OAuth 解绑后的补偿动作，这类后处理逻辑优先挂到 plugin / event 层，而不是塞回主流程事务里。
- 若某个副作用失败，优先记录日志并可重试，不要轻易污染核心成功路径。

## Draft And Cleanup Lifecycle

- 允许存在草稿、待上传、待替换、待清理这类中间态，但必须同时设计对应的过期回收或替换清理机制。
- 新增“先落库后补媒体”或“先生成记录再补关联”的流程时，要同时考虑悬空记录、过期附件、孤儿资源的清理策略。
- 如果一个功能会生成临时 token、临时附件、临时申请单、临时注册记录，默认需要先回答：谁来清、何时清、失败后如何补偿。
