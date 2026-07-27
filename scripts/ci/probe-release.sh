#!/usr/bin/env bash
set -euo pipefail

release_version="${1:?用法：probe-release.sh <version>}"
repository="${GITHUB_REPOSITORY:-413162826/moonsea-codex-theme}"
site_url="${MOONSEA_SITE_URL:-https://moonsea-codex-theme.suguowen5.chatgpt.site}"
manifest_url="https://github.com/$repository/releases/latest/download/update.json"
temp_root="$(mktemp -d)"
trap 'rm -rf "$temp_root"' EXIT

assert_equal() {
  local actual="$1"
  local expected="$2"
  local message="$3"
  if [[ "$actual" != "$expected" ]]; then
    printf '%s\nexpected: %s\nactual:   %s\n' "$message" "$expected" "$actual" >&2
    exit 1
  fi
}

read_location() {
  local url="$1"
  local user_agent="${2:-curl-release-probe}"
  curl --fail --silent --show-error --head \
    --retry 6 --retry-delay 5 \
    --user-agent "$user_agent" \
    "$url" |
    awk 'BEGIN{IGNORECASE=1} /^location:/{sub(/\r$/, ""); sub(/^[^:]+:[[:space:]]*/, ""); location=$0} END{print location}'
}

curl --fail --location --silent --show-error \
  --retry 6 --retry-delay 5 \
  "$manifest_url" \
  --output "$temp_root/update.json"

manifest_version="$(jq -r .version "$temp_root/update.json")"
assert_equal "$manifest_version" "$release_version" "最新更新清单版本不正确"

windows_versioned_url="$(jq -r .platforms.windows.installer.url "$temp_root/update.json")"
macos_versioned_url="$(jq -r .platforms.macos.url "$temp_root/update.json")"
windows_latest_url="https://github.com/$repository/releases/latest/download/Moonsea-Codex-Windows-x64-Setup.exe"
macos_latest_url="https://github.com/$repository/releases/latest/download/Moonsea-Codex-macOS.zip"

for asset_url in "$windows_versioned_url" "$macos_versioned_url"; do
  curl --fail --location --silent --show-error \
    --retry 4 --retry-delay 5 \
    --range 0-0 \
    "$asset_url" \
    --output /dev/null
done

windows_site_location="$(read_location \
  "$site_url/download" \
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")"
macos_site_location="$(read_location \
  "$site_url/download" \
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)")"
assert_equal "$windows_site_location" "$windows_latest_url" "官网 Windows 下载入口不正确"
assert_equal "$macos_site_location" "$macos_latest_url" "官网 macOS 下载入口不正确"

windows_release_location="$(read_location "$windows_latest_url")"
macos_release_location="$(read_location "$macos_latest_url")"
assert_equal "$windows_release_location" "$windows_versioned_url" "Windows latest 地址未指向当前正式版"
assert_equal "$macos_release_location" "$macos_versioned_url" "macOS latest 地址未指向当前正式版"

printf '正式版线上探针通过：v%s\n' "$release_version"
