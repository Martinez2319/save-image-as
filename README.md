# Save image as — Firefox

Convierte imágenes a **PDF, PNG, JPG y WebP** desde el menú contextual. También permite descargar imágenes y videos en su formato original y seleccionar medios desde un botón flotante.

Versión del código: **1.0.1** · Firefox de escritorio **140+** · Licencia [MPL 2.0](LICENSE).

## Uso

- **Imágenes:** clic derecho → **Guardar imagen como…** → formato deseado o **Descargar original**.
- **Videos:** clic derecho → **Guardar video…** → **Descargar original (sin convertir)**. El navegador conserva el nombre/tipo que indica el servidor; no se convierte entre MP4 y WebM.
- **Flotante:** activa **Elemento flotante en páginas** en las opciones, pulsa el botón de imágenes y selecciona un medio resaltado. Respeta la URL de la página y la imagen elegida mediante `srcset`.
- **Errores:** el icono muestra `!` y el detalle aparece al abrir las opciones. Una conversión fallida no descarga el original con una extensión falsa. Puedes elegir explícitamente **Descargar original**.

JPG usa calidad 92%; WebP, 85%. JPG y PDF componen la transparencia sobre fondo blanco. Las imágenes animadas se exportan como una imagen fija. Se verifica el MIME que devuelve el codificador antes de asignar la extensión.

Los videos deben exponer una URL directa descargable. Los streams `blob:`, HLS/DASH y contenido protegido no se convierten ni se reconstruyen. Las descargas autenticadas o dependientes de la página pueden estar limitadas por el servidor. No hay transcodificador de video.

## Cargar la versión de desarrollo

1. Clona o descarga el repositorio, o extrae el ZIP **unsigned** de [GitHub Releases](https://github.com/Martinez2319/save-image-as/releases).
2. Abre `about:debugging#/runtime/this-firefox` en Firefox.
3. Pulsa **Cargar complemento temporal…** y selecciona `manifest.json` dentro de `save-image-as/`, o en la raíz del ZIP extraído.
4. El complemento temporal se elimina al reiniciar Firefox.

El paquete de GitHub **no está firmado por Mozilla**. La instalación permanente y la publicación en [Firefox Add-ons](https://addons.mozilla.org/es-MX/firefox/addon/save-image-as-pdf-png-jpg-webp/) se gestionan por separado; publicar aquí no actualiza automáticamente la tienda.

## Opciones y permisos

Las opciones permiten preguntar dónde guardar cada archivo y activar/desactivar el flotante. Se guardan localmente con la preferencia de descarga y el último error. No hay telemetría ni un servidor propio de conversión: las imágenes se procesan en el navegador.

- `contextMenus`: acciones al hacer clic derecho.
- `downloads`: iniciar y seguir descargas.
- `storage`: preferencias y mensajes de error.
- `<all_urls>`: obtener imágenes de distintos sitios e insertar el flotante en las páginas compatibles.

El manifiesto usa una página de eventos de Firefox. Esta distribución no declara compatibilidad con Chrome. Android declara mínimo 142 para la clave de consentimiento de datos, pero las pruebas automatizadas se ejecutan en Firefox de escritorio.

## Desarrollo y comprobaciones

Requisitos: Node.js 22+, Python 3 y Firefox 140+ para la prueba del navegador.

```text
npm ci
npm test
npm run lint
python scripts/build.py
python -m pip install -r tests/requirements.txt
python tests/firefox_smoke.py
```

- **23 pruebas de regresión** ejecutan el JavaScript original con APIs de navegador simuladas: offsets PDF, formatos y menús, errores, descargas originales, MIME, preferencias, liberación de blobs y URLs del flotante.
- El validador oficial **Mozilla Add-ons Linter** exige cero errores y cero advertencias.
- La prueba de integración instala temporalmente el paquete en un **perfil nuevo de Firefox headless**, usa un servidor local de fixtures y comprueba descargas PNG/JPG/WebP/PDF, el PDF con `pypdf` estricto, un fallo HTTP y el flotante con URLs relativas y `srcset`. Los archivos de prueba y el perfil se eliminan al terminar; no se usa el perfil personal. Geckodriver habilita acceso de prueba a la página de la extensión únicamente en ese proceso local.
- `FIREFOX_BINARY` permite indicar un ejecutable de Firefox concreto. Selenium Manager resuelve geckodriver.

El ZIP generado en `artifacts/` contiene solamente los archivos de la extensión y tiene `manifest.json` en la raíz. `SHA256.txt` permite comprobarlo. GitHub Actions repite las pruebas y empaqueta; una etiqueta `v1.0.1` publica la Release después de superar las comprobaciones.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `save-image-as/background.js` | Menús, conversiones, PDF y seguimiento de descargas. |
| `save-image-as/content.js` | Flotante, resolución de URLs y selección de medios. |
| `save-image-as/options.*` | Preferencias y errores visibles. |
| `tests/` | Regresiones, fixtures y prueba de Firefox real. |
| `scripts/build.py` | Paquete de desarrollo sin firma. |
| `.github/workflows/ci.yml` | Validación, pruebas y releases. |
