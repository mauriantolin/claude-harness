#!/usr/bin/env bash
# The base of a work machine on Ubuntu (written for 26.04 desktop): Tailscale, Claude Code, Orca,
# Google Chrome, the CLIs the profiles drive, this harness, and RDP so a phone can get in after a
# reboot. Nothing else: projects are cloned when they are needed, not carried over.
#
#   git clone https://github.com/mauriantolin/claude-harness ~/repos/claude-harness
#   ~/repos/claude-harness/machine/bootstrap-ubuntu.sh
#
# Re-runnable: every step checks before it installs. Logins are not done here; they are
# interactive and belong to the person, so the script ends by listing them.
set -euo pipefail

readonly REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly LOCAL_BIN="$HOME/.local/bin"
readonly DATA_LABEL="${DATA_LABEL:-2tb hdd}"   # the NTFS partition that keeps personal files
readonly DATA_MOUNT="${DATA_MOUNT:-/mnt/datos}"
export PATH="$LOCAL_BIN:$PATH"

step() { printf '\n== %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
pending=()

# A GitHub release asset whose name matches a pattern, for tools that only ship there.
latest_asset() {
	curl -fsSL "https://api.github.com/repos/$1/releases/latest" |
		jq -r --arg re "$2" '[.assets[].browser_download_url | select(test($re))][0] // empty'
}

install_deb_url() {
	local tmp
	tmp="$(mktemp --suffix=.deb)"
	curl -fsSL -o "$tmp" "$1"
	sudo apt-get install -y "$tmp"
	rm -f "$tmp"
}

apt_repo() { # name keyring-url list-line
	local key="/etc/apt/keyrings/$1.gpg"
	[[ -f "/etc/apt/sources.list.d/$1.list" ]] && return 0
	sudo install -d -m 0755 /etc/apt/keyrings
	curl -fsSL "$2" | sudo gpg --dearmor --yes -o "$key"
	sudo chmod go+r "$key"
	echo "${3//@KEY@/$key}" | sudo tee "/etc/apt/sources.list.d/$1.list" >/dev/null
	sudo apt-get update -qq
}

step "base packages"
sudo apt-get update -qq
sudo apt-get install -y git curl wget ca-certificates gnupg build-essential jq ripgrep unzip \
	openssl cifs-utils smbclient python3 python3-venv shfmt

step "NVIDIA driver"
if lspci | grep -qi nvidia && ! have nvidia-smi; then
	# The packaged driver; never NVIDIA's .run installer. If RDP screen sharing crashes on this
	# branch, `sudo ubuntu-drivers install nvidia:580` is the known-good fallback.
	sudo ubuntu-drivers install
	pending+=("reiniciar para cargar el driver de NVIDIA")
else
	echo "nothing to do"
fi

step "Google Chrome"
# The .deb and not Chromium's snap: snap confinement blocks the native messaging host that
# Claude in Chrome talks through.
have google-chrome || install_deb_url https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb

step "Tailscale"
have tailscale || curl -fsSL https://tailscale.com/install.sh | sh
tailscale status >/dev/null 2>&1 ||
	# --accept-routes: unlike Windows, Linux ignores advertised subnet routes unless asked, and the
	# lab LAN is reached through one.
	pending+=("sudo tailscale up --ssh --accept-routes --advertise-tags=tag:workstation --hostname=$(hostname)")

step "Node, pnpm, bun"
if ! have node; then
	curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
	sudo apt-get install -y nodejs
fi
# Global packages go to ~/.local, so `npm install -g` never needs sudo.
npm config set prefix "$HOME/.local"
npm install -g pnpm bun@1.4.0

step "uv"
have uv || curl -LsSf https://astral.sh/uv/install.sh | sh

step "CLIs: gh, gcloud, aws, vercel, neon, supabase"
apt_repo github-cli https://cli.github.com/packages/githubcli-archive-keyring.gpg \
	"deb [arch=$(dpkg --print-architecture) signed-by=@KEY@] https://cli.github.com/packages stable main"
apt_repo google-cloud-sdk https://packages.cloud.google.com/apt/doc/apt-key.gpg \
	"deb [signed-by=@KEY@] https://packages.cloud.google.com/apt cloud-sdk main"
sudo apt-get install -y gh google-cloud-cli
if ! have aws; then
	tmp="$(mktemp -d)"
	curl -fsSL -o "$tmp/aws.zip" https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip
	unzip -q "$tmp/aws.zip" -d "$tmp"
	sudo "$tmp/aws/install"
	rm -rf "$tmp"
fi
npm install -g vercel@59.10.0 neonctl@4.13.0
have supabase || install_deb_url "$(latest_asset supabase/cli '_linux_amd64\.deb$')"

step "Claude Code"
have claude || curl -fsSL https://claude.ai/install.sh | bash

step "Orca"
if ! have orca-ide; then
	url="$(latest_asset stablyai/orca '(amd64|x86_64)\.deb$' || true)"
	if [[ -n "$url" ]]; then install_deb_url "$url"; else pending+=("instalar Orca a mano: https://www.onorca.dev/docs/install"); fi
fi

step "RDP (GNOME Remote Desktop, Remote Login)"
# Remote Login serves the login screen itself, so a phone gets in after a reboot with nobody
# logged in locally. Port 3389; the tailnet policy already lets tag:mobile reach this host.
grd_home="$(getent passwd gnome-remote-desktop | cut -d: -f6)"
if ! { sudo test -f "$grd_home/rdp-tls.crt" && systemctl is-enabled -q gnome-remote-desktop.service; }; then
	if ! sudo test -f "$grd_home/rdp-tls.crt"; then
		sudo -u gnome-remote-desktop openssl req -new -newkey rsa:4096 -days 3650 -nodes -x509 \
			-subj "/CN=$(hostname)" -keyout "$grd_home/rdp-tls.key" -out "$grd_home/rdp-tls.crt" 2>/dev/null
	fi
	sudo grdctl --system rdp set-tls-key "$grd_home/rdp-tls.key"
	sudo grdctl --system rdp set-tls-cert "$grd_home/rdp-tls.crt"
	sudo grdctl --system rdp enable
	sudo systemctl enable --now gnome-remote-desktop.service
	pending+=("sudo grdctl --system rdp set-credentials   (usuario y clave con los que entra el celular)")
else
	echo "already enabled"
fi

step "data partition"
if dev="$(sudo blkid -L "$DATA_LABEL" 2>/dev/null)"; then
	uuid="$(sudo blkid -s UUID -o value "$dev")"
	if ! grep -q "$uuid" /etc/fstab; then
		sudo mkdir -p "$DATA_MOUNT"
		echo "UUID=$uuid $DATA_MOUNT ntfs3 uid=$(id -u),gid=$(id -g),windows_names,nofail 0 0" | sudo tee -a /etc/fstab >/dev/null
		sudo systemctl daemon-reload
		# ntfs3 refuses a volume Windows left hibernated: Fast Startup has to be off on that side.
		sudo mount "$DATA_MOUNT" || pending+=("montar $DATA_MOUNT: apagar Fast Startup en Windows y reintentar")
	fi
else
	echo "no partition labeled '$DATA_LABEL', skipped"
fi

step "harness"
bash "$REPO/install.sh"
node "$REPO/machine/settings.mjs"
# The global instructions: this machine's own copy if the data partition carries one (it names
# accounts and hosts, so it is not in this public repository), else the template.
if [[ ! -f "$HOME/.claude/CLAUDE.md" ]]; then
	own="$DATA_MOUNT/_migracion/claude-config/CLAUDE.linux.md"
	if [[ -f "$own" ]]; then cp "$own" "$HOME/.claude/CLAUDE.md"; else cp "$REPO/machine/CLAUDE.global.md" "$HOME/.claude/CLAUDE.md"; fi
fi
# Known marketplaces, nothing enabled: each repository enables its plugins (harness init).
for m in anthropics/claude-plugins-official Railly/skills mauriantolin/claude-harness; do
	claude plugin marketplace add "$m" >/dev/null 2>&1 || true
done

step "pending (run these yourself)"
pending+=(
	"claude   y adentro /login"
	"Chrome: un perfil por cuenta (Default, Casal Lab, Work, nomenclator.com.ar) e instalar la extension Claude in Chrome en cada uno"
	"perfil <nombre> login gh|vercel|neon|aws|gcloud   por cada perfil (ver ~/.claude/CLAUDE.md)"
	"completar la seccion 'Esta maquina' de ~/.claude/CLAUDE.md"
	"cd $REPO && npm run doctor"
)
for p in "${pending[@]}"; do printf '  - %s\n' "$p"; done
