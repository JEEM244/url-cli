# TabVault Edge Extension

Extensión Manifest V3 para Microsoft Edge. Esta primera versión permite capturar pestañas accesibles en un archivo JSON y restaurar las URL válidas de un respaldo.

## Instalar en Edge

1. Abre `edge://extensions`.
2. Activa **Modo de desarrollador**.
3. Selecciona **Cargar descomprimida**.
4. Elige la carpeta `extension` del repositorio.
5. Abre el menú de extensiones y fija TabVault.

## Uso

- **Guardar sesión JSON**: captura pestañas HTTP/HTTPS accesibles, ventanas y metadatos de grupos.
- **Incluir pestañas InPrivate**: solo funciona si Edge permite explícitamente que esta extensión se ejecute en ventanas InPrivate. No omite restricciones del navegador.
- **Restaurar pestañas**: selecciona un respaldo JSON de TabVault y confirma antes de abrir las URL.

## Privacidad y límites

- Los respaldos se descargan localmente; la extensión no envía datos a servidores.
- Las entradas que coincidan con el filtro de contenido explícito se excluyen del respaldo.
- No se guardan títulos ni URL de entradas filtradas.
- Las páginas internas del navegador y otros esquemas que no sean HTTP/HTTPS se excluyen.
- La restauración abre las pestañas en la ventana actual; esta primera versión no reconstruye todavía la distribución original de ventanas ni los grupos.
- El acceso InPrivate depende del permiso manual del usuario en Edge.

## Tecnologías

- Chromium Extensions Manifest V3
- JavaScript sin dependencias ni proceso de compilación
- Chrome Tabs API y Tab Groups API
