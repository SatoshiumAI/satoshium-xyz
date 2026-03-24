# ⚙️ Installation & Local Development

This document explains how to run the **satoshium-xyz** repository locally for
development, testing, and experimentation.

The repository contains static simulation environments, prototype interfaces,
and experimental Labs modules supporting the Satoshium platform.

---

# 🧭 Requirements

To work with this repository locally, you need:

- Git
- a modern web browser
- a lightweight local server (optional but recommended)

No build system is required for most modules.

---

# 📥 Clone the Repository

Clone the repository:

git clone https://github.com/satoshiumai/satoshium-xyz.git

cd satoshium-xyz

---

# ▶️ Running Locally

Most Labs modules are static and can be opened directly:

labs/index.html

However, running a local server improves compatibility with navigation loaders
and shared components.

---

# 🌐 Recommended Local Server (Python)

Start a simple local server:

python -m http.server 8000

Then open:

http://localhost:8000/labs/

---

# 🧪 Testing Experimental Modules

Primary testing directories include:

/labs/demos/
/labs/simulations/
/labs/experiments/
/labs/research/

These modules may evolve frequently and are expected to change over time.

---

# 📡 Shared Component Dependencies

Some interfaces load shared platform components from:

https://satoshium.link/components/

Including:

topbar-loader.js
footer.html
sayings.js

An internet connection is required for these elements unless local mirrors are
configured.

---

# 🚧 Deployment Model

This repository is designed for static deployment using:

- GitHub Pages
- Replit exports
- lightweight static hosting environments
- future decentralized hosting layers (planned)

No server runtime is required.

---

# 🔬 Development Philosophy

The experimental layer supports:

concept
→ prototype
→ public experiment
→ refinement
→ migration or retirement

Local execution allows safe iteration before platform integration.

---

# 📘 Related Repositories

Experimental modules developed here may later migrate into:

satoshium.ai
satoshium.net
satoshium.info

depending on architectural maturity.

---

# 🧾 Status

Status: Active local development and deployment guide
