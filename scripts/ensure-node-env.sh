# Prefer fnm-managed Node and the user's pnpm when available.
#
# Git GUI clients (e.g. GitKraken) often run husky hooks with a thin PATH that
# resolves to the distro Node + a broken Corepack pnpm shim, and never read
# ~/.bashrc. Interactive shells load fnm and PNPM_HOME there; this helper does
# the same for non-interactive CI/hooks.
#
# Source from repo scripts/hooks (POSIX `.`). No-ops when CI is set (hosted
# runners). Safe to source more than once.

if [ -n "${CI:-}" ]; then
  return 0 2>/dev/null || exit 0
fi

# fnm: the installer puts it under FNM_DIR; distro packages put it on PATH
# (e.g. /usr/bin/fnm on Arch).
_fnm_bin="${FNM_DIR:-${HOME}/.local/share/fnm}/fnm"
if [ ! -x "${_fnm_bin}" ]; then
  _fnm_bin="$(command -v fnm 2>/dev/null || true)"
fi
if [ -n "${_fnm_bin}" ] && [ -x "${_fnm_bin}" ]; then
  eval "$("${_fnm_bin}" env --shell bash)"
fi
unset _fnm_bin

# pnpm: the standalone installer puts it under PNPM_HOME, outside any
# Node version manager.
if ! command -v pnpm >/dev/null 2>&1; then
  _pnpm_home="${PNPM_HOME:-${HOME}/.local/share/pnpm}"
  for _pnpm_dir in "${_pnpm_home}/bin" "${_pnpm_home}"; do
    if [ -x "${_pnpm_dir}/pnpm" ]; then
      PATH="${_pnpm_dir}:${PATH}"
      export PATH
      break
    fi
  done
  unset _pnpm_home _pnpm_dir
fi
