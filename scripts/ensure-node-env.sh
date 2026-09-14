# Prefer fnm-managed Node/pnpm when available.
#
# Git GUI clients (e.g. GitKraken) often run husky hooks with a thin PATH that
# resolves to the distro Node + a broken Corepack pnpm shim. Interactive shells
# load fnm via ~/.bashrc; this helper does the same for non-interactive CI/hooks.
#
# Source from repo scripts/hooks (POSIX `.`). No-ops when CI is set (hosted
# runners) or fnm is absent. Safe to source more than once.

if [ -n "${CI:-}" ]; then
  return 0 2>/dev/null || exit 0
fi

_fnm_path="${FNM_DIR:-${HOME}/.local/share/fnm}"
if [ -x "${_fnm_path}/fnm" ]; then
  # shellcheck disable=SC1090
  eval "$("${_fnm_path}/fnm" env --shell bash)"
fi
unset _fnm_path
