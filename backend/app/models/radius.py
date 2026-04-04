# These models MAP to existing FreeRADIUS tables — they are never created or modified by Alembic
# Column names intentionally use PascalCase aliases to match the FreeRADIUS official schema
from sqlalchemy import BigInteger, CHAR, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase


class RadiusBase(DeclarativeBase):
    pass


class RadCheck(RadiusBase):
    __tablename__ = "radcheck"
    __table_args__ = {"schema": "radius"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column("UserName", String(64), nullable=False, default="")
    attribute = Column("Attribute", String(64), nullable=False, default="")
    op = Column(CHAR(2), nullable=False, default="==")
    value = Column("Value", String(253), nullable=False, default="")


class RadReply(RadiusBase):
    __tablename__ = "radreply"
    __table_args__ = {"schema": "radius"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column("UserName", String(64), nullable=False, default="")
    attribute = Column("Attribute", String(64), nullable=False, default="")
    op = Column(CHAR(2), nullable=False, default="=")
    value = Column("Value", String(253), nullable=False, default="")


class Nas(RadiusBase):
    __tablename__ = "nas"
    __table_args__ = {"schema": "radius"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    nasname = Column(Text, nullable=False)
    shortname = Column(Text)
    type = Column(Text, default="other")
    ports = Column(Integer)
    secret = Column(Text, nullable=False, default="secret")
    server = Column(Text)
    community = Column(Text)
    description = Column(Text)


class RadGroupCheck(RadiusBase):
    __tablename__ = "radgroupcheck"
    __table_args__ = {"schema": "radius"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    groupname = Column("GroupName", String(64), nullable=False, default="")
    attribute = Column("Attribute", String(64), nullable=False, default="")
    op = Column(CHAR(2), nullable=False, default=":=")
    value = Column("Value", String(253), nullable=False, default="")


class RadGroupReply(RadiusBase):
    __tablename__ = "radgroupreply"
    __table_args__ = {"schema": "radius"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    groupname = Column("GroupName", String(64), nullable=False, default="")
    attribute = Column("Attribute", String(64), nullable=False, default="")
    op = Column(CHAR(2), nullable=False, default=":=")
    value = Column("Value", String(253), nullable=False, default="")


class RadUserGroup(RadiusBase):
    __tablename__ = "radusergroup"
    __table_args__ = {"schema": "radius"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column("UserName", String(64), nullable=False, default="")
    groupname = Column("GroupName", String(64), nullable=False, default="")
    priority = Column(Integer, nullable=False, default=1)


class RadAcct(RadiusBase):
    __tablename__ = "radacct"
    __table_args__ = {"schema": "radius"}
    radacctid = Column("RadAcctId", BigInteger, primary_key=True, autoincrement=True)
    acct_session_id = Column("AcctSessionId", String(64), nullable=False, default="")
    acct_unique_id = Column("AcctUniqueId", String(32), nullable=False, default="")
    username = Column("UserName", String(64), nullable=False, default="")
    nas_ip_address = Column("NASIPAddress", Text, nullable=False, default="")
    acct_start_time = Column("AcctStartTime", DateTime(timezone=True))
    acct_stop_time = Column("AcctStopTime", DateTime(timezone=True), nullable=True)
    acct_session_time = Column("AcctSessionTime", Integer)
    acct_input_octets = Column("AcctInputOctets", BigInteger)
    acct_output_octets = Column("AcctOutputOctets", BigInteger)
    terminate_cause = Column("AcctTerminateCause", String(32), nullable=True)


class RadPostAuth(RadiusBase):
    __tablename__ = "radpostauth"
    __table_args__ = {"schema": "radius"}
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    username = Column("username", String(64), nullable=False)
    pass_ = Column("pass", String(64), nullable=False, default="")
    reply = Column("reply", String(32), nullable=False, default="")
    authdate = Column("authdate", DateTime(timezone=True), nullable=False)
