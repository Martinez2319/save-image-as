# 1.0.1

- PDF con referencias y longitudes calculadas sobre bytes reales.
- Las conversiones fallidas muestran el error sin generar descargas con extensiones falsas.
- Separación de conversión de imágenes y descarga original de videos, conservando el formato real.
- Menús de imagen limitados a PDF, PNG, JPG, WebP y descarga original.
- El flotante resuelve URLs relativas y utiliza currentSrc para imágenes responsive y videos.
- Comprobación del MIME del codificador y liberación de ImageBitmap.
- Seguimiento de descargas para liberar URLs de blobs al finalizar o interrumpirse.
- 23 regresiones, validador Mozilla e integración en Firefox real con perfil temporal.

El ZIP es un paquete de desarrollo sin firma Mozilla. Esta Release de GitHub no publica ni actualiza automáticamente la versión de Firefox Add-ons.
