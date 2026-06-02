# -*- mode: python ; coding: utf-8 -*-
# ══════════════════════════════════════════════
#       Consentimientos DHI
# PyInstaller spec para Windows
# ══════════════════════════════════════════════
import sys
from pathlib import Path

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('templates',    'templates'),
        ('static',       'static'),
        ('data',         'data'),
        ('app_templates','app_templates'),
    ],
    hiddenimports=[
        'flask',
        'werkzeug',
        'docxtpl',
        'docx',
        'docx.shared',
        'docx2pdf',
        'reportlab',
        'reportlab.platypus',
        'reportlab.lib.styles',
        'reportlab.lib.pagesizes',
        'reportlab.lib.units',
        'reportlab.lib.colors',
        'PIL',
        'PIL.Image',
        'jinja2',
        'lxml',
        'lxml.etree',
        'sqlite3',
        'csv',
        'threading',
        'webbrowser',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy', 'numpy'],
    noarchive=False,
    optimize=1,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='Overtrack_Consentimientos',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='static/img/icon.ico',
)
