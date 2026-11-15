# TabVault para Microsoft Edge

Extensión Manifest V3 para guardar sesiones de pestañas, restaurar respaldos y generar una lista HTML.

## Instalar

1. Abre `edge://extensions`.
2. Activa el modo de desarrollador.
3. Pulsa **Cargar descomprimida**.
4. Selecciona la carpeta `extension`.
5. Si vas a guardar pestañas InPrivate, activa **Permitir en InPrivate** en los detalles de TabVault.

## Qué hace

- **Guardar respaldo JSON:** guarda las pestañas HTTP y HTTPS que Edge permite consultar.
- **Crear lista HTML:** genera un archivo con los enlaces de la sesión actual.
- **Crear lista desde JSON:** convierte un respaldo anterior sin abrir sus direcciones.
- **Restaurar pestañas:** abre los enlaces del respaldo después de pedir confirmación.
- **Incluir InPrivate:** permite incluirlas solo cuando el usuario marca la casilla y Edge concede el permiso.

## Lista HTML

- Presenta los enlaces en filas sencillas, agrupadas como aparecen en Edge.
- Permite buscar por título o dominio y filtrar por grupo.
- Cada fila tiene un enlace para abrir la página y una opción para quitarla de la lista.
- **Guardar cambios** descarga otro HTML con los enlaces que quedaron.
- No carga imágenes, fuentes, librerías ni recursos externos.
- El archivo contiene las direcciones guardadas. Si incluye pestañas InPrivate, consérvalo en un lugar privado.

## Privacidad y límites

- Los respaldos y las listas HTML se descargan localmente.
- No se envían direcciones a servidores.
- InPrivate permanece excluido hasta que se marca la casilla.
- Se excluyen páginas internas de Edge y direcciones que no sean HTTP o HTTPS.
- Algunas entradas se excluyen mediante un filtro de contenido explícito.
- La restauración abre las pestañas en la ventana actual; todavía no reconstruye la distribución original de ventanas ni vuelve a crear grupos.

## Tecnologías

- Chromium Extensions Manifest V3
- JavaScript sin dependencias
- Chrome Tabs API y Tab Groups API
