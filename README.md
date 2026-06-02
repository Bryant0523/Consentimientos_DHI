# Overtrack — Sistema de Consentimientos Médicos

Aplicación web moderna para gestión y firma de consentimientos informados.  
Tecnología: **Python 3.10+ / Flask / HTML5 / CSS3**

---

## Estructura del proyecto

```
Overtrack_Consentimientos/
├── main.py               ← Backend Flask (servidor web)
├── requirements.txt      ← Dependencias Python
├── Iniciar.bat           ← Lanzador Windows (modo dev)
├── Overtrack.spec        ← Config para compilar .exe
│
├── templates/
│   └── index.html        ← Interfaz web principal
│
├── static/
│   ├── css/app.css       ← Estilos
│   └── js/app.js         ← Lógica frontend
│
├── app_templates/        ← Plantillas .docx de procedimientos
│   └── [procedimiento].docx
│
├── data/
│   ├── medicos.csv
│   ├── enfermeros.csv
│   ├── historial.csv
│   ├── config.json
│   └── firmas/           ← Imágenes de firmas
│
└── output/               ← Consentimientos generados
```

---

## Instalación y uso (modo desarrollo)

```bash
# 1. Crear entorno virtual
python -m venv venv
venv\Scripts\activate     # Windows
source venv/bin/activate  # Linux/Mac

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Ejecutar
python main.py
# Abre automáticamente http://127.0.0.1:5050
```

O en Windows, doble clic en **Iniciar.bat**

---

## Agregar plantillas de procedimientos

1. Crea un archivo `.docx` con el nombre del procedimiento.
2. Usa las variables en la plantilla:

| Variable | Descripción |
|----------|-------------|
| `{{paciente}}` | Nombre del paciente |
| `{{cedula_paciente}}` | Cédula del paciente |
| `{{firma_paciente}}` | Imagen firma paciente |
| `{{lugar_expedicion_paciente}}` | Ciudad expedición |
| `{{doctor}}` | Nombre del médico |
| `{{cedula_doctor}}` | Cédula del médico |
| `{{firma_doctor}}` | Imagen firma médico |
| `{{enfermero}}` | Nombre enfermero(a) |
| `{{cedula_enfermero}}` | Cédula enfermero |
| `{{firma_enfermero}}` | Imagen firma enfermero |
| `{{fecha}}` | Fecha actual (DD/MM/YYYY) |
| `{{menor_nombre}}` | Nombre del menor (si aplica) |
| `{{cedula_menor}}` | T.I. del menor |
| `{{firma_menor}}` | Firma del menor |
| `{{acudiente_nombre}}` | Nombre del acudiente |
| `{{cedula_acudiente}}` | Cédula del acudiente |
| `{{parentesco_acudiente}}` | Parentesco |
| `{{firma_acudiente}}` | Firma del acudiente |

3. Copia el `.docx` a la carpeta `app_templates/`

---

## Compilar como ejecutable .exe

### Requisitos
- Python 3.10+
- `pip install pyinstaller`
- Las dependencias del `requirements.txt`
- **Microsoft Word** instalado (para conversión automática a PDF)  
  *Alternativa: el sistema usa ReportLab como fallback sin Word*

### Compilar
```bash
pip install pyinstaller
pyinstaller Overtrack.spec --clean
```

El ejecutable queda en `dist/Overtrack_Consentimientos.exe`

> **Nota**: El `.exe` abre automáticamente el navegador en `http://127.0.0.1:5050`.  
> Para distribuir, copia toda la carpeta `dist/` — incluye los archivos `data/` y `app_templates/`.

---

## Conversión a PDF

El sistema intenta convertir en este orden:
1. **docx2pdf** (requiere Microsoft Word instalado en Windows)
2. **ReportLab** (fallback — genera PDF básico sin el formato de la plantilla)

Para PDF completo con el diseño exacto de la plantilla, se requiere MS Word.

---

## Atajos de teclado

| Atajo | Acción |
|-------|--------|
| `Ctrl + Enter` | Generar consentimiento (en pestaña Inicio) |
| `Esc` | Cerrar modal |
