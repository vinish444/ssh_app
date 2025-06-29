from fastapi import FastAPI, Request, Form, UploadFile, File, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Annotated
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import models
from gui_apps.ss.db import SessionLocal, engine
from gui_apps.ss.ssh_logic import execute_ssh_command, execute_direct_ssh_command
from gui_apps.ss.models import CommandOutput

ssh_app = FastAPI()
ssh_app.add_middleware(SessionMiddleware, secret_key="super-secret-key")
templates = Jinja2Templates(directory="templates")
ssh_app.mount("/static", StaticFiles(directory="static"), name="static")
models.Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def extract_unique_field(db, model, field, **kwargs):
    query = db.query(getattr(model, field))
    for k, v in kwargs.items():
        query = query.filter(getattr(model, k) == v)
    return sorted(set([r[0] for r in query.distinct().all() if r[0]]))

###################################### HOME PAGE ROUTES ######################################

@ssh_app.get("/", response_class=HTMLResponse)
def home(request: Request, db: Session = Depends(get_db)):
    for key in ["multi_ips", "mode", "direct", "ts_ip", "ts_user", "ts_pass", "dev_ip", "dev_user", "dev_pass", "selected_vendor"]:
        request.session.pop(key, None)

    ts_regions = db.query(models.TerminalServer.region).distinct().all()
    dev_regions = db.query(models.Device.region).distinct().all()
    region_titles = list(set(r[0] for r in ts_regions + dev_regions if r[0]))

    return templates.TemplateResponse("home.html", {
        "request": request,
        "region_titles": ["All"] + sorted(region_titles),
        "ts_creds": db.query(models.TSCredential).all(),
        "dev_creds": db.query(models.DevCredential).all(),
        "saved_ts_ips": [r[0] for r in db.query(models.TerminalServer.ip).distinct().all()],
        "saved_dev_ips": [r[0] for r in db.query(models.Device.ip).distinct().all()]
    })

@ssh_app.post("/connect")
def connect(request: Request, ts_ip: str = Form(...), dev_ip: str = Form(...), ts_cred: str = Form(...), dev_cred: str = Form(...), db: Session = Depends(get_db)):
    ts = db.query(models.TSCredential).filter_by(title=ts_cred).first()
    dev = db.query(models.DevCredential).filter_by(title=dev_cred).first()
    request.session.update({
        "ts_ip": ts_ip,
        "ts_user": ts.username,
        "ts_pass": ts.password,
        "dev_ip": dev_ip,
        "dev_user": dev.username,
        "dev_pass": dev.password,
        "direct": False,
        "multi_ips": [dev_ip],
        "mode": "single"
    })
    return RedirectResponse("/command", status_code=303)

@ssh_app.post("/connect-direct")
def connect_direct(request: Request, dev_ip: str = Form(...), dev_cred: str = Form(...), db: Session = Depends(get_db)):
    dev = db.query(models.DevCredential).filter_by(title=dev_cred).first()
    request.session.update({
        "dev_ip": dev_ip,
        "dev_user": dev.username,
        "dev_pass": dev.password,
        "direct": True,
        "multi_ips": request.session.get("multi_ips", [dev_ip]),
        "mode": "single"
    })
    return RedirectResponse("/command", status_code=303)

@ssh_app.post("/multi-connect")
async def multi_connect(request: Request, ts_ip: str = Form(...), ts_cred: str = Form(...), dev_cred: str = Form(...), multi_ips: List[str] = Form([]), device_ips: Optional[str] = Form(None), db: Session = Depends(get_db)):
    ts = db.query(models.TSCredential).filter_by(title=ts_cred).first()
    dev = db.query(models.DevCredential).filter_by(title=dev_cred).first()
    pasted_ips = [ip.strip() for ip in device_ips.strip().splitlines() if ip.strip()] if device_ips else []
    all_ips = list(set(multi_ips + pasted_ips))
    request.session.update({
        "ts_ip": ts_ip,
        "ts_user": ts.username,
        "ts_pass": ts.password,
        "dev_user": dev.username,
        "dev_pass": dev.password,
        "direct": False,
        "multi_ips": all_ips,
        "mode": "multi"
    })
    return RedirectResponse("/command", status_code=303)

@ssh_app.post("/multi-connect-direct")
def multi_connect_direct(request: Request, multi_ips: List[str] = Form([]), device_ips: Optional[str] = Form(None), dev_cred: str = Form(...), db: Session = Depends(get_db)):
    dev = db.query(models.DevCredential).filter_by(title=dev_cred).first()
    pasted_ips = [ip.strip() for ip in device_ips.strip().splitlines() if ip.strip()] if device_ips else []
    all_ips = list(set(multi_ips + pasted_ips))
    request.session.update({
        "multi_ips": all_ips,
        "direct": True,
        "dev_user": dev.username,
        "dev_pass": dev.password,
        "mode": "multi"
    })
    return RedirectResponse("/command", status_code=303)

###################################### COMMAND PAGE ROUTES ######################################

@ssh_app.get("/command", response_class=HTMLResponse)
def command_page(request: Request):
    return templates.TemplateResponse("command.html", {
        "request": request,
        "multi_ips": request.session.get("multi_ips", []),
        "selected_vendor": request.session.get("selected_vendor", ""),
        "output": {}
    })

@ssh_app.post("/run-command")
def run_command(request: Request, selected_ips: List[str] = Form(...), command: str = Form(...), template_title: str = Form(""), db: Session = Depends(get_db)):
    selected_ips = [ip for ip in selected_ips if ip != "__select_all__"]
    request.session["selected_vendor"] = template_title
    mode = request.session.get("mode")
    all_ips = request.session.get("multi_ips", []) if mode == "multi" else selected_ips
    all_ips = [ip for ip in all_ips if ip != "select_all"]

    def run_on_ip(ip):
        if request.session.get("direct"):
            return ip, execute_direct_ssh_command(ip, request.session["dev_user"], request.session["dev_pass"], command)
        else:
            return ip, execute_ssh_command(request.session["ts_ip"], request.session["ts_user"], request.session["ts_pass"], ip, request.session["dev_user"], request.session["dev_pass"], command)

    if selected_ips:
        with ThreadPoolExecutor(max_workers=10) as executor:
            results = dict(executor.map(run_on_ip, selected_ips))
        for ip, output in results.items():
            db.add(CommandOutput(ip=ip, command=command, output=output, timestamp=datetime.utcnow()))
        db.commit()

    output_dict = {}
    if mode == "multi":
        subq = db.query(CommandOutput.ip, func.max(CommandOutput.timestamp).label("latest")).filter(CommandOutput.ip.in_(all_ips)).group_by(CommandOutput.ip).subquery()
        recent_outputs = db.query(CommandOutput).join(subq, (CommandOutput.ip == subq.c.ip) & (CommandOutput.timestamp == subq.c.latest)).all()
        output_dict = {entry.ip: entry.output for entry in recent_outputs}
    else:
        for ip in selected_ips:
            latest = db.query(CommandOutput).filter_by(ip=ip).order_by(CommandOutput.timestamp.desc()).first()
            output_dict[ip] = latest.output if latest else ""

    return JSONResponse(content={"output_data": output_dict})

###################################### MANAGE PAGE ROUTES ######################################

@ssh_app.get("/manage", response_class=HTMLResponse)
def manage(request: Request, db: Session = Depends(get_db)):
    return templates.TemplateResponse("manage.html", {
        "request": request,
        "ts_region_titles": extract_unique_field(db, models.TerminalServer, "region"),
        "dev_region_titles": extract_unique_field(db, models.Device, "region"),
        "ts_creds": db.query(models.TSCredential).all(),
        "dev_creds": db.query(models.DevCredential).all(),
        "command_vendors": [v[0] for v in db.query(models.CommandTemplate.vendor).distinct().all()],
    })

@ssh_app.post("/add-ips")
def add_ips(region: str = Form(...), dc: str = Form(...), building: str = Form(...), ip_list: str = Form(""), file: UploadFile = File(None), target: str = Form(...), db: Session = Depends(get_db)):
    model = models.TerminalServer if target == "ts" else models.Device
    ips = ip_list.strip().splitlines()
    if file:
        ips += file.file.read().decode().strip().splitlines()
    added = 0
    for ip in ips:
        clean_ip = ip.strip()
        if not clean_ip:
            continue
        if not db.query(model).filter_by(ip=clean_ip, region=region.strip().lower(), dc=dc.strip().upper(), building=building.strip().upper()).first():
            db.add(model(ip=clean_ip, region=region.strip().lower(), dc=dc.strip().upper(), building=building.strip().upper()))
            added += 1
    db.commit()
    return RedirectResponse("/manage", status_code=303)

@ssh_app.post("/delete-ips")
def delete_ips(region: str = Form(...), dc: Optional[str] = Form(""), building: Optional[str] = Form(""), selected_ips: Optional[List[str]] = Form(None), target: str = Form(...), db: Session = Depends(get_db)):
    model = models.TerminalServer if target == "ts" else models.Device
    if selected_ips:
        for ip in selected_ips:
            db.query(model).filter_by(ip=ip.strip()).delete()
    elif building:
        db.query(model).filter_by(region=region, dc=dc, building=building).delete()
    elif dc:
        db.query(model).filter_by(region=region, dc=dc).delete()
    elif region:
        db.query(model).filter_by(region=region).delete()
    db.commit()
    return RedirectResponse("/manage", status_code=303)

@ssh_app.post("/add-cred")
def add_cred(title: str = Form(...), username: str = Form(...), password: str = Form(...), target: str = Form(...), db: Session = Depends(get_db)):
    model = models.TSCredential if target == "ts" else models.DevCredential
    if not db.query(model).filter_by(title=title).first():
        db.add(model(title=title, username=username, password=password))
    db.commit()
    return RedirectResponse("/manage", status_code=303)

@ssh_app.post("/delete-creds")
def delete_creds(cred_titles: Annotated[List[str], Form(alias="cred_titles[]")], target: str = Form(...), db: Session = Depends(get_db)):
    model = models.TSCredential if target == "ts" else models.DevCredential
    for title in cred_titles:
        db.query(model).filter_by(title=title).delete()
    db.commit()
    return RedirectResponse("/manage", status_code=303)

@ssh_app.get("/get-commands")
def get_commands(vendor: str, db: Session = Depends(get_db)):
    return [{"id": c.id, "command": c.command} for c in db.query(models.CommandTemplate).filter_by(vendor=vendor.strip().lower()).all()]

@ssh_app.post("/add-commands")
def add_commands(vendor: str = Form(...), cmd_text: str = Form(""), file: UploadFile = File(None), db: Session = Depends(get_db)):
    vendor = vendor.strip().lower()
    commands = set()
    if cmd_text:
        commands.update(cmd.strip().lower() for cmd in cmd_text.strip().splitlines() if cmd.strip())
    if file:
        commands.update(cmd.strip().lower() for cmd in file.file.read().decode().strip().splitlines() if cmd.strip())
    existing_cmds = set(c.command.strip().lower() for c in db.query(models.CommandTemplate).filter_by(vendor=vendor).all())
    for cmd in commands - existing_cmds:
        db.add(models.CommandTemplate(vendor=vendor, command=cmd))
    db.commit()
    return RedirectResponse("/manage", status_code=303)

@ssh_app.post("/delete-commands")
def delete_commands(vendor: str = Form(""), cmd_ids: List[int] = Form(None), db: Session = Depends(get_db)):
    if cmd_ids:
        for cid in cmd_ids:
            db.query(models.CommandTemplate).filter_by(id=cid).delete()
    elif vendor:
        db.query(models.CommandTemplate).filter_by(vendor=vendor).delete()
    db.commit()
    return RedirectResponse("/manage", status_code=303)

###################################### CASCADING DROPDOWNS ######################################

@ssh_app.get("/get-dcs")
def get_dcs(region: str, target: str, db: Session = Depends(get_db)):
    model = models.TerminalServer if target == "ts" else models.Device
    return JSONResponse(extract_unique_field(db, model, "dc", region=region))

@ssh_app.get("/get-buildings")
def get_buildings(region: str, dc: str, target: str, db: Session = Depends(get_db)):
    model = models.TerminalServer if target == "ts" else models.Device
    return JSONResponse(extract_unique_field(db, model, "building", region=region, dc=dc))

@ssh_app.get("/get-ips")
def get_ips(region: str, dc: str, building: str, target: str, db: Session = Depends(get_db)):
    model = models.TerminalServer if target == "ts" else models.Device
    filters = {}
    if region != "All": filters["region"] = region
    if dc != "All": filters["dc"] = dc
    if building != "All": filters["building"] = building
    return JSONResponse(sorted(set(extract_unique_field(db, model, "ip", **filters))))

@ssh_app.get("/get-template-titles")
def get_template_titles(db: Session = Depends(get_db)):
    return [v[0] for v in db.query(models.CommandTemplate.vendor).distinct().all() if v[0]]
