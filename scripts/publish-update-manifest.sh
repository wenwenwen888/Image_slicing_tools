#!/usr/bin/env bash

set -euo pipefail

release_tag="${1:-}"
if [[ ! "$release_tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Expected a release tag such as v0.1.2" >&2
  exit 1
fi

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"

version="${release_tag#v}"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

release_json="$(gh api "repos/${GITHUB_REPOSITORY}/releases/tags/${release_tag}")"
published_at="$(jq -r '.published_at' <<< "$release_json")"
mac_url="$(jq -r '.assets[] | select(.name | endswith(".app.tar.gz")) | .browser_download_url' <<< "$release_json")"
windows_url="$(jq -r '.assets[] | select(.name | endswith("setup.exe")) | .browser_download_url' <<< "$release_json")"

if [[ -z "$mac_url" || -z "$windows_url" || "$published_at" == "null" ]]; then
  echo "Release ${release_tag} is missing a desktop updater asset" >&2
  exit 1
fi

gh release download "$release_tag" \
  --repo "$GITHUB_REPOSITORY" \
  --pattern "*.sig" \
  --dir "$temp_dir"

mac_signature_file="$(find "$temp_dir" -maxdepth 1 -type f -name '*.app.tar.gz.sig' -print -quit)"
windows_signature_file="$(find "$temp_dir" -maxdepth 1 -type f -name '*setup.exe.sig' -print -quit)"

if [[ -z "$mac_signature_file" || -z "$windows_signature_file" ]]; then
  echo "Release ${release_tag} is missing an updater signature" >&2
  exit 1
fi

mac_signature="$(tr -d '\r\n' < "$mac_signature_file")"
windows_signature="$(tr -d '\r\n' < "$windows_signature_file")"

jq -n \
  --arg version "$version" \
  --arg notes "Image Slicing Tools ${release_tag}" \
  --arg pub_date "$published_at" \
  --arg mac_url "$mac_url" \
  --arg mac_signature "$mac_signature" \
  --arg windows_url "$windows_url" \
  --arg windows_signature "$windows_signature" \
  '{
    version: $version,
    notes: $notes,
    pub_date: $pub_date,
    platforms: {
      "darwin-aarch64": {
        signature: $mac_signature,
        url: $mac_url
      },
      "windows-x86_64": {
        signature: $windows_signature,
        url: $windows_url
      }
    }
  }' > "$temp_dir/latest.json"

gh release upload "$release_tag" "$temp_dir/latest.json" \
  --repo "$GITHUB_REPOSITORY" \
  --clobber
