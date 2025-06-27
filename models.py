from sqlalchemy import Column, Integer, String, Text, DateTime
from db import Base
from datetime import datetime

class TerminalServer(Base):
    __tablename__ = "terminal_servers"
    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, index=True)  # ❌ Removed unique=True
    region = Column(String, index=True)
    dc = Column(String, index=True)
    building = Column(String, index=True)

class Device(Base):
    __tablename__ = "devices"
    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, index=True)  # ❌ Removed unique=True
    region = Column(String, index=True)
    dc = Column(String, index=True)
    building = Column(String, index=True)

class TSCredential(Base):
    __tablename__ = "ts_credentials"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, unique=True)
    username = Column(String)
    password = Column(String)

class DevCredential(Base):
    __tablename__ = "dev_credentials"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, unique=True)
    username = Column(String)
    password = Column(String)

class CommandTemplate(Base):
    __tablename__ = "command_templates"
    id = Column(Integer, primary_key=True, index=True)
    vendor = Column(String)
    command = Column(String)

class Region(Base):
    __tablename__ = "regions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, unique=True, index=True)

class CommandOutput(Base):
    __tablename__ = "command_outputs"
    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, index=True)
    command = Column(Text)
    output = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)