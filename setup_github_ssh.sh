#!/bin/bash
# Generates an SSH key and configures git to use it for GitHub.
# Run from your terminal:  bash setup_github_ssh.sh

set -e

KEY="$HOME/.ssh/id_ed25519"

echo ""
echo "🔑 GitHub SSH Key Setup"
echo "──────────────────────"

# Generate key if it doesn't exist
if [ ! -f "$KEY" ]; then
  echo "Generating new SSH key..."
  mkdir -p ~/.ssh
  chmod 700 ~/.ssh
  ssh-keygen -t ed25519 -C "aitechuser2026@gmail.com" -f "$KEY" -N ""
else
  echo "SSH key already exists at $KEY"
fi

# Add to ssh-agent
echo ""
echo "Adding key to SSH agent..."
eval "$(ssh-agent -s)"
ssh-add "$KEY"

# Configure git to use SSH for GitHub
git config --global url."git@github.com:".insteadOf "https://github.com/"

echo ""
echo "✅ Your PUBLIC key (copy this and add it to GitHub):"
echo "──────────────────────────────────────────────────────"
cat "$KEY.pub"
echo "──────────────────────────────────────────────────────"
echo ""

# Copy to clipboard (macOS)
cat "$KEY.pub" | pbcopy
echo "📋 Public key copied to clipboard!"
echo ""
echo "Next steps:"
echo "  1. The key is already copied to your clipboard"
echo "  2. Go to: https://github.com/settings/ssh/new"
echo "  3. Title: My Mac"
echo "  4. Paste the key and click 'Add SSH key'"
echo "  5. Then run:  bash github_push.sh"
echo ""
