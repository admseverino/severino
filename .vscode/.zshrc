# Workspace terminal startup (ZDOTDIR is set by terminal profile in settings.json)
[[ -f "$HOME/.zshrc" ]] && source "$HOME/.zshrc"
[[ -f "${ZDOTDIR}/project_aliases" ]] && source "${ZDOTDIR}/project_aliases"
