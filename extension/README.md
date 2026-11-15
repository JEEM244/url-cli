# TabVault Edge Extension

Extensión Manifest V3 para Microsoft Edge. Permite capturar pestañas en JSON, restaurar respaldos y convertir sesiones en una cartelera HTML independiente.

## Instalar en Edge

1. Abre `edge://extensions`.
2. Activa **Modo de desarrollador**.
3. Selecciona **Cargar descomprimida**.
4. Elige la carpeta `extension` del repositorio.
5. Abre el menú de extensiones y fija TabVault.

## Uso

- **Guardar sesión JSON**: captura pestañas HTTP/HTTPS accesibles, ventanas y metadatos de grupos.
- **Crear cartelera HTML de pestañas actuales**: genera una página independiente desde las pestañas que Edge entrega a la extensión.
- **Crear cartelera desde este JSON**: carga un respaldo anterior y conviértelo sin tener que abrir las URL.
- **Incluir pestañas InPrivate**: marca la casilla dentro de TabVault y habilita **Permitir en InPrivate** en los detalles de la extensión en Edge.
- **Grupos plegados**: las pestañas que pertenecen a un grupo plegado también se consultan; no hace falta desplegar el grupo ni abrir cada pestaña.
- **Restaurar pestañas**: selecciona un respaldo JSON de TabVault y confirma antes de abrir las URL.

## Cartelera HTML

- Archivo independiente, adaptable a escritorio y móvil.
- Vista tipo cartelera con tarjetas grandes, portada de la primera imagen disponible de cada página, buscador por título y dominio, filtro por grupo y acceso directo.
- Conserva información de grupo, pestaña fijada, pestaña activa y marca InPrivate.
- No utiliza librerías ni scripts externos y no envía datos a servidores. Las portadas se cargan desde el sitio original, por lo que necesitan conexión a Internet y pueden no mostrarse si el sitio bloquea la imagen.
- Cada tarjeta tiene una opción para quitar el enlace. Después de hacer cambios, pulsa «Guardar cartelera actualizada» para descargar una nueva versión sin los enlaces quitados.
- Las URL se guardan dentro del propio HTML. Un tablero creado con enlaces InPrivate debe tratarse como información privada.

## Privacidad y límites

- Los respaldos JSON y las carteleras HTML se descargan localmente.
- InPrivate permanece excluido hasta que el usuario marca expresamente la casilla y Edge permite el acceso.
- Las entradas que coincidan con el filtro de contenido explícito se excluyen del respaldo y de la cartelera.
- No se guardan títulos ni URL de entradas filtradas.
- Las páginas internas del navegador y otros esquemas que no sean HTTP/HTTPS se excluyen.
- La restauración abre las pestañas en la ventana actual; todavía no reconstruye la distribución original de ventanas ni vuelve a crear grupos.

## Tecnologías

- Chromium Extensions Manifest V3
- JavaScript sin dependencias ni proceso de compilación
- Chrome Tabs API, Tab Groups API y Scripting API
- Permiso de acceso a páginas HTTP/HTTPS para consultar la primera imagen disponible
