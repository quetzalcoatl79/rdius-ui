# Use the official FreeRADIUS image which includes radclient
FROM freeradius/freeradius-server:3.2.8

# Install bash for the script
USER root
RUN apt-get update && apt-get install -y bash bc && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY generate-traffic.sh /app/generate-traffic.sh
RUN chmod +x /app/generate-traffic.sh

# Override default freeradius command
ENTRYPOINT []
CMD ["/app/generate-traffic.sh"]
