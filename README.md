# Tablero Gerencial Interactivo

Este repositorio contiene el código fuente para el Tablero Comparativo Gerencial Interactivo, así como scripts para su automatización.

## Automatización de Datos

Para que el tablero se actualice automáticamente sin intervención manual, hemos incluido un script llamado `update_data.sh` que descarga las últimas versiones de los archivos `ventas.csv` y `saldos.csv` desde una URL específica.

### Cómo configurar la automatización

#### 1. Editar el script de actualización

1. Abre el archivo `update_data.sh` en un editor de texto.
2. Modifica las variables `URL_VENTAS` y `URL_SALDOS` con las URLs reales donde tu sistema exporta o aloja los archivos CSV actualizados.

```bash
URL_VENTAS="http://tu-servidor.com/ruta/a/ventas.csv"
URL_SALDOS="http://tu-servidor.com/ruta/a/saldos.csv"
```

#### 2. Dar permisos de ejecución al script

En tu terminal, ejecuta el siguiente comando en la carpeta del proyecto para hacer el script ejecutable:

```bash
chmod +x update_data.sh
```

#### 3. Programar la ejecución automática (Linux/Mac con Cron)

Puedes usar `cron` para ejecutar este script todos los días (o cada cierto tiempo).

1. Abre tu terminal y escribe:
   ```bash
   crontab -e
   ```
2. Agrega una línea al final del archivo para programar la ejecución. Por ejemplo, para que se actualice **todos los días a las 2:00 AM**, añade:

   ```bash
   0 2 * * * /ruta/absoluta/a/tu/proyecto/update_data.sh >> /ruta/absoluta/a/tu/proyecto/update.log 2>&1
   ```
   *(Asegúrate de cambiar `/ruta/absoluta/a/tu/proyecto` por la ruta real donde guardaste este proyecto).*

3. Guarda y sal del editor. El cronjob quedará programado.

#### 4. Programar la ejecución en Windows (Task Scheduler)

Si tu servidor o computadora es Windows:

1. Busca y abre el **Programador de tareas (Task Scheduler)**.
2. Haz clic en **Crear tarea básica...**
3. Ponle un nombre (ej. "Actualizar Tablero CSV").
4. Elige cuándo quieres que se ejecute (ej. "Diariamente").
5. En **Acción**, selecciona "Iniciar un programa".
6. En **Programa/script**, busca tu intérprete de bash (si tienes Git Bash o WSL) o crea un archivo `.bat` que ejecute el `curl` directamente.
   - Alternativa `.bat`: Puedes crear un archivo `update_data.bat` con el siguiente contenido:
     ```bat
     curl -s -L -o "C:\ruta\al\proyecto\ventas.csv" "http://tu-servidor.com/ruta/a/ventas.csv"
     curl -s -L -o "C:\ruta\al\proyecto\saldos.csv" "http://tu-servidor.com/ruta/a/saldos.csv"
     ```
7. Selecciona el archivo `.bat` como el programa a iniciar y guarda la tarea.