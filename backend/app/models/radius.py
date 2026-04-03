# These models MAP to existing FreeRADIUS tables — they are never created or modified by Alembic
# Column names intentionally use PascalCase aliases to match the FreeRADIUS official schema
from sqlalchemy import CHAR, Column, Integer, String, Text
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
