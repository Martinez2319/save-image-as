# Save image as PDF, PNG, JPG, WebP / MP4, WebM

[![Mozilla Add-on](https://img.shields.io/badge/Firefox-FF7139?style=flat&logo=Firefox-Browser&logoColor=white)](https://addons.mozilla.org/)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

**Extensión para Firefox** que permite convertir y guardar cualquier imagen como PDF, PNG, JPG o WebP, y descargar videos como MP4 o WebM directamente desde el menú contextual. También incluye un elemento flotante para resaltar y seleccionar todas las imágenes/videos de una página.

---

**Firefox extension** that lets you convert and save any image as PDF, PNG, JPG, or WebP, and download videos as MP4 or WebM directly from the context menu. It also includes a floating element to highlight and select all images/videos on a page.

---

## ✨ Características / Features

| Español | English |
|---------|---------|
| ✅ Guarda imágenes como **PDF, PNG, JPG, WebP** | ✅ Save images as **PDF, PNG, JPG, WebP** |
| ✅ Descarga videos como **MP4, WebM** | ✅ Download videos as **MP4, WebM** |
| ✅ Conversión offline con OffscreenCanvas | ✅ Offline conversion via OffscreenCanvas |
| ✅ Menú contextual integrado (clic derecho) | ✅ Integrated right-click context menu |
| ✅ Elemento flotante para resaltar medios en la página | ✅ Floating button to highlight page media |
| ✅ Configuración desde la página de opciones | ✅ Settings page |
| ✅ Diálogo opcional "Guardar como" | ✅ Optional "Save as" dialog |
| ✅ Generación de PDF nativa (sin librerías externas) | ✅ Native PDF generation (no external libs) |
| ✅ Soporte para videos en formato original | ✅ Original-format video downloads |

---

## 📦 Instalación / Installation

### Desde Firefox Add-ons (recomendado)
1. Visita la página de la extensión en [Firefox Browser ADD-ONS](https://addons.mozilla.org/)
2. Haz clic en **"Añadir a Firefox"**
3. ¡Listo! Aparecerá un icono en la barra de herramientas

### Desde el código fuente (desarrollo)
1. Clona este repositorio:
   ```bash
   git clone https://github.com/tu-usuario/save-image-as.git
   ```
2. Abre Firefox y ve a `about:debugging#/runtime/this-firefox`
3. Haz clic en **"Cargar complemento temporal..."**
4. Selecciona el archivo `manifest.json` dentro de la carpeta `save-image-as/`
5. La extensión se cargará automáticamente

---

## 🚀 Cómo usar / How to use

### 📷 Imágenes / Images
1. **Haz clic derecho** sobre cualquier imagen en una página web
2. Ve al menú **"Save image as..."**
3. Elige el formato deseado:
   - **PDF** — Convierte a PDF con la imagen incrustada
   - **PNG** — Sin pérdida de calidad
   - **JPG** — Comprimido (calidad 92%)
   - **WebP** — Formato moderno de Google (calidad 85%)
4. La imagen se descargará automáticamente

### 🎬 Videos
1. **Haz clic derecho** sobre cualquier video
2. Ve al menú **"Save video as..."**
3. Elige **MP4** o **WebM**
4. El video se descargará en su formato original

### 🔍 Elemento flotante / Floating element
1. Activa **"Elemento flotante en páginas"** desde la configuración
2. Aparecerá un icono en el lado derecho de la página
3. Haz clic en el icono de imagen 📷 para **resaltar todas las imágenes y videos**
4. Haz clic en cualquier elemento resaltado para descargarlo
5. Usa la **X** para cerrar el elemento flotante

---

## ⚙️ Configuración / Settings

Abre la página de opciones desde el icono de la extensión en la barra de herramientas o desde `about:addons`.

| Opción | Descripción |
|--------|-------------|
| **Preguntar dónde guardar** | Muestra el diálogo "Guardar como" antes de cada descarga |
| **Elemento flotante en páginas** | Muestra un botón flotante para resaltar imágenes/videos |

---

## 🏗️ Estructura del proyecto / Project structure

```
save-image-as/
├── manifest.json      # Manifiesto de la extensión
├── background.js      # Service worker (menú contextual, conversión, descargas)
├── content.js         # Content script (elemento flotante, resaltado)
├── options.html       # Página de configuración
├── options.js         # Lógica de la configuración
├── styles.css         # Estilos del elemento flotante y resaltados
└── icons/             # Iconos de la extensión
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🛠️ Desarrollo / Development

### Tecnologías / Technologies
- **Manifest V3** — Última especificación de extensiones Firefox/Chrome
- **OffscreenCanvas API** — Conversión de imágenes offline
- **ContextMenus API** — Menú contextual integrado
- **Storage API** — Persistencia de configuración
- **PDF nativo** — Generación de PDF sin librerías externas

### Notas técnicas / Technical notes
- La extensión usa `OffscreenCanvas` + `createImageBitmap` para convertir imágenes sin necesidad de un DOM visible
- La generación de PDF se hace completamente en JavaScript construyendo el binario PDF manualmente
- Los videos se descargan en su formato original sin reconversión

---

## 📄 Licencia / License

Este proyecto está licenciado bajo la **Mozilla Public License 2.0**.  
Ver el archivo [LICENSE](LICENSE) para más detalles.

This project is licensed under the **Mozilla Public License 2.0**.  
See the [LICENSE](LICENSE) file for details.

---

## 🤝 Contribuciones / Contributing

Las contribuciones son bienvenidas. Si encuentras un bug o tienes una sugerencia:

1. Abre un [Issue](https://github.com/tu-usuario/save-image-as/issues)
2. Haz un [Fork](https://github.com/tu-usuario/save-image-as/fork) del proyecto
3. Envía un Pull Request

Contributions are welcome. If you find a bug or have a suggestion:

1. Open an [Issue](https://github.com/tu-usuario/save-image-as/issues)
2. [Fork](https://github.com/tu-usuario/save-image-as/fork) the project
3. Submit a Pull Request

---

<p align="center">Hecho con ❤️ para la comunidad de Firefox</p>
