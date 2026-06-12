# 📋 Guía: Crear Release v2.4 en GitHub

## Paso 1: Preparar el archivo
✅ El archivo ZIP está listo:
```
ConsentimientosDHI-v2.4.zip (63 MB)
```

**Contenido del ZIP:**
```
ConsentimientosDHI/
├── ConsentimientosDHI.exe       ← Ejecutable principal
├── _internal/                   ← Librerías Python (Flask, pandas, docx, etc.)
├── templates/                   ← Plantillas HTML
├── static/                      ← CSS y JavaScript
├── app_templates/               ← Plantillas de procedimientos médicos
├── data/                        ← Datos (medicos.csv, enfermeros.csv, config.json)
└── [otros archivos de soporte]
```

**Nota**: El ZIP contiene todo lo necesario. El usuario solo necesita descomprimirlo y ejecutar el .exe.

---

## Paso 2: Acceder a GitHub y crear el Release

### 2.1 Ir al repositorio
1. Abre tu navegador y ve a: `https://github.com/tu-usuario/consentimientos_app`
   - Reemplaza `tu-usuario` con tu usuario de GitHub

### 2.2 Crear nuevo Release
1. En la página del repo, haz clic en la pestaña **"Releases"** (derecha, arriba)
   ![releases-tab.png]
2. Haz clic en el botón **"Create a new release"** o **"Draft a new release"**

### 2.3 Llenar los datos del Release

**Tag version:**
```
v2.4
```

**Release title:**
```
ConsentimientosDHI v2.4 - Sistema de Consentimientos Médicos
```

**Description (copia y pega esto):**
```
## 🎉 Release v2.4 - Sistema de Consentimientos Médicos

### ✨ Características incluidas
- ✅ Generación automática de consentimientos desde plantillas DOCX
- ✅ Gestión completa de firmas (médicos, enfermeros, pacientes)
- ✅ Soporte para menores con representante legal
- ✅ Exportación a PDF y DOCX
- ✅ Historial completo de documentos generados
- ✅ Configuración personalizable por hospital
- ✅ Interfaz web moderna y responsiva
- ✅ Ejecutable portátil (no requiere instalación)

### 📦 Contenido
Este release incluye:
- **ConsentimientosDHI.exe** - Aplicación principal
- **Plantillas** - app_templates/ con consentimientos médicos
- **Datos** - data/ con CSV de médicos, enfermeros, historial
- **Recursos** - templates/, static/ (HTML, CSS, JavaScript)
- **Dependencias** - _internal/ con todas las librerías Python

### 🚀 Instalación rápida
1. Descarga `ConsentimientosDHI-v2.4.zip`
2. Descomprime la carpeta en tu PC
3. Abre la carpeta descomprimida
4. Haz doble clic en `ConsentimientosDHI.exe` para ejecutar
5. Se abrirá automáticamente en tu navegador (http://127.0.0.1:5050)
6. Ve a Configuración para personalizar el hospital y parámetros

### ⚙️ Requisitos del sistema
- Windows 7 o superior (32-bit o 64-bit)
- 2 GB RAM mínimo
- 500 MB de espacio disponible (más si vas a guardar muchos PDFs)
- Navegador moderno (Chrome, Edge, Firefox)

### 📖 Documentación
Consulta el [README.md](README.md) para:
- Guía completa de uso
- Cómo agregar plantillas de procedimientos
- Instrucciones para desarrolladores

### 🐛 Reportar problemas
Si encuentras algún problema, abre un issue en el repositorio.

**Versión**: v2.4  
**Fecha**: 2026-06-12  
**Desarrollado para**: DHI - Restauración Capilar
```

---

## Paso 3: Cargar el archivo ZIP

### 3.1 Adjuntar archivo
1. En la sección **"Attach binaries by dropping them here or selecting them"**
   - O busca el botón **"Attach binaries"**
2. Haz clic y selecciona:
   ```
   C:\Users\DHISO\Desktop\Soporte\Programas\consentimientos_app\ConsentimientosDHI-v2.4.zip
   ```
3. Espera a que se cargue (puede tardar unos segundos por el tamaño de ~63 MB)

### 3.2 Verificar antes de publicar
- ✅ Tag: `v2.4`
- ✅ Title: `ConsentimientosDHI v2.4 - Sistema de Consentimientos Médicos`
- ✅ Description: Completa (ver arriba)
- ✅ Archivo ZIP: `ConsentimientosDHI-v2.4.zip` visible en assets

---

## Paso 4: Publicar el Release

### Opciones:
- **"Publish release"** → Publicar inmediatamente (visible para todos)
- **"Save as draft"** → Guardar como borrador (solo tú ves)

**Haz clic en "Publish release"**

---

## ✅ Verificación

Una vez publicado, verifica:
1. Ve a `https://github.com/tu-usuario/consentimientos_app/releases`
2. Deberías ver **v2.4** como el último release
3. El archivo `ConsentimientosDHI-v2.4.zip` está disponible para descargar (63 MB)
4. La descripción se muestra correctamente

---

## 📋 Actualizar el README si es necesario

El README ya fue actualizado con:
- ✅ Nueva sección "Descarga e Instalación (Usuario Final)"
- ✅ Link a releases: `[Releases](https://github.com/tu-usuario/consentimientos_app/releases/tag/v2.4)`
- ✅ Instrucciones paso a paso para descomprimir y ejecutar
- ✅ Requisitos del sistema (Windows 7+, 2GB RAM, 500MB disco)

---

## 🚀 Alternativa: Usar GitHub CLI (línea de comandos)

Si tienes instalado GitHub CLI, puedes crear el release desde PowerShell:

```powershell
# 1. Instalar GitHub CLI (si no lo tienes)
# https://cli.github.com/

# 2. Autenticarte (si es primera vez)
gh auth login

# 3. Ir a la carpeta del proyecto
cd "C:\Users\DHISO\Desktop\Soporte\Programas\consentimientos_app"

# 4. Crear el release con el ZIP
gh release create v2.4 ConsentimientosDHI-v2.4.zip `
  --title "ConsentimientosDHI v2.4 - Sistema de Consentimientos Médicos" `
  --notes "Release con ejecutable portátil incluye plantillas, datos y todas las dependencias. Descomprimir y ejecutar ConsentimientosDHI.exe"
```

---

## 🔗 Links útiles después del release

**Usuario descargará desde:**
```
https://github.com/tu-usuario/consentimientos_app/releases/tag/v2.4
```

**Link directo para descargar:**
```
https://github.com/tu-usuario/consentimientos_app/releases/download/v2.4/ConsentimientosDHI-v2.4.zip
```

**Después de descargar, el usuario:**
1. Descomprime el ZIP
2. Abre la carpeta `ConsentimientosDHI`
3. Ejecuta `ConsentimientosDHI.exe`
4. ¡Listo! Ya funciona con todos los templates y datos incluidos

---

## ❓ Preguntas frecuentes

**P: ¿Puedo editar el release después de publicarlo?**  
R: Sí, haz clic en los tres puntos (...) en el release y selecciona "Edit release"

**P: ¿Puedo agregar más archivos al release?**  
R: Sí, puedes cargar múltiples archivos (templates, documentación, etc.)

**P: ¿Qué pasa si hay un error y necesito hacer v2.4.1?**  
R: Simplemente crea un nuevo release con tag `v2.4.1`

---

**¿Necesitas ayuda con algo más?** Pregunta y te ayudaré.
