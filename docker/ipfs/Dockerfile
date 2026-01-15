FROM ipfs/kubo:v0.39.0

# Enforce private network
ENV LIBP2P_FORCE_PNET=1

# Use server profile for stability
ENV IPFS_PROFILE=server

# Install swarm key with correct permissions
COPY --chown=ipfs:ipfs swarm.key /data/ipfs/swarm.key

# Install startup script
COPY --chmod=0755 ipfs-startup.sh /container-init.d/001-config.sh
