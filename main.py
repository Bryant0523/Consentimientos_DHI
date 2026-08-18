"""
Sistema de Consentimientos Médicos - ConsentimientosApp Dhi
Backend Flask con interfaz web moderna
"""
import os
import sys
import json
import csv
import shutil
import threading
import webbrowser
import sqlite3
import requests
from pathlib import Path
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for
from werkzeug.utils import secure_filename
import signal


# ─── Rutas base ─────────────────────────────────────────────────────────────
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).parent

DATA_DIR       = BASE_DIR / "data"
FIRMAS_DIR     = DATA_DIR / "firmas"
TEMPLATES_DIR  = BASE_DIR / "app_templates"
OUTPUT_DIR     = BASE_DIR / "output"
CONFIG_PATH    = DATA_DIR / "config.json"
MEDICOS_CSV    = DATA_DIR / "medicos.csv"
ENFERMEROS_CSV = DATA_DIR / "enfermeros.csv"
HISTORIAL_CSV  = DATA_DIR / "historial.csv"
APP_VERSION = "2.5.0"  # ← actualiza esto en cada release que publiques
GITHUB_OWNER = "Bryant0523"      # USUARIO GITHUB
GITHUB_REPO  = "https://github.com/Bryant0523/Consentimientos_DHI.git"  # ← REPO de tu proyecto en GitHub

for p in [DATA_DIR, FIRMAS_DIR, TEMPLATES_DIR, OUTPUT_DIR]:
    p.mkdir(parents=True, exist_ok=True)

# ─── Config ─────────────────────────────────────────────────────────────────
DEFAULT_CONFIG = {
    "output_folder": str(OUTPUT_DIR),
    "admin_password": "admin",
    "signature_reuse_days": 1,
    "export_pdf": True,
    "export_docx": True,
    "hospital_name": "Dhi Restauracion Capilar",
    "appearance": "dark"
}

def load_config():
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                for k, v in DEFAULT_CONFIG.items():
                    cfg.setdefault(k, v)
                return cfg
        except:
            pass
    save_config(DEFAULT_CONFIG)
    return dict(DEFAULT_CONFIG)

def save_config(cfg):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=4, ensure_ascii=False)

# ─── CSV helpers ────────────────────────────────────────────────────────────
def read_csv(path):
    for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            with open(path, "r", encoding=enc, newline="") as f:
                reader = csv.DictReader(f)
                rows = [row for row in reader]
            return rows
        except Exception:
            continue
    return []

def write_csv(path, rows, fieldnames):
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

def ensure_csv(path, fieldnames):
    if not path.exists():
        write_csv(path, [], fieldnames)

ensure_csv(MEDICOS_CSV,    ["nombre", "cedula", "firma"])
ensure_csv(ENFERMEROS_CSV, ["nombre", "cedula", "firma"])
ensure_csv(HISTORIAL_CSV,  ["fecha", "hora", "paciente", "documento", "procedimiento", "medico", "enfermero", "archivo_pdf"])

# ─── Pacientes (SQLite) ───────────────────────────────────────────────────
PATIENTS_DB = DATA_DIR / "pacientes.db"

def _row_to_dict(cursor, row):
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}

def get_db_conn():
    conn = sqlite3.connect(str(PATIENTS_DB))
    conn.row_factory = _row_to_dict
    return conn

def init_pacientes_table():
    PATIENTS_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        # Tabla principal de pacientes
        cur.execute('''
            CREATE TABLE IF NOT EXISTS pacientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                cedula TEXT NOT NULL UNIQUE,
                fecha_nacimiento TEXT,
                lugar_expedicion TEXT,
                direccion TEXT,
                telefono TEXT,
                email TEXT,
                firma TEXT,
                es_menor INTEGER DEFAULT 0
            )
        ''')
        # Tabla de acudientes vinculados a pacientes menores
        cur.execute('''
            CREATE TABLE IF NOT EXISTS acudientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                paciente_id INTEGER NOT NULL,
                nombre TEXT NOT NULL,
                cedula TEXT NOT NULL,
                parentesco TEXT,
                lugar_expedicion TEXT,
                firma TEXT,
                FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
            )
        ''')
        # Agregar columna es_menor si no existe (migración)
        try:
            cur.execute("ALTER TABLE pacientes ADD COLUMN es_menor INTEGER DEFAULT 0")
        except:
            pass
        conn.commit()
    finally:
        conn.close()

init_pacientes_table()

# ─── Historial ───────────────────────────────────────────────────────────────
def agregar_historial(paciente, documento, procedimiento, medico, enfermero, archivo_pdf):
    now = datetime.now()
    rows = read_csv(HISTORIAL_CSV) if HISTORIAL_CSV.exists() else []
    rows.append({
        "fecha":        now.strftime("%Y-%m-%d"),
        "hora":         now.strftime("%H:%M:%S"),
        "paciente":     paciente,
        "documento":    documento,
        "procedimiento": procedimiento,
        "medico":       medico,
        "enfermero":    enfermero,
        "archivo_pdf":  archivo_pdf
    })
    write_csv(HISTORIAL_CSV, rows, ["fecha", "hora", "paciente", "documento", "procedimiento", "medico", "enfermero", "archivo_pdf"])

def limpiar_historial_auto():
    if not HISTORIAL_CSV.exists():
        return
    rows = read_csv(HISTORIAL_CSV)
    cutoff = datetime.now() - timedelta(days=90)
    filtered = []
    for r in rows:
        try:
            dt = datetime.strptime(r.get("fecha", ""), "%Y-%m-%d")
            if dt >= cutoff:
                filtered.append(r)
        except:
            filtered.append(r)
    write_csv(HISTORIAL_CSV, filtered, ["fecha", "hora", "paciente", "documento", "procedimiento", "medico", "enfermero", "archivo_pdf"])

# ─── Flask app ───────────────────────────────────────────────────────────────
app = Flask(__name__,
            template_folder=str(BASE_DIR / "templates"),
            static_folder=str(BASE_DIR / "static"))
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB

# ─── Rutas principales ───────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html", config=load_config())

@app.route("/api/config", methods=["GET"])
def api_get_config():
    return jsonify(load_config())

@app.route("/api/config", methods=["POST"])
def api_save_config():
    data = request.json
    cfg = load_config()
    cfg.update(data)
    save_config(cfg)
    return jsonify({"ok": True})

# ─── Médicos y Enfermeros ────────────────────────────────────────────────────
@app.route("/api/medicos", methods=["GET"])
def api_get_medicos():
    return jsonify(read_csv(MEDICOS_CSV))

@app.route("/api/medicos", methods=["POST"])
def api_add_medico():
    data = request.json
    rows = read_csv(MEDICOS_CSV)
    rows.append({"nombre": data["nombre"], "cedula": data["cedula"], "firma": data.get("firma", "")})
    write_csv(MEDICOS_CSV, rows, ["nombre", "cedula", "firma"])
    return jsonify({"ok": True})

@app.route("/api/medicos/<int:idx>", methods=["PUT"])
def api_edit_medico(idx):
    data = request.json
    rows = read_csv(MEDICOS_CSV)
    if 0 <= idx < len(rows):
        rows[idx] = {"nombre": data["nombre"], "cedula": data["cedula"], "firma": data.get("firma", rows[idx].get("firma",""))}
        write_csv(MEDICOS_CSV, rows, ["nombre", "cedula", "firma"])
    return jsonify({"ok": True})

@app.route("/api/medicos/<int:idx>", methods=["DELETE"])
def api_del_medico(idx):
    rows = read_csv(MEDICOS_CSV)
    if 0 <= idx < len(rows):
        rows.pop(idx)
        write_csv(MEDICOS_CSV, rows, ["nombre", "cedula", "firma"])
    return jsonify({"ok": True})

@app.route("/api/enfermeros", methods=["GET"])
def api_get_enfermeros():
    return jsonify(read_csv(ENFERMEROS_CSV))

@app.route("/api/enfermeros", methods=["POST"])
def api_add_enfermero():
    data = request.json
    rows = read_csv(ENFERMEROS_CSV)
    rows.append({"nombre": data["nombre"], "cedula": data["cedula"], "firma": data.get("firma", "")})
    write_csv(ENFERMEROS_CSV, rows, ["nombre", "cedula", "firma"])
    return jsonify({"ok": True})

@app.route("/api/enfermeros/<int:idx>", methods=["PUT"])
def api_edit_enfermero(idx):
    data = request.json
    rows = read_csv(ENFERMEROS_CSV)
    if 0 <= idx < len(rows):
        rows[idx] = {"nombre": data["nombre"], "cedula": data["cedula"], "firma": data.get("firma", rows[idx].get("firma",""))}
        write_csv(ENFERMEROS_CSV, rows, ["nombre", "cedula", "firma"])
    return jsonify({"ok": True})

@app.route("/api/enfermeros/<int:idx>", methods=["DELETE"])
def api_del_enfermero(idx):
    rows = read_csv(ENFERMEROS_CSV)
    if 0 <= idx < len(rows):
        rows.pop(idx)
        write_csv(ENFERMEROS_CSV, rows, ["nombre", "cedula", "firma"])
    return jsonify({"ok": True})

# ─── Pacientes API (CRUD + búsqueda) ─────────────────────────────────────────
@app.route("/api/pacientes", methods=["GET"])
def api_get_pacientes():
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM pacientes ORDER BY nombre COLLATE NOCASE")
        rows = cur.fetchall()
        return jsonify(rows)
    finally:
        conn.close()

@app.route("/api/pacientes/<int:pid>", methods=["GET"])
def api_get_paciente(pid):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM pacientes WHERE id = ?", (pid,))
        row = cur.fetchone()
        if not row:
            return jsonify({}), 404
        # Incluir acudiente si es menor
        if row.get("es_menor"):
            cur.execute("SELECT * FROM acudientes WHERE paciente_id = ? ORDER BY id DESC LIMIT 1", (pid,))
            acudiente = cur.fetchone()
            row["acudiente"] = acudiente
        return jsonify(row)
    finally:
        conn.close()

@app.route("/api/pacientes/search", methods=["GET"])
def api_search_pacientes():
    q = (request.args.get("q") or "").strip()
    cedula = (request.args.get("cedula") or "").strip()
    nombre = (request.args.get("nombre") or "").strip()
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        if q:
            pattern = f"%{q}%"
            cur.execute(
                "SELECT * FROM pacientes WHERE cedula LIKE ? COLLATE NOCASE OR nombre LIKE ? COLLATE NOCASE",
                (pattern, pattern),
            )
            rows = cur.fetchall()
        elif cedula:
            cur.execute("SELECT * FROM pacientes WHERE cedula LIKE ? COLLATE NOCASE", (f"%{cedula}%",))
            rows = cur.fetchall()
        elif nombre:
            pattern = f"%{nombre}%"
            cur.execute("SELECT * FROM pacientes WHERE nombre LIKE ? COLLATE NOCASE", (pattern,))
            rows = cur.fetchall()
        else:
            return jsonify([])
        # Enriquecer con acudiente si es menor
        for row in rows:
            if row.get("es_menor"):
                cur.execute("SELECT * FROM acudientes WHERE paciente_id = ? ORDER BY id DESC LIMIT 1", (row["id"],))
                row["acudiente"] = cur.fetchone()
        return jsonify(rows)
    finally:
        conn.close()

@app.route("/api/pacientes", methods=["POST"])
def api_add_paciente():
    data = request.json or {}
    nombre   = (data.get("nombre") or "").strip()
    cedula   = (data.get("cedula") or "").strip()
    es_menor = 1 if data.get("es_menor") else 0

    if not nombre or not cedula:
        return jsonify({"error": "nombre y cedula son requeridos"}), 400

    conn = get_db_conn()
    try:
        cur = conn.cursor()
        # Si ya existe por cédula, devolver registro existente
        cur.execute("SELECT * FROM pacientes WHERE cedula = ?", (cedula,))
        existing = cur.fetchone()
        if existing:
            # Enriquecer con acudiente si es menor
            if existing.get("es_menor"):
                cur.execute("SELECT * FROM acudientes WHERE paciente_id = ? ORDER BY id DESC LIMIT 1", (existing["id"],))
                existing["acudiente"] = cur.fetchone()
            return jsonify({"ok": True, "exists": True, "paciente": existing})

        cur.execute(
            """INSERT INTO pacientes
               (nombre, cedula, fecha_nacimiento, lugar_expedicion, direccion, telefono, email, firma, es_menor)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                nombre,
                cedula,
                data.get("fecha_nacimiento"),
                data.get("lugar_expedicion"),
                data.get("direccion"),
                data.get("telefono"),
                data.get("email"),
                data.get("firma"),
                es_menor,
            )
        )
        conn.commit()
        new_id = cur.lastrowid

        # Guardar acudiente si viene en el payload
        acudiente_data = data.get("acudiente")
        if es_menor and acudiente_data and acudiente_data.get("nombre") and acudiente_data.get("cedula"):
            cur.execute(
                """INSERT INTO acudientes (paciente_id, nombre, cedula, parentesco, lugar_expedicion, firma)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    new_id,
                    acudiente_data.get("nombre", "").strip(),
                    acudiente_data.get("cedula", "").strip(),
                    acudiente_data.get("parentesco", "").strip(),
                    acudiente_data.get("lugar_expedicion", "").strip(),
                    acudiente_data.get("firma", ""),
                )
            )
            conn.commit()

        cur.execute("SELECT * FROM pacientes WHERE id = ?", (new_id,))
        nuevo = cur.fetchone()
        if nuevo.get("es_menor"):
            cur.execute("SELECT * FROM acudientes WHERE paciente_id = ? ORDER BY id DESC LIMIT 1", (new_id,))
            nuevo["acudiente"] = cur.fetchone()

        return jsonify({"ok": True, "exists": False, "paciente": nuevo})
    finally:
        conn.close()

@app.route("/api/pacientes/<int:pid>", methods=["PUT"])
def api_edit_paciente(pid):
    data = request.json or {}
    es_menor = 1 if data.get("es_menor") else 0
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM pacientes WHERE id = ?", (pid,))
        if not cur.fetchone():
            return jsonify({"error": "not found"}), 404
        cur.execute(
            """UPDATE pacientes
               SET nombre=?, cedula=?, fecha_nacimiento=?, lugar_expedicion=?,
                   direccion=?, telefono=?, email=?, firma=?, es_menor=?
               WHERE id=?""",
            (
                data.get("nombre"),
                data.get("cedula"),
                data.get("fecha_nacimiento"),
                data.get("lugar_expedicion"),
                data.get("direccion"),
                data.get("telefono"),
                data.get("email"),
                data.get("firma"),
                es_menor,
                pid,
            )
        )
        # Actualizar acudiente si viene
        acudiente_data = data.get("acudiente")
        if es_menor and acudiente_data and acudiente_data.get("nombre") and acudiente_data.get("cedula"):
            cur.execute("SELECT id FROM acudientes WHERE paciente_id = ? ORDER BY id DESC LIMIT 1", (pid,))
            existing_ac = cur.fetchone()
            if existing_ac:
                cur.execute(
                    """UPDATE acudientes SET nombre=?, cedula=?, parentesco=?, lugar_expedicion=?, firma=?
                       WHERE id=?""",
                    (
                        acudiente_data.get("nombre", "").strip(),
                        acudiente_data.get("cedula", "").strip(),
                        acudiente_data.get("parentesco", "").strip(),
                        acudiente_data.get("lugar_expedicion", "").strip(),
                        acudiente_data.get("firma", ""),
                        existing_ac["id"],
                    )
                )
            else:
                cur.execute(
                    """INSERT INTO acudientes (paciente_id, nombre, cedula, parentesco, lugar_expedicion, firma)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        pid,
                        acudiente_data.get("nombre", "").strip(),
                        acudiente_data.get("cedula", "").strip(),
                        acudiente_data.get("parentesco", "").strip(),
                        acudiente_data.get("lugar_expedicion", "").strip(),
                        acudiente_data.get("firma", ""),
                    )
                )
        conn.commit()
        cur.execute("SELECT * FROM pacientes WHERE id = ?", (pid,))
        updated = cur.fetchone()
        if updated.get("es_menor"):
            cur.execute("SELECT * FROM acudientes WHERE paciente_id = ? ORDER BY id DESC LIMIT 1", (pid,))
            updated["acudiente"] = cur.fetchone()
        return jsonify({"ok": True, "paciente": updated})
    finally:
        conn.close()

@app.route("/api/pacientes/<int:pid>", methods=["DELETE"])
def api_del_paciente(pid):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM acudientes WHERE paciente_id = ?", (pid,))
        cur.execute("DELETE FROM pacientes WHERE id = ?", (pid,))
        conn.commit()
        return jsonify({"ok": True})
    finally:
        conn.close()

# ─── Acudiente API (directo por paciente) ────────────────────────────────────
@app.route("/api/pacientes/<int:pid>/acudiente", methods=["GET"])
def api_get_acudiente(pid):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM acudientes WHERE paciente_id = ? ORDER BY id DESC LIMIT 1", (pid,))
        row = cur.fetchone()
        return jsonify(row or {})
    finally:
        conn.close()

# ─── Firma upload ────────────────────────────────────────────────────────────
@app.route("/api/upload-firma", methods=["POST"])
def upload_firma():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400
    fname = secure_filename(file.filename)
    dest = FIRMAS_DIR / fname
    file.save(str(dest))
    return jsonify({"filename": fname, "ok": True})

@app.route("/api/firma-img/<filename>")
def get_firma_img(filename):
    path = FIRMAS_DIR / secure_filename(filename)
    if path.exists():
        return send_file(str(path))
    return "", 404

# ─── Plantillas ──────────────────────────────────────────────────────────────
@app.route("/api/plantillas", methods=["GET"])
def api_plantillas():
    categorias = {}
    for categoria_dir in TEMPLATES_DIR.iterdir():
        if not categoria_dir.is_dir():
            continue
        plantillas = []
        for archivo in categoria_dir.glob("*.docx"):
            plantillas.append(archivo.stem)
        categorias[categoria_dir.name] = sorted(plantillas)
    return jsonify(categorias)

@app.route("/api/plantillas-debug")
def api_plantillas_debug():
    info = {
        "templates_dir": str(TEMPLATES_DIR),
        "exists": TEMPLATES_DIR.exists(),
        "all_files": [str(f.relative_to(TEMPLATES_DIR))
                     for f in TEMPLATES_DIR.rglob("*")
                     if f.is_file()],
        "docx_files": [str(f.relative_to(TEMPLATES_DIR))
                      for f in TEMPLATES_DIR.rglob("*.docx")]
    }
    return jsonify(info)

@app.route("/api/pdf-status", methods=["GET"])
def api_pdf_status():
    import shutil as sh
    soffice = _encontrar_soffice()
    word_ok = False
    try:
        from docx2pdf import convert
        import subprocess
        if os.name == 'nt':
            r = subprocess.run(
                ['reg', 'query', r'HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\WINWORD.EXE'],
                capture_output=True)
            word_ok = r.returncode == 0
        else:
            word_ok = bool(sh.which("soffice"))
    except:
        pass
    return jsonify({
        "libreoffice": soffice or None,
        "word": word_ok,
        "can_convert": bool(soffice) or word_ok,
        "recommendation": (
            "LibreOffice disponible ✓" if soffice else
            "Microsoft Word disponible ✓" if word_ok else
            "⚠ Instala LibreOffice para exportar PDF con diseño completo: https://www.libreoffice.org/download/"
        )
    })

# ─── Generación de consentimiento ────────────────────────────────────────────
@app.route("/api/generar", methods=["POST"])
def api_generar():
    try:
        from docxtpl import DocxTemplate, InlineImage
        from docx.shared import Mm
    except ImportError:
        return jsonify({"error": "Librería docxtpl no instalada"}), 500

    data = request.json
    cfg  = load_config()

    for campo in ("paciente", "cedula_paciente", "procedimiento"):
        if not data.get(campo, "").strip():
            return jsonify({"error": f"Campo requerido: {campo}"}), 400

    plantilla_nombre = data.get("procedimiento", "").strip()

    import unicodedata
    def _norm(s):
        s = unicodedata.normalize("NFD", s.lower())
        return "".join(c for c in s if unicodedata.category(c) != "Mn")
    
    def _formatear_fecha(valor):
        """Convierte 'yyyy-mm-dd' (input type=date) a 'dd/mm/aaaa'."""
        if not valor:
            return None
        try:
            return datetime.strptime(valor, "%Y-%m-%d").strftime("%d/%m/%Y")
        except (ValueError, TypeError):
            return None
    
    def find_template(nombre):
        p = TEMPLATES_DIR / f"{nombre}.docx"
        if p.exists(): return p
        nombre_n = _norm(nombre)
        todos = list(TEMPLATES_DIR.rglob("*.docx"))
        for f in todos:
            if _norm(f.stem) == nombre_n: return f
        for f in todos:
            if nombre_n in _norm(f.stem): return f
        return None

    plantilla_path = find_template(plantilla_nombre)
    if not plantilla_path:
        disponibles = [f.stem for f in TEMPLATES_DIR.rglob("*.docx")]
        return jsonify({"error": f"Plantilla not found. Disponibles: {disponibles}"}), 404

    try:
        tpl = DocxTemplate(str(plantilla_path))
    except Exception as e:
        return jsonify({"error": f"No se pudo abrir plantilla: {e}"}), 500

    def get_firma_inline(nombre_firma):
        if not nombre_firma:
            return None
        path = FIRMAS_DIR / nombre_firma
        if not path.exists():
            return None
        try:
            return InlineImage(tpl, str(path), width=Mm(28), height=Mm(14))
        except:
            return None

    medicos = read_csv(MEDICOS_CSV)
    doctor_input = (data.get("doctor", "") or "").strip().lower()
    doctor_data = next(
        (m for m in medicos if m["nombre"].strip().lower() == doctor_input), {}
    )

    enfermeros = read_csv(ENFERMEROS_CSV)
    enf_input = (data.get("enfermero", "") or "").strip().lower()
    enf_data = next(
        (e for e in enfermeros if e["nombre"].strip().lower() == enf_input), {}
    )

    # Datos de acudiente (pueden venir del paciente seleccionado o del payload directo)
    acudiente = data.get("acudiente") or {}

    ctx = {
        "paciente":                  data.get("paciente", ""),
        "cedula_paciente":           data.get("cedula_paciente", ""),
        "lugar_expedicion_paciente": data.get("lugar_expedicion_paciente", "Barranquilla"),
        "firma_paciente":            get_firma_inline(data.get("firma_paciente_file", "")),
        "doctor":                    doctor_data.get("nombre", data.get("doctor", "")),
        "cedula_doctor":             doctor_data.get("cedula", ""),
        "firma_doctor":              get_firma_inline(doctor_data.get("firma", "")),
        "enfermero":                 enf_data.get("nombre", data.get("enfermero", "")),
        "cedula_enfermero":          enf_data.get("cedula", ""),
        "firma_enfermero":           get_firma_inline(enf_data.get("firma", "")),
        "fecha":                     _formatear_fecha(data.get("fecha")) or datetime.now().strftime("%d/%m/%Y"),
        # Menor de edad — puede venir inline o desde el paciente seleccionado
        "menor_nombre":              data.get("menor_nombre", ""),
        "cedula_menor":              data.get("cedula_menor", ""),
        "lugar_expedicion_menor":    data.get("lugar_expedicion_menor", ""),
        "firma_menor":               get_firma_inline(data.get("firma_menor_file", "")),
        # Acudiente
        "acudiente_nombre":          acudiente.get("nombre", data.get("acudiente_nombre", "")),
        "cedula_acudiente":          acudiente.get("cedula", data.get("cedula_acudiente", "")),
        "parentesco_acudiente":      acudiente.get("parentesco", data.get("parentesco_acudiente", "")),
        "lugar_expedicion_acudiente": acudiente.get("lugar_expedicion", data.get("lugar_expedicion_acudiente", "")),
        "firma_acudiente":           get_firma_inline(acudiente.get("firma", data.get("firma_acudiente_file", ""))),
    }

    try:
        tpl.render(ctx)
    except Exception as e:
        return jsonify({"error": f"Error al renderizar plantilla: {e}"}), 500

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    pac_slug  = data["paciente"].replace(" ", "_")
    proc_slug = plantilla_nombre.replace(" ", "_")
    out_folder = Path(cfg["output_folder"]) / proc_slug
    out_folder.mkdir(parents=True, exist_ok=True)

    docx_path = out_folder / f"{pac_slug}_{proc_slug}_{ts}.docx"
    pdf_path  = out_folder / f"{pac_slug}_{proc_slug}_{ts}.pdf"

    try:
        tpl.save(str(docx_path))
    except Exception as e:
        return jsonify({"error": f"No se pudo guardar el .docx: {e}"}), 500

    pdf_ok    = False
    pdf_file  = ""
    pdf_error = ""
    if cfg.get("export_pdf", True):
        pdf_ok, pdf_file, pdf_error = convertir_a_pdf(docx_path, pdf_path)

    if not cfg.get("export_docx", True):
        try:
            docx_path.unlink()
        except:
            pass

    agregar_historial(
        data["paciente"], data.get("cedula_paciente", ""),
        plantilla_nombre,
        doctor_data.get("nombre", data.get("doctor", "")),
        enf_data.get("nombre", data.get("enfermero", "")),
        pdf_file
    )

    return jsonify({
        "ok":        True,
        "docx":      str(docx_path) if cfg.get("export_docx", True) else "",
        "pdf":       pdf_file,
        "pdf_ok":    pdf_ok,
        "pdf_error": pdf_error,
        "message":   f"Consentimiento '{plantilla_path.stem}' creado exitosamente."
    })

def convertir_a_pdf(docx_path: Path, pdf_path: Path):
    import subprocess, shutil

    soffice = _encontrar_soffice()
    if soffice:
        try:
            out_dir = str(pdf_path.parent)
            result = subprocess.run(
                [soffice, "--headless", "--convert-to", "pdf",
                 "--outdir", out_dir, str(docx_path)],
                capture_output=True, text=True, timeout=60
            )
            lo_pdf = pdf_path.parent / (docx_path.stem + ".pdf")
            if lo_pdf.exists():
                if lo_pdf != pdf_path:
                    shutil.move(str(lo_pdf), str(pdf_path))
                return True, str(pdf_path), ""
            return False, "", f"LibreOffice no generó el PDF. stderr: {result.stderr[:200]}"
        except subprocess.TimeoutExpired:
            return False, "", "LibreOffice tardó demasiado (timeout 60s)"
        except Exception:
            pass

    try:
        from docx2pdf import convert
        convert(str(docx_path), str(pdf_path))
        if pdf_path.exists():
            return True, str(pdf_path), ""
        return False, "", "docx2pdf no generó el archivo"
    except Exception as e:
        err = str(e)

    msg = ("No se encontró LibreOffice ni Microsoft Word. "
           "Instala LibreOffice (gratuito) para exportar PDF.")
    return False, "", msg


def _encontrar_soffice():
    import os, glob, shutil as sh
    exe = sh.which("soffice") or sh.which("libreoffice")
    if exe:
        return exe
    for patron in [r"C:\Program Files\LibreOffice*\program\soffice.exe",
                   r"C:\Program Files (x86)\LibreOffice*\program\soffice.exe"]:
        matches = glob.glob(patron)
        if matches:
            return matches[0]
    rutas_win = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]
    for p in rutas_win:
        if os.path.isfile(p):
            return p
    return None


# ─── Historial API ───────────────────────────────────────────────────────────
@app.route("/api/historial", methods=["GET"])
def api_historial():
    rows = read_csv(HISTORIAL_CSV) if HISTORIAL_CSV.exists() else []
    return jsonify(list(reversed(rows)))

@app.route("/api/historial/<int:idx>", methods=["DELETE"])
def api_del_historial(idx):
    rows = read_csv(HISTORIAL_CSV) if HISTORIAL_CSV.exists() else []
    rows_rev = list(reversed(rows))
    if 0 <= idx < len(rows_rev):
        rows_rev.pop(idx)
        rows = list(reversed(rows_rev))
        write_csv(HISTORIAL_CSV, rows, ["fecha","hora","paciente","documento","procedimiento","medico","enfermero","archivo_pdf"])
    return jsonify({"ok": True})

@app.route("/api/historial/clear", methods=["POST"])
def api_clear_historial():
    write_csv(HISTORIAL_CSV, [], ["fecha","hora","paciente","documento","procedimiento","medico","enfermero","archivo_pdf"])
    return jsonify({"ok": True})

@app.route("/api/historial/abrir/<int:idx>", methods=["GET"])
def api_abrir_pdf(idx):
    rows = list(reversed(read_csv(HISTORIAL_CSV))) if HISTORIAL_CSV.exists() else []
    if 0 <= idx < len(rows):
        path = rows[idx].get("archivo_pdf", "")
        if path and Path(path).exists():
            return send_file(path, as_attachment=False)
    return jsonify({"error": "Archivo no encontrado"}), 404

@app.route("/api/historial/export", methods=["GET"])
def api_export_historial():
    if HISTORIAL_CSV.exists():
        return send_file(str(HISTORIAL_CSV), as_attachment=True, download_name="historial.csv")
    return jsonify({"error": "Sin historial"}), 404

@app.route('/api/salir', methods=['POST'])
def api_salir():
    def cerrar():
        os._exit(0)
    threading.Timer(1, cerrar).start()
    return jsonify({"ok": True})

@app.route("/api/debug-medicos")
def debug_medicos():
    return jsonify({
        "ruta": str(MEDICOS_CSV),
        "existe": MEDICOS_CSV.exists(),
        "contenido": read_csv(MEDICOS_CSV)
    })

# ─── Main ────────────────────────────────────────────────────────────────────
def open_browser(port):
    import time
    time.sleep(1.2)
    webbrowser.open(f"http://127.0.0.1:{port}")

if __name__ == "__main__":
    limpiar_historial_auto()
    port = 5050
    t = threading.Thread(target=open_browser, args=(port,), daemon=True)
    t.start()
    app.run(host="127.0.0.1", port=port, debug=True, use_reloader=False)