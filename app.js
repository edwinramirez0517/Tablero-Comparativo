// Registramos la herramienta para los gráficos
Chart.register(ChartDataLabels);

// Variables donde guardaremos la información
let datosGlobales = [];
let miGrafico = null; 

// 1. LECTURA DEL ARCHIVO CSV
Papa.parse('datos.csv', {
    download: true,       // Le dice que vaya a buscar tu archivo datos.csv
    header: true,         // Entiende que la primera fila tiene los títulos
    dynamicTyping: true,  // Convierte los textos de los números a valores reales
    complete: function(resultados) {
        console.log("¡CSV leído correctamente!");
        
        // Guardamos los datos omitiendo filas en blanco
        datosGlobales = resultados.data.filter(fila => fila.mes != null);

        // Ocultar el mensaje de "Cargando..." y mostrar el tablero
        document.getElementById('loading').style.display = 'none';
        document.getElementById('filtros-container').style.display = 'flex';
        document.getElementById('graficos-container').style.display = 'grid';

        // Ejecutamos las funciones para llenar la pantalla
        llenarFiltroMeses();
        dibujarGraficoBasico();
    },
    error: function(error) {
        document.getElementById('loading').innerText = "Hubo un error al leer datos.csv";
        console.error(error);
    }
});

// 2. FUNCIÓN PARA LLENAR EL DESPLEGABLE DE MESES
function llenarFiltroMeses() {
    const selectMes = document.getElementById('f-mes');
    
    // Sacamos una lista de meses sin repetir (Enero, Febrero...)
    const mesesUnicos = [...new Set(datosGlobales.map(item => item.mes))];
    
    mesesUnicos.forEach(mes => {
        let opcion = document.createElement('option');
        opcion.value = mes;
        opcion.text = mes;
        selectMes.appendChild(opcion);
    });
}

// 3. FUNCIÓN PARA DIBUJAR EL GRÁFICO INICIAL
function dibujarGraficoBasico() {
    const ctx = document.getElementById('chartLine').getContext('2d');
    
    // Sacamos los meses para ponerlos en la parte de abajo del gráfico
    const meses = [...new Set(datosGlobales.map(item => item.mes))];
    
    // Sumamos los valores "actual" y "pasado" por cada mes
    const totalesActual = meses.map(mes => {
        return datosGlobales.filter(item => item.mes === mes)
                            .reduce((suma, item) => suma + (item.actual || 0), 0);
    });
    
    const totalesPasado = meses.map(mes => {
        return datosGlobales.filter(item => item.mes === mes)
                            .reduce((suma, item) => suma + (item.pasado || 0), 0);
    });

    // Dibujamos el gráfico de líneas
    miGrafico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: meses,
            datasets: [
                {
                    label: 'Año Actual',
                    data: totalesActual,
                    borderColor: '#012094', // Color primario (Azul)
                    backgroundColor: '#012094',
                    tension: 0.3
                },
                {
                    label: 'Año Pasado',
                    data: totalesPasado,
                    borderColor: '#E1251B', // Color secundario (Rojo)
                    backgroundColor: '#E1251B',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}
