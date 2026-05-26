## 1. Schema 准备

- [x] 1.1 在 `flexPropsSchema.ts` 中为 `FlexPropsSchema` 添加 `direction: z.enum(["row", "column"]).optional()` 字段
- [x] 1.2 新建 `genui-lib/Stack/schema.ts`，合并 `FlexPropsSchema`（含 direction）与 `children`

## 2. Stack 组件实现

- [x] 2.2 新建 `genui-lib/Stack/index.tsx`，实现 `Stack` 组件（name、props、description、component），使用css实现
- [x] 2.3 `Stack` 的 gap 映射使用 rem 值（none:"0", xs:"0.375rem", s:"0.5rem", m:"0.75rem", l:"1.125rem", xl:"1.5rem", 2xl:"2.25rem"），gap 默认为 "m"（0.75rem），direction 默认为 `"column"`；wrap=true + justify="between" 时 justifyContent 回退为 flex-start

## 3. 库注册更新

- [x] 3.1 在 `dslLibrary.tsx` 中导入并注册 `Stack`，设为 `root` 组件
- [x] 3.2 从 `dslLibrary.tsx` 中移除 `VLayout` 和 `HLayout` 的导入与注册

## 4. 旧组件清理

- [x] 4.1 删除 `genui-lib/VLayout/` 目录（含 schema.ts、index.tsx、view/antd.tsx、index.test.tsx）
- [x] 4.2 删除 `genui-lib/HLayout/` 目录（含 schema.ts、index.tsx、view/antd.tsx、index.test.tsx）

## 5. 测试更新

- [x] 5.1 为 `Stack` 新建单元测试（`genui-lib/Stack/index.test.tsx`），覆盖：gap token 映射、direction 属性、schema 校验（拒绝数字 gap、拒绝无效 direction）
- [x] 5.2 更新 `dslLibrary.test.ts` 中引用 `VLayout`/`HLayout` 的测试，改为 `Stack`

## 6. Snapshot 重新生成

- [x] 6.1 找出 `src/__tests__/e2e/snapshots/` 中所有含 `VLayout`/`HLayout` 的 `.dsl` 文件，手动更新为 `Stack` 语法（`VLayout([...], gap)` → `Stack([...], gap)`，`HLayout([...], gap)` → `Stack([...], gap, direction: "row")`）
- [ ] 6.2 运行 e2e 快照重新生成脚本，提交新的渲染快照
- [x] 6.3 若 benchmark-snapshots 中存在相关文件，同步处理

## 7. 验证

- [x] 7.1 运行 `pnpm test` 确保所有单元测试通过（含验证 `dslLibrary.prompt()` 输出包含 `root = Stack(` 而非 `root = VLayout(`）
- [ ] 7.2 运行 e2e 测试，确认快照无意外 diff
- [x] 7.3 确认 TypeScript 编译无报错（`pnpm typecheck` 或等效命令）
