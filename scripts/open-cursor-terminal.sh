#!/bin/sh
# Open a new Cursor/VS Code integrated terminal and run a command (macOS, Accessibility).
set -eu

CMD="${1:-}"
if [ -z "$CMD" ]; then
  echo "Usage: $0 <shell-command>" >&2
  exit 1
fi

case "$(uname -s)" in
  Darwin) ;;
  *)
    echo "open-cursor-terminal: macOS only" >&2
    exit 1
    ;;
esac

CMD_ESC=$(printf '%s' "$CMD" | sed 's/\\/\\\\/g; s/"/\\"/g')

APP="Cursor"
if ! osascript -e "application \"$APP\" is running" 2>/dev/null | grep -q true; then
  APP="Code"
fi

osascript <<EOF
tell application "$APP" to activate
delay 0.15
tell application "System Events"
  tell process "$APP"
    key code 50 using {control down, shift down}
    delay 0.4
    keystroke "$CMD_ESC"
    key code 36
  end tell
end tell
EOF
