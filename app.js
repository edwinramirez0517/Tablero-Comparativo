Chart.register(ChartDataLabels);

let datosVentas = [];
let datosSaldos = [];

// 1. Lector adaptado para la matriz de Ventas
function cargarVentas() {
    return new Promise((resolver, rechazar) => {
        Papa.parse('ventas.csv', {
            download: true, header: false, delimiter: ';',
            complete: function(resultados) {
                const filas = resultados.data;
                const mesesRow = filas[0];
                const metricasRow = filas[1];
                let procesado = [];
                
                for(let i = 2; i < filas.length; i++) {
                    const fila = filas[i];
                    if(!fila || fila.length < 7 || !fila[0]) continue;
                    
                    const tienda = fila[3];
                    const division = fila[4];
                    const categoria = fila[5];
                    
                    let tipo_tienda = (tienda.includes("AEC") || tienda.includes("DS")) ? "Mayoreo" : "Detalle";

                    for(let c = 7; c < fila.length; c++) {
                        if (metricasRow[c] === 'Venta_Und_Anterior') {
                            let mes = mesesRow[c];
                            let pasado = parseFloat(fila[c]) || 0;
                            let actual = parseFloat(fila[c+1]) || 0; 
                            
                            if (pasado !== 0 || actual !== 0) {
                                procesado.push({
                                    mes: mes, tipo: tipo_tienda, tienda: tienda,
                                    division: division, categoria: categoria,
                                    pasado: pasado, actual: actual
                                });
                            }
                        }
                    }
                }
                resolver(procesado);
            }, error: rechazar
        });
    });
}

// 2. Lector adaptado para la estructura de Saldos
function cargarSaldos() {
    return new Promise((resolver, rechazar) => {
        Papa.parse('saldos.csv', {
            download: true, header: true, delimiter: ';', dynamicTyping: true,
            complete: function(resultados) {
                let procesado = [];
                resultados.data.forEach(fila => {
                    if(fila.Name) {
                        let saldo_actual_real = parseFloat(fila.Saldo_Total_Anterior) || 0; 
                        let saldo_anterior_real = parseFloat(fila.Saldo_Total_Actual) || 0;
                        let tipo_tienda = (fila.Name.includes("AEC") || fila.Name.includes("DS")) ? "Mayoreo" : "Detalle";

                        procesado.push({
                            tienda: fila.Name, tipo: tipo_tienda, division: fila.Division, 
                            categoria: fila.Categoria, saldo_actual: saldo_actual_real, saldo_pasado: saldo_anterior_real
                        });
                    }
                });
                resolver(procesado);
            }, error: rechazar
        });
    });
}

// 3. Ejecución principal
Promise.all([cargarVentas(), cargarSaldos()]).then(archivos => {
    datosVentas = archivos[0];
    datosSaldos = archivos[1];
    
    document.getElementById('loading').style.display = 'none';
    document.getElementById('filtros-container').style.display = 'flex';
    document.getElementById('graficos-container').style.display = 'grid';

    dibujarGraficos();
}).catch(err => {
    document.getElementById('loading').innerText = "Error leyendo los datos. Verifica los archivos en el repositorio.";
    console.error(err);
});

// 4. Renderizado Visual
let graficoLinea, graficoDiv, graficoCat;

function dibujarGraficos() {
    // --- Tendencia Mensual ---
    const ctxLinea = document.getElementById('chartLine').getContext('2d');
    const meses = [...new Set(datosVentas.map(item => item.mes))];
    const totActual = meses.map(m => datosVentas.filter(d => d.mes === m).reduce((s, d) => s + d.actual, 0));
    const totPasado = meses.map(m => datosVentas.filter(d => d.mes === m).reduce((s, d) => s + d.pasado, 0));

    if(graficoLinea) graficoLinea.destroy();
    graficoLinea = new Chart(ctxLinea, {
        type: 'line',
        data: {
            labels: meses,
            datasets: [
                { label: 'Año Actual', data: totActual, borderColor: '#012094', backgroundColor: '#012094', tension: 0.3 },
                { label: 'Año Pasado', data: totPasado, borderColor: '#E1251B', backgroundColor: '#E1251B', tension: 0.3 }
            ]
        }, options: { responsive: true, maintainAspectRatio: false }
    });
    
    // --- Comparativo por División ---
    const ctxDiv = document.getElementById('chartDiv').getContext('2d');
    const divisiones = [...new Set(datosVentas.map(item => item.division))];
    const divActual = divisiones.map(d => datosVentas.filter(x => x.division === d).reduce((s, x) => s + x.actual, 0));
    
    if(graficoDiv) graficoDiv.destroy();
    graficoDiv = new Chart(ctxDiv, {
        type: 'bar',
        data: {
            labels: divisiones,
            datasets: [{ label: 'Venta Actual', data: divActual, backgroundColor: '#012094' }]
        }, options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Comparativo por Categoría (Top 10) ---
    const ctxCat = document.getElementById('chartCat').getContext('2d');
    const categorias = [...new Set(datosVentas.map(item => item.categoria))].slice(0, 10);
    const catActual = categorias.map(c => datosVentas.filter(x => x.categoria === c).reduce((s, x) => s + x.actual, 0));
    
    if(graficoCat) graficoCat.destroy();
    graficoCat = new Chart(ctxCat, {
        type: 'bar', indexAxis: 'y',
        data: {
            labels: categorias,
            datasets: [{ label: 'Venta Actual', data: catActual, backgroundColor: '#E1251B' }]
        }, options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Tabla Resumen ---
    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';
    const tiendasTop = [...new Set(datosSaldos.map(item => item.tienda))].slice(0, 20); 
    
    tiendasTop.forEach(t => {
        let stActual = datosSaldos.filter(d => d.tienda === t).reduce((sum, d) => sum + d.saldo_actual, 0);
        let stPasado = datosSaldos.filter(d => d.tienda === t).reduce((sum, d) => sum + d.saldo_pasado, 0);
        let dif = stActual - stPasado;
        
        let tr = document.createElement('tr');
        tr.innerHTML = `<td>${t}</td><td>${stActual.toFixed(0)}</td><td>${stPasado.toFixed(0)}</td>
                        <td class="${dif >= 0 ? 'pos' : 'neg'}">${dif > 0 ? '+' : ''}${dif.toFixed(0)}</td>`;
        tbody.appendChild(tr);
    });
}
