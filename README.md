# dsh-secrets-manager

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（下称 DSH）插件。

项目密钥管理：扫描 monorepo 里所有 `.env`（根目录 + 各 workspace 包）**加上一层全局 `$DSH_HOME/.env`**，在 Settings 页面里安全编辑，并把 `DSH_ENV_FILE` / `DSH_ENV_FILES` 交给 bash。

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
| `DSH_ENV_FILE` | 离 cwd 最近的那个 `.env`；项目里一个都没有时就是全局 `$DSH_HOME/.env` |
| `DSH_ENV_FILES` | 完整链（`:` 分隔）：**全局文件在最前**，然后是仓库根→cwd 的项目文件 |
| `DSH_ENV_KEYS` | 链上所有 key 的名字（去重，不含值） |

于是模型可以这样用，而永远看不到值：

```sh
set -a; for f in ${DSH_ENV_FILES//:/ }; do [ -f "$f" ] && . "$f"; done; set +a
```

### 两层，全局在前

`$DSH_HOME/.env` 是 DSH 自己启动时也读的那个文件（`DSH_HOME` 默认 `~/.dsh`），所以它是唯一真正「对每个项目都生效」的 dotenv 路径。本插件把它排在链首：**后加载的覆盖先加载的，项目就自然覆盖全局**——同一个 key 在全局放默认值、在项目里放真值，是一条正常用法。

注意两件事：

- 项目里**一个 `.env` 都没有**时，那个目录照样拿到全局文件（这是加它的主要理由）。
- DSH 进程自己的配置（比如 `NEW_API_KEY`）是**启动时**读的，改完要重启 `dsh web` 才生效；给 bash 用的密钥是每次调用现source，改完立刻生效。

## 功能

- **全局层**：`$DSH_HOME/.env` 单独一张卡片/一个芯片，和项目文件一样可增删改；它排在链首，对所有项目生效。
- **monorepo 发现**：仓库根 + `pnpm-workspace.yaml` / `package.json` workspaces 里的每个包目录，各自的 `.env` / `.env.local` / `.env.<mode>` 都进索引（`maxPackages` 兜底）。
- **按目录查看**：每个目录一张卡片，列出 key 名（**值默认遮蔽**），并显示它在 shell 里的生效顺序。
- **安全写入**：新增 / 修改 / 删除 key 时保留注释、顺序与原有引号风格；写文件用原子替换。可写范围只有**项目根之内**和**全局目录里的 `.env*`**两种。
- **刷新**：外部改过项目 `.env` 后一键重建索引（全局文件每次 shell 调用现读，不需要刷新）。
- 会话头部速查：本会话 shell 会拿到哪些 key（只列名字）。

## 模型工具：`project_secrets`

| action | 关键参数 | 说明 |
|---|---|---|
| `list` | `cwd?` | 索引到的目录与各自的 key 名 + `global` 那层；带 `cwd` 时同时给 shell facts |
| `files` | — | 所有 `.env` 文件路径 |
| `set` | `path?`, `scope?`, `key`, `value` | 写入（保留注释与顺序）；`scope: "global"` 写全局文件 |
| `remove` | `path?`, `scope?`, `key` | 删除 key；`scope: "global"` 删全局的 |

`scope: "global"` 目标就是 `$DSH_HOME/.env`，不带 `cwd` 也能用（全局层不属于任何工作区）。`scope` 和 `path` 只能给一个，同时给会被拒绝。

## HTTP 路由（前缀 `/secrets-manager`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/state?cwd=&sessionId=` | 发现索引 + `global` 那层 + 每个目录的 key 名 |
| POST | `/file` | 读一个文件的 key（值遮蔽）；全局文件同样走这里 |
| POST | `/write` | 写入 / 删除 key（项目文件或全局文件） |
| POST | `/refresh` | 重建项目索引 |

## 界面注入点

| slot | id | order |
|---|---|---|
| `settings.section` | `secrets-manager` | 32 |
| `conversation.session.header.utilities` | `plugin-secrets` | 53 |

### 设置页

- **变量文件网格**：每张卡片以**文件名**（`.env.local`）打头，下面依次是所属目录、键数、键名（超过 4 个折叠成「等 N 个」）；点卡片会把下面的键列表带进视野。
- **全局层**：`$DSH_HOME/.env` 永远是网格里的第一张卡（标「全局」），和项目文件一样可增删改；它没被创建时卡片显示「未创建」，选中后给一个**「创建空文件」**按钮（或者直接加第一个键，会一并创建）。选中全局文件时键列表上方会说明：它排在链首、项目覆盖它，以及**DSH 进程自己也在启动时读它**。
- **键列表**：值默认按真实长度打码（空值显示「（空）」），每行一个**眼睛**按钮按需显隐——隐藏时值不在 DOM 里，显示时单独占一行、可选中复制；空值的眼睛是禁用的。设置页的值本来就随 `/file` 读进了内存，所以这里的眼睛是纯本地切换；「复制值」整段进剪贴板，「编辑」写新值。
- **空态**：项目里一个 `.env` 都没有时只有一张说明卡（含「在仓库根目录创建 .env」），不再出现「变量文件 · 0」这种空分组。
- **远端节点（DevSpace）**：**跟着当前工作区走**。当前工作区是远端镜像时，自动扫描并只列出该镜像对应的那**一个**节点（约十几秒，结果缓存 60 秒，另有「重新扫描」）；当前工作区不是镜像时整块不显示，Host 端也不会发起任何远端命令。

### 会话头部（图标 → 面板）：原地增删改查

图标点开就是一个可写的密钥面板，不用进设置页：

- **文件切换**：全局 `$DSH_HOME/.env` 永远是第一个芯片（标成「全局 .env」），后面是当前项目发现到的每个 `.env`（含各有几个键）；默认落在 shell 真正会用的那个文件上。
- **值按需查看**：面板**不预读值**——点眼睛才 `POST /file` 取一次并渲染，再点一次立刻把它从内存和 DOM 里丢掉；「复制值」同样只在点击时读一次。两种情况值都不会进模型上下文。
- **改**：填新值 → 保存（走同一套注释/顺序保留写入）。
- **删**：二次确认后删除该键。
- **新增键**：`KEY_NAME` + 值；键名按 `[A-Za-z_][A-Za-z0-9_]*` 校验。选中全局文件时也会提示它「对所有项目生效、DSH 进程配置改完要重启」；文件还没创建时说明「保存第一个键时就会建」。
- 项目里一个 `.env` 都没有时，面板会说明「当前只有全局层」，设置页仍提供**「在仓库根创建 .env」**。
- **远端节点**同样是按需的：面板里只显示一个「扫描」按钮，点下去才去问 DevSpace 节点。
- 右上角同样有**「打开管理页」**。

## 配置

```yaml
config:
  maxPackages: 200        # 单次索引的包目录上限
  dshHome: /path/to/.dsh  # 全局层所在目录；默认 $DSH_HOME，再默认 ~/.dsh
  globalEnv: /path/to/env # 直接指定全局 env 文件，优先级最高
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
- 可写面只有两处：项目根目录之内，以及全局目录里名字形如 `.env*` 的文件——全局目录里的 `credentials.yaml` 之类一律拒绝（自检里有这条用例）。

## 许可

MIT
