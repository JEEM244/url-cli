# TabVault Edge Extension

Extensión Manifest V3 para Microsoft Edge. Permite capturar en un archivo JSON las pestañas accesibles y restaurar las URL válidas de un respaldo.

## Instalar en Edge

1. Abre `edge://extensions`.
2. Activa **Modo de desarrollador**.
3. Selecciona **Cargar descomprimida**.
4. Elige la carpeta `extension` del repositorio.
5. Abre el menú de extensiones y fija TabVault.

## Uso

- **Guardar sesión JSON**: captura las pestañas HTTP/HTTPS accesibles, las ventanas y los metadatos de grupos.
- **Incluir pestañas InPrivate**: marca la casilla dentro de TabVault y habilita **Permitir en InPrivate** en los detalles de la extensión en Edge.
- **Grupos plegados**: las pestañas que pertenecen a un grupo plegado también se consultan; no hace falta desplegar el grupo ni abrir cada pestaña.
- **Restaurar pestañas**: selecciona un respaldo JSON de TabVault y confirma antes de abrir las URL.

## Privacidad y límites

- Los respaldos se descargan localmente; la extensión no envía datos a servidores.
- InPrivate permanece desactivado para el respaldo hasta que el usuario marca expresamente la casilla.
- Las entradas que coincidan con el filtro de contenido explícito se excluyen del respaldo.
- No se guardan títulos ni URL de entradas filtradas.
- Las páginas internas del navegador y otros esquemas que no sean HTTP/HTTPS se excluyen.
- Si Edge no entrega los metadatos de un grupo, TabVault conserva las pestañas y su identificador de grupo cuando esté disponible.
- La restauración abre las pestañas en la ventana actual; esta versión todavía no reconstruye la distribución original de ventanas ni vuelve a crear los grupos.
- El acceso InPrivate depende del permiso manual del usuario en Edge.

## Tecnologías

- Chromium Extensions Manifest V3
- JavaScript sin dependencias ni proceso de compilación
- Chrome Tabs API y Tab Groups API
