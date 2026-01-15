FROM ipfs/kubo:v0.39.0

# Enforce private network
ENV LIBP2P_FORCE_PNET=1

# Use server profile for stability
ENV IPFS_PROFILE=server

# Copy swarm key to a permanent location in the image
COPY swarm.key /usr/local/share/ipfs/swarm.key

# Install startup script
COPY --chmod=0755 ipfs-startup.sh /container-init.d/001-config.sh
