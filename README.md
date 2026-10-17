# LATIDO — Sistema de Apoyo (DEMO)

Prototipo web estático y público para mostrar la experiencia de monitoreo de alertas de emergencia. **Todos los registros incluidos son simulados** y no representan eventos reales.

## Funciones incluidas

- Panel de indicadores calculados desde los datos de ejemplo.
- Tabla de alertas con búsqueda y filtros por urgencia y estado de atención.
- Panel de detalles al seleccionar una alerta o una entidad federativa.
- Mapa interactivo de los estados de México, coloreados según la prioridad más alta de sus alertas activas.
- Selección sincronizada entre la tabla y el mapa.
- Exportación de las alertas visibles a CSV.
- Diseño adaptable a celulares y computadoras.
- Solo lectura: la DEMO no recibe ni guarda reportes nuevos.

## Estructura

```text
latido-demo/
├── index.html
├── styles.css
├── app.js
├── .nojekyll
├── README.md
└── data/
    └── alertas.json
```

## Publicar en GitHub Pages (sin costo para este caso de uso)

1. Inicia sesión en GitHub y crea un repositorio nuevo, por ejemplo `latido-demo`.
2. Configúralo como **Public** y créalo. No es necesario añadir archivos iniciales.
3. Dentro del repositorio, pulsa **Add file → Upload files**.
4. Sube el contenido de esta carpeta conservando la estructura: `index.html`, `styles.css`, `app.js`, `.nojekyll`, `README.md` y la carpeta `data` con `alertas.json`.
5. Confirma los cambios con **Commit changes**.
6. En el repositorio abre **Settings → Pages**.
7. En **Build and deployment**, selecciona **Deploy from a branch**, la rama `main` y la carpeta `/(root)`. Guarda la configuración.
8. Espera a que termine la publicación y abre la URL que aparecerá en la sección Pages; normalmente tendrá la forma `https://TU-USUARIO.github.io/latido-demo/`.

GitHub indica que la primera publicación o las actualizaciones pueden tardar varios minutos. Consulta la documentación oficial: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Probar en tu computadora

Como el navegador puede bloquear `fetch()` al abrir directamente el archivo con `file://`, ejecuta un servidor local desde esta carpeta, por ejemplo:

```bash
python -m http.server 8000
```

Después abre `http://localhost:8000` en el navegador. No requiere instalar dependencias con npm.

## Fuentes y dependencias externas

- Leaflet 1.9.4 para el mapa: https://leafletjs.com/
- Teselas cartográficas de CARTO y datos de OpenStreetMap (la atribución aparece en el mapa).
- Fuente externa de límites estatales GeoJSON: https://github.com/angelnmara/geojson (archivo `mexicoHigh.json`, rama `master`). La DEMO obtiene ese archivo al cargar; por ello necesita conexión a internet y disponibilidad de la fuente externa. Revisa las condiciones de uso de esa fuente antes de reutilizar los límites en una versión productiva o redistribuirlos.
- Fuente cartográfica adicional: https://carto.com/attributions y https://www.openstreetmap.org/copyright

Si el servicio de GeoJSON externo cambia o deja de estar disponible, la tabla seguirá siendo independiente, pero el mapa puede no cargar. Para hacerla más autónoma posteriormente se recomienda incorporar al repositorio una copia debidamente licenciada y atribuida del GeoJSON.

## Cambiar los datos simulados

Edita `data/alertas.json` y vuelve a subir el archivo al repositorio. Campos usados por la interfaz:

- `id`: identificador de la alerta.
- `estado`, `municipio`, `zona`: ubicación del escenario simulado.
- `evento`: tipo de incidente.
- `urgencia`: `1`, `2` o `3`.
- `afectados`: cantidad simulada.
- `recursos`: arreglo de recursos ilustrativos.
- `estadoAtencion`: `Pendiente`, `En proceso` o `Atendido`.
- `fecha`: fecha ISO 8601.
- `observaciones`: texto de detalle.

El color del mapa considera solo las alertas cuyo estado de atención no sea `Atendido` y usa el mayor nivel de urgencia de las alertas activas de cada estado. La tabla conserva también los registros atendidos.

## Aviso de uso

> **DEMO ACADÉMICA — DATOS SIMULADOS — NO UTILIZAR PARA LA GESTIÓN DE EMERGENCIAS REALES.**

GitHub Pages publica la web en internet; cualquier dato colocado en este repositorio debe considerarse público. No subir nombres, teléfonos, ubicaciones sensibles ni información auténtica de personas afectadas.
