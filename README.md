# dsh-secrets-manager

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（下称 DSH）插件。

项目密钥管理：扫描 monorepo 里所有 `.env`（根目录 + 各 workspace 包），在 Settings 页面里安全编辑，并把 `DSH_ENV_FILE` / `DSH_ENV_FILES` 交给 bash。

## 安装

最省事的方式是用 DSH 自带的 `plugin_manager` 工具安装（会自动写 profile 并把插件行插进 composition）：

```sh
# 或者手工装进当前 profile
cd "$DSH_HOME/profiles/<profile>"
pnpm add github:lifecoder1988/dsh-secrets-manager
```

本仓库自带的 `cordis.patch.yml` 就是它的 composition 行；手工接的话在 profile 的 `cordis.patch.yml` 里加：

```yaml
- insert:
    - id: secrets-manager
      name: '@local/dsh-secrets-manager'
```

装完重启 DSH（host 半边改动需要重启；只有 client 半边的话刷新页面即可）。

## 为什么需要它

「项目要有密钥」和「密钥不能进对话」是矛盾的：模型要用某个 token，就得知道它存在、并且能在 `bash` 里直接用，但不能把值念出来。本插件把密钥留在 `.env` 里，只给模型**指针**：

装好之后，每个 `bash` 调用都会拿到三个环境变量：

| 变量 | 内容 |
|---|---|
| `DSH_ENV_FILE` | 离 cwd 最近的那个 `.env` |
| `DSH_ENV_FILES` | 从仓库根到 cwd 的完整链（`:` 分隔） |
| `DSH_ENV_KEYS` | 链上所有 key 的名字（不含值） |

于是模型可以这样用，而永远看不到值：

```sh
set -a; for f in ${DSH_ENV_FILES//:/ }; do [ -f "$f" ] && . "$f"; done; set +a
```

## 功能

- **monorepo 发现**：仓库根 + `pnpm-workspace.yaml` / `package.json` workspaces 里的每个包目录，各自的 `.env` / `.env.local` / `.env.<mode>` 都进索引（`maxPackages` 兜底）。
- **按目录查看**：每个目录一张卡片，列出 key 名（**值默认遮蔽**），并显示它在 shell 里的生效顺序。
- **安全写入**：新增 / 修改 / 删除 key 时保留注释、顺序与原有引号风格；写文件用原子替换。
- **刷新**：外部改过 `.env` 后一键重建索引。
- 会话头部速查：本会话 shell 会拿到哪些 key（只列名字）。

## 模型工具：`project_secrets`

| action | 关键参数 | 说明 |
|---|---|---|
| `list` | `cwd?` | 索引到的目录与各自的 key 名；带 `cwd` 时同时给 shell facts |
| `files` | — | 所有 `.env` 文件路径 |
| `set` | `path?`, `key`, `value` | 写入（保留注释与顺序） |
| `remove` | `path?`, `key` | 删除 key |

## HTTP 路由（前缀 `/secrets-manager`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/state?cwd=&sessionId=` | 发现索引 + 每个目录的 key 名 |
| POST | `/file` | 读一个目录的 key（值遮蔽） |
| POST | `/write` | 写入 / 删除 key |
| POST | `/refresh` | 重建索引 |

## 界面注入点

| slot | id | order |
|---|---|---|
| `settings.section` | `secrets-manager` | 32 |
| `conversation.session.header.utilities` | `plugin-secrets` | 53 |

### 会话头部（图标 → 面板）：原地增删改查

图标点开就是一个可写的密钥面板，不用进设置页：

- **文件切换**：当前项目发现到的每个 `.env`（含它有几个键）。
- **显示 / 隐藏**：值按需从 `/file` 读，只在你点「显示」时进入内存，永不进模型上下文。
- **改**：填新值 → 保存（走同一套注释/顺序保留写入）。
- **删**：二次确认后删除该键。
- **新增键**：`KEY_NAME` + 值；键名按 `[A-Za-z_][A-Za-z0-9_]*` 校验。
- 项目里一个 `.env` 都没有时，提供**「在仓库根创建 .env」**。
- 右上角同样有**「打开管理页」**。

## 配置

```yaml
config:
  maxPackages: 200    # 单次索引的包目录上限
```

## 自检

```sh
node test/local-check.mjs
```

## 文件结构

```
index.js              host 半边：发现索引、注释保留写入、shellEnv 贡献、路由、project_secrets 工具
client.js             浏览器半边：Settings 页面 + 会话头部速查
cordis.patch.yml      bundle patch
package.json          dsh.bundle.patch / dsh.client 声明
test/local-check.mjs  离线自检
```

## 安全边界

- 值只进 `/write` 的请求体与 `.env` 文件，**不进**任何模型可见的输出（`list` / `/state` 只给 key 名）。
- 插件的检查接口（inspect provider）同样只报 key 名与文件路径。

## 许可

MIT
