# MiniPOS — Punto de venta para minimercado

Un solo `index.html` que se publica en GitHub Pages. Funciona de entrada en **modo local** (datos en el navegador) y pasa a **tiempo real** (PC de caja + celulares) al conectar Supabase.

Usuarios demo: `admin / 1234` · `supervisor / 2222` (admin. de caja) · `cajero1 / 1111`

## 1. Publicar en GitHub Pages
1. Cree un repositorio y suba `index.html` (y la carpeta `supabase/` como referencia).
2. Settings → Pages → Branch `main` / root → Save.
3. Abra `https://SU-USUARIO.github.io/SU-REPO/`. La cámara del celular funciona porque Pages es HTTPS.

## 2. Conectar Supabase (sincroniza PC y celulares)
1. Cree un proyecto en supabase.com → SQL Editor → pegue y ejecute `supabase/schema.sql`.
2. En MiniPOS: Configuración → Supabase → pegue Project URL y la anon/publishable key → «Guardar y conectar».
3. Haga lo mismo una vez en cada celular (la configuración queda guardada en ese navegador).

> Seguridad: esta versión piloto usa la clave anon con una política abierta. Antes de producción conviene migrar a Supabase Auth con políticas por rol.

## 3. Facturación electrónica Siigo
1. En Siigo Nube: Alianzas → Mi credencial API → copie usuario y access key.
2. Con la CLI de Supabase:
   ```bash
   supabase secrets set SIIGO_USERNAME="usuario@empresa.com" SIIGO_ACCESS_KEY="xxxx" SIIGO_PARTNER_ID="MiniPOS"
   supabase functions deploy siigo-proxy
   ```
3. En MiniPOS: Configuración → Siigo → URL `https://xxxx.supabase.co/functions/v1/siigo-proxy` → «Probar conexión y ver IDs» y copie los IDs del comprobante FV, impuestos (IVA 19 % / 5 %), formas de pago y vendedor.
4. **Importante:** los productos deben existir en Siigo con el **mismo código** que en MiniPOS. Los clientes se crean solos si no existen.

Al cobrar (F4) se elige *Tirilla POS* o *Factura electrónica*. Si Siigo falla, la venta queda «FE pendiente» y se reenvía desde **Ventas**.

## 4. Impresora Epson TM-T20 (80 mm)
Todo se configura en **Configuración → Impresora** (modelo, ancho, forma de conexión, corte, cajón, prueba). Dos modos:
- **Driver de Windows (recomendado para empezar):** se imprime por el navegador y el corte lo hace el driver.
- **Directa USB/Serial (ESC/POS):** Chrome manda los comandos directo: corte automático y apertura de cajón sin cuadro de diálogo. Requiere el *TM Virtual Port Driver* de Epson (la impresora aparece como puerto COM) y vincularla una vez con «Buscar / vincular impresora».

Pasos del modo driver:
- Instale el driver Epson Advanced Printer Driver (APD) y déjela como impresora predeterminada.
- En Preferencias de impresión del driver: papel **Roll Paper 80 x Receipt**, **Corte de papel: al final del documento** y, si tiene cajón monedero, **Abrir cajón: antes de imprimir**.
- En Chrome, la primera vez: márgenes «Ninguno», sin encabezados ni pies de página.
- Para imprimir sin el cuadro de diálogo, abra el POS con un acceso directo de Chrome con `--kiosk-printing` (y `--kiosk` si quiere pantalla completa, que además asegura que F5/F11/F12 no los capture el navegador):
  `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --kiosk-printing https://SU-USUARIO.github.io/SU-REPO/`

## 5. Báscula / gramera
Configuración → Báscula: active la báscula, elija velocidad (normalmente 9600), comando de lectura (P, W, $, ENQ o continuo) y si envía kg o gramos; pulse «Vincular báscula» y «Leer peso» para probar.
- Marque los productos a granel como **«Se vende por peso»** (precio y stock por kg). Al escanear o digitar su código (ej. `2001`) aparece la ventana de peso: lee la báscula sola o, si no hay báscula, pide digitar el peso.
- También lee **etiquetas de báscula** EAN-13 (prefijo 20 + PLU + peso/precio).
- Funciona en Chrome/Edge del PC (Web Serial). Básculas con salida USB-serial o RS-232.

## 6. Modo caja y búsqueda
- El rol **Cajero** solo ve *Caja POS* y *Apertura / Cierre*. Los administradores tienen el botón **🧾 Modo caja** para vender con el menú limpio.
- La búsqueda ignora tildes, tolera errores (*servesa*, *agila*) y sonidos (*aguila lai* → Águila Light). En cada producto se pueden agregar **palabras clave** (pola, birra…).

## 7. Atajos del POS
| Tecla | Acción | Tecla | Acción |
|---|---|---|---|
| F1 | Consulta de precios + calculadora (no agrega) | F2 | Cantidad exacta / volver a pesar |
| F3 | Buscar | F9 | − Cantidad |
| F4 | Cobrar | F10 | Asignar cliente |
| F5 | Grabar / en espera (recupera si está vacío) | F11 | Cambiar precio (clave admin) |
| F6 | Adicionar producto | F12 | Reimprimir tirilla |
| F7 | Cancelar transacción | Ctrl+D | Devolución (clave admin) |
| F8 | + Cantidad | Ctrl+V | Control de ventas |
| Supr | Eliminar ítem (clave admin) | | |

`3*código` agrega 3 unidades. Si un código tiene presentaciones (Unidad / Cajetilla / Cartón) el POS pregunta cuál.

## 8. Importar el catálogo actual
Inventario → Importar CSV con columnas `codigo;nombre;linea;empresa;costo;precio;iva;stockSala;stockBodega;minimo;claves;pesable`.
Antes de salir en vivo: Configuración → «Borrar historial de ventas demo».
