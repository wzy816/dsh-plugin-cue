# dsh-plugin-cue

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
