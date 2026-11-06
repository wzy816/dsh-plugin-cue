# dsh-plugin-cue

English | [中文](#中文)

A DSH Web plugin that plays a short cue when the harness is waiting for you. It
listens to the Client's unified Session status and synthesises its sounds with
Web Audio, so the bundle ships no audio files.

## Sounds

| Moment | Sound |
| --- | --- |
| A top-level Session's agent finishes a turn and goes idle | Soft rising two-note cue (E5 → B5) |
| An approval, question, or plan review appears and waits for your decision | Brighter three-note alert (A5, A5, D6) |

Notes:

- Only top-level Sessions notify. Subagent Sessions finish constantly and would
  make the cues meaningless.
- The first Session status observed after page load is treated as the current
  state, not news, so reloading the page does not replay a cue for an approval
  that was already pending. New requests after that do play.
- Browsers block audio until the page has seen a user gesture. The plugin resumes
  its AudioContext on the first pointer or key event and holds a cue for up to
  five seconds while it waits for that gesture.
- One cue is suppressed if another played within the previous 800 ms, so several
  Sessions finishing together do not stack.

## Install

```sh
dsh plugin install /absolute/path/to/dsh-plugin-cue
```

Or point `plugin_manager` at the package directory and let the profile link it.

## Disable

Disable the `dsh-plugin-cue` row in Settings → Plugins, or remove the bundle from
the profile.

---

## 中文

中文 | [English](#dsh-plugin-cue)

一个 DSH Web 插件：当 harness 在等你的时候播放一声短提示。它监听 Client 中统一的
Session 状态，并用 Web Audio 合成声音，因此插件包不包含任何音频文件。

### 提示音

| 时机 | 声音 |
| --- | --- |
| 顶层 Session 的智能体完成一轮工作并进入空闲 | 柔和上扬的两音提示（E5 → B5） |
| 审批、提问或计划评审出现，等待你做出决定 | 更明亮的三音提醒（A5、A5、D6） |

### 说明

- 只有顶层 Session 会提示。子智能体 Session 会频繁结束，若也提示会让提示音失去意义。
- 页面加载后观察到的第一次 Session 状态会被视为当前状态，而不是新事件，因此刷新页面不会为已经挂起的审批重放提示音；此后出现的新请求会正常播放。
- 浏览器在页面收到用户手势之前会阻止音频。插件会在第一次指针或键盘事件时恢复 AudioContext，并在等待该手势期间最多保留提示音五秒。
- 若上一条提示音在 800 毫秒内刚播放过，则新的提示会被抑制，因此多个 Session 同时结束不会叠音。

### 安装

```sh
dsh plugin install /absolute/path/to/dsh-plugin-cue
```

或者把 `plugin_manager` 指向该包的目录，让 profile 以链接方式安装。

### 禁用

在 设置 → 插件 中禁用 `dsh-plugin-cue` 一行，或从 profile 中移除该 bundle。
