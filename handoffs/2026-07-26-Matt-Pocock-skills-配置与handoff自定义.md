# 2026-07-26 — Matt Pocock skills 配置与 handoff 自定义

## 完成的工作

- [x] 在 ps-export-layer-tool 中完成 Matt Pocock skills 项目级初始化配置
  - Issue tracker: GitHub Issues（`gh` CLI）
  - Triage labels: 默认 5 个角色标签（needs-triage/needs-info/ready-for-agent/ready-for-human/wontfix）
  - Domain docs: 单上下文布局
  - 创建 `docs/agents/` 目录，内含 issue-tracker.md、triage-labels.md、domain.md（全部中文）
  - CLAUDE.md 追加 `## Agent skills` 节
- [x] 自定义 `/handoff` skill
  - 输出目录从系统临时目录改为 `handoffs/`
  - 引用 `handoffs/TEMPLATE.md` 作为文档结构约束
  - 新增"建议技能"节到 TEMPLATE.md
  - CLAUDE.md 会话交接约定更新为指向 `/handoff` skill
- [x] 在 ps-layer-tool 中同步上述所有配置
- [x] 在 ps-cep-template 中同步上述所有配置
- [x] 三个项目全部 git push 到 GitHub

## 进行中的工作

- 无

## 下一步计划

1. 在三��项目中使用 `/handoff` 替代手动编写交接文档
2. 根据实际使用效果评估是否需要进一步调整 TEMPLATE 结构
3. 后续可考虑使用 triage、to-spec、to-tickets 等 skill 管理项目需求

## 关键决策

- **决策**：handoff skill 输出到 repo 内 `handoffs/` 而非系统临时目录
  - 原因：保留 git 版本化和跨机器同步能力，与现有工作流一致
  - 影响：skill 输出持久化，可被团队共享；但 skills-lock.json hash 会不一致，skill 更新时可能覆盖修改
- **决策**：三个项目统一使用相同的 skills 配置
  - 原因：三个项目同属 PS CEP 插件体系，保持一致的开发工具链
  - 影响：后续配置变更需在三个项目中同步
- **决策**：handoff 文档遵循 TEMPLATE.md 的中文 6 段结构
  - 原因：用户习惯该格式，且原 skill 的英文自由格式不够结构化
  - 影响：输出更规范，但每次需 AI 按模板生成

## 已知问题 / 注意事项

- `.agents/skills/handoff/SKILL.md` 被手动修改，若执行 mattpocock/skills 更新可能被覆盖（三个项目均受影响）
- ps-layer-tool 当前在 `feature/lxy` 分支，其他两个在 `main`
- 三个项目的 docs/agents/ 内容完全相同，后续如需差异化配置需分别修改

## 建议技能

- [ ] `/handoff` — 下次 session 结束时交接
- [ ] `triage` — 若有新的 issue 或需求需要分诊
- [ ] `to-spec` — 若需要将讨论结果生成为规格说明
- [ ] `grill-with-docs` — 若需要深入探讨设计决策并生成 ADR
