## GitHub SSH configuration

This repository is configured to use a **secondary GitHub account** when pushing over SSH.

- Host alias: `github-secondary`
- SSH key: `~/.ssh/id_ed25519_secondary`
- Remote URL: `git@github-secondary:RounakSingh3/knock_knock.git`

If you ever need to switch back to the primary account, update your SSH config so that the remote host uses `~/.ssh/id_ed25519` instead.

