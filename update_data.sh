#!/bin/bash

# ==========================================
# Script de Actualización Automática de CSV
# ==========================================
# Este script descarga los archivos ventas.csv y saldos.csv
# desde una URL especificada para mantener el tablero
# interactivo actualizado automáticamente.

# Configura aquí las URLs donde se alojan tus CSV actualizados
URL_VENTAS="http://tu-servidor.com/ruta/a/ventas.csv"
URL_SALDOS="http://tu-servidor.com/ruta/a/saldos.csv"

# Directorio donde está alojado el tablero (cambiar si es necesario)
DIR_DESTINO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Iniciando la actualización de los datos del tablero..."
echo "Destino: $DIR_DESTINO"

# Descargar ventas.csv
echo "Descargando ventas.csv..."
curl -s -L -o "$DIR_DESTINO/ventas.csv" "$URL_VENTAS"
if [ $? -eq 0 ]; then
    echo "✅ ventas.csv actualizado correctamente."
else
    echo "❌ Error al descargar ventas.csv."
fi

# Descargar saldos.csv
echo "Descargando saldos.csv..."
curl -s -L -o "$DIR_DESTINO/saldos.csv" "$URL_SALDOS"
if [ $? -eq 0 ]; then
    echo "✅ saldos.csv actualizado correctamente."
else
    echo "❌ Error al descargar saldos.csv."
fi

echo "Actualización completada: $(date)"
