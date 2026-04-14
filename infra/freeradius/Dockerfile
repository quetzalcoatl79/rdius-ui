FROM freeradius/freeradius-server:3.2.8

# Copy custom clients config and SQL module config
COPY clients.conf /etc/freeradius/clients.conf
COPY mods-available/sql /etc/freeradius/mods-available/sql

# Enable the SQL module
RUN ln -sf /etc/freeradius/mods-available/sql /etc/freeradius/mods-enabled/sql

# Set proper ownership
RUN chown -R freerad:freerad \
    /etc/freeradius/clients.conf \
    /etc/freeradius/mods-available/sql
