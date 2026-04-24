FROM ipfs/kubo:v0.40.1

# Enforce private network
ENV LIBP2P_FORCE_PNET=1

# Use server profile for stability
ENV IPFS_PROFILE=server

# Copy swarm key to a permanent location in the image
COPY swarm.key /usr/local/share/ipfs/swarm.key

# Install startup script
# IPFS Kubo runs executable scripts from /container-init.d/ on container startup,
# so we place our configuration/init script there as 001-config.sh.
COPY --chmod=0755 ipfs-startup.sh /container-init.d/001-config.sh

# Create the shared peer metadata directory and ensure ownership so the ipfs user can write to it.
# Since we mount a volume here, Docker will copy these permissions to the volume on creation.
USER root
RUN mkdir -p /ipfs-peerdata && chown -R 1000:1000 /ipfs-peerdata
USER ipfs
