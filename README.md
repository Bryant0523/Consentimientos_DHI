# ConsentimientosDHI — Sistema de Consentimientos Médicos

Aplicación web moderna para gestión y firma de consentimientos informados en procedimientos médicos y estéticos.  
**Versión**: v2.4  
**Tecnología**: Python 3.10+ / Flask / HTML5 / CSS3

---

## 🚀 Descarga e Instalación (Usuario Final)

### Requisitos del Sistema
- **Sistema Operativo**: Windows 7 o superior (32-bit o 64-bit)
- **Memoria**: 2 GB RAM mínimo
- **Espacio en disco**: 500 MB libre
- **Navegador**: Cualquiera (Chrome, Edge, Firefox)

### Pasos para instalar y ejecutar

1. **Descarga el ejecutable**
   - Ve a [Releases](https://github.com/tu-usuario/consentimientos_app/releases/tag/v2.4)
   - Descarga `ConsentimientosDHI.exe`

2. **Ejecuta el programa**
   - Haz doble clic en `ConsentimientosDHI.exe`
   - Se abrirá automáticamente en tu navegador (http://127.0.0.1:5050)

3. **Configuración inicial**
   - En la pestaña **Configuración**, ingresa:
     - Nombre del hospital/clínica
     - Contraseña de administrador
     - Selecciona opciones de exportación (PDF, DOCX)
   - Carga los datos de médicos y enfermeros desde archivos CSV

4. **Usar la aplicación**
   - **Inicio**: Selecciona procedimiento, ingresa datos del paciente, genera consentimiento
   - **Médicos/Enfermeros**: Gestiona el personal médico y sus firmas
   - **Historial**: Revisa y descarga consentimientos generados
   - **Configuración**: Ajusta parámetros del sistema

### Atajos de teclado
| Atajo | Acción |
|-------|--------|
| `Ctrl + Enter` | Generar consentimiento (en pestaña Inicio) |
| `Esc` | Cerrar modal |

---

## 🔧 Para Desarrolladores

---

## 🔧 Para Desarrolladores

### Estructura del proyecto

```
consentimientos_app/
├── main.py               ← Backend Flask (servidor web)
├── requirements.txt      ← Dependencias Python
├── Iniciar.bat           ← Lanzador Windows (modo dev)
├── ConsentimientosDHI.spec ← Config para compilar .exe
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

### Instalación en modo desarrollo

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

### Agregar plantillas de procedimientos

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

### Compilar como ejecutable .exe (v2.4)

**Requisitos**
- Python 3.10+
- `pip install pyinstaller`
- Las dependencias del `requirements.txt`
- **Microsoft Word** instalado (opcional — para conversión automática a PDF con diseño exacto)  
  *Alternativa: ReportLab genera PDF básico sin Word instalado*

**Compilar**
```bash
pip install pyinstaller
pyinstaller ConsentimientosDHI.spec --clean
```

El ejecutable se genera en: `dist/ConsentimientosDHI/ConsentimientosDHI.exe`

**Distribución**
- El `.exe` es portátil y funciona en Windows 7+
- Se abre automáticamente en navegador (http://127.0.0.1:5050)
- Para distribuir: copia la carpeta completa `dist/ConsentimientosDHI/`
  - Incluye: `data/` (configuración), `app_templates/` (plantillas), y todos los archivos de soporte

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

---

## ✨ Características principales (v2.4)

- ✅ **Generación de consentimientos** desde plantillas DOCX personalizables
- ✅ **Gestión de firmas** (médicos, enfermeros, pacientes, acudientes)
- ✅ **Múltiples procedimientos** (consultas, estética, implantes, infiltraciones, etc.)
- ✅ **Soporte para menores** con representante/acudiente
- ✅ **Exportación** a DOCX y PDF
- ✅ **Historial completo** de documentos generados con descarga
- ✅ **Configuración personalizable** (hospital, logos, contraseña)
- ✅ **Interfaz web moderna** y responsive
- ✅ **Ejecutable portátil** para Windows (no requiere instalación)

---

## 📋 Licencia y Contacto

Desarrollado para **DHI - Restauración Capilar**

Para soporte técnico o reportar bugs, contacta al equipo de desarrollo.
