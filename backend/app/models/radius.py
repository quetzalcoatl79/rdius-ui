# These models MAP to existing FreeRADIUS tables — they are never created or modified by Alembic
# Python snake_case attributes → PostgreSQL lowercase columns (FreeRADIUS default behavior
# when identifiers are NOT quoted in CREATE TABLE).
from sqlalchemy import BigInteger, CHAR, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.dialects.postgresql import INET


class RadiusBase(DeclarativeBase):
    pass


class RadCheck(RadiusBase):
    __tablename__ = "radcheck"
    __table_args__ = {"schema": "radius"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column("username", String(64), nullable=False, default="")
    attribute = Column("attribute", String(64), nullable=False, default="")
    op = Column(CHAR(2), nullable=False, default="==")
    value = Column("value", String(253), nullable=False, default="")


class RadReply(RadiusBase):
    __tablename__ = "radreply"
    __table_args__ = {"schema": "radius"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column("username", String(64), nullable=False, default="")
    attribute = Column("attribute", String(64), nullable=False, default="")
    op = Column(CHAR(2), nullable=False, default="=")
    value = Column("value", String(253), nullable=False, default="")


class Nas(RadiusBase):
    __tablename__ = "nas"
    __table_args__ = {"schema": "radius"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    nasname = Column(String(128), nullable=False)
    shortname = Column(String(32))
    type = Column(String(30), default="other")
    ports = Column(Integer)
    secret = Column(String(60), nullable=False, default="secret")
    server = Column(String(64))
    community = Column(String(50))
    description = Column(String(200))


class RadGroupCheck(RadiusBase):
    __tablename__ = "radgroupcheck"
    __table_args__ = {"schema": "radius"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    groupname = Column("groupname", String(64), nullable=False, default="")
    attribute = Column("attribute", String(64), nullable=False, default="")
    op = Column(CHAR(2), nullable=False, default=":=")
    value = Column("value", String(253), nullable=False, default="")


class RadGroupReply(RadiusBase):
    __tablename__ = "radgroupreply"
    __table_args__ = {"schema": "radius"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    groupname = Column("groupname", String(64), nullable=False, default="")
    attribute = Column("attribute", String(64), nullable=False, default="")
    op = Column(CHAR(2), nullable=False, default=":=")
    value = Column("value", String(253), nullable=False, default="")


class RadUserGroup(RadiusBase):
    __tablename__ = "radusergroup"
    __table_args__ = {"schema": "radius"}
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column("username", String(64), nullable=False, default="")
    groupname = Column("groupname", String(64), nullable=False, default="")
    priority = Column(Integer, nullable=False, default=1)


class RadAcct(RadiusBase):
    __tablename__ = "radacct"
    __table_args__ = {"schema": "radius"}
    radacctid = Column("radacctid", BigInteger, primary_key=True, autoincrement=True)
    acct_session_id = Column("acctsessionid", String(64), nullable=False, default="")
    acct_unique_id = Column("acctuniqueid", String(32), nullable=False, default="")
    username = Column("username", String(64), nullable=False, default="")
    nas_ip_address = Column("nasipaddress", INET, nullable=False)
    acct_start_time = Column("acctstarttime", DateTime(timezone=True), nullable=True)
    acct_stop_time = Column("acctstoptime", DateTime(timezone=True), nullable=True)
    acct_session_time = Column("acctsessiontime", BigInteger)
    acct_input_octets = Column("acctinputoctets", BigInteger)
    acct_output_octets = Column("acctoutputoctets", BigInteger)
    terminate_cause = Column("acctterminatecause", String(32), nullable=True)


class RadPostAuth(RadiusBase):
    __tablename__ = "radpostauth"
    __table_args__ = {"schema": "radius"}
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    username = Column("username", String(64), nullable=False)
    pass_ = Column("pass", String(64), nullable=True)
    reply = Column("reply", String(32), nullable=True)
    authdate = Column("authdate", DateTime(timezone=True), nullable=False)
