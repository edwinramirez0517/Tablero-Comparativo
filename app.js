Chart.register(ChartDataLabels);

let datosVentas = [];
let datosSaldos = [];

// 1. Cargar Ventas
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
                                procesado.push({ mes, tipo: tipo_tienda, tienda, division, categoria, pasado, actual });
                            }
                        }
                    }
                }
                resolver(procesado);
            }, error: rechazar
        });
    });
}

// 2. Cargar Saldos
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
                        procesado.push({ tienda: fila.Name, tipo: tipo_tienda, division: fila.Division, categoria: fila.Categoria, saldo_actual: saldo_actual_real, saldo_pasado: saldo_anterior_real });
                    }
                });
                resolver(procesado);
            }, error: rechazar
        });
    });
}

// 3. Inicialización
Promise.all([cargarVentas(), cargarSaldos()]).then(archivos => {
    datosVentas = archivos[0];
    datosSaldos = archivos[1];
    
    document.getElementById('loading').style.display = 'none';
    document.getElementById('filtros-container').style.display = 'flex';
    document.getElementById('graficos-container').style.display = 'grid';

    inicializarFiltros();
    actualizarTablero(); // Dibuja la primera vez
}).catch(console.error);

// 4. Configurar Filtros
function inicializarFiltros() {
    llenarSelect('f-mes', [...new Set(datosVentas.map(d => d.mes))]);
    llenarSelect('f-tipo', [...new Set(datosVentas.map(d => d.tipo))]);
    llenarSelect('f-tienda', [...new Set(datosVentas.map(d => d.tienda))]);
    llenarSelect('f-division', [...new Set(datosVentas.map(d => d.division))]);
    llenarSelect('f-categoria', [...new Set(datosVentas.map(d => d.categoria))]);

    // Asignar eventos de cambio a cada filtro
    ['f-mes', 'f-tipo', 'f-tienda', 'f-division', 'f-categoria'].forEach(id => {
        document.getElementById(id).addEventListener('change', actualizarTablero);
    });
}

function llenarSelect(id, opciones) {
    const select = document.getElementById(id);
    opciones.sort().forEach(op => {
        let el = document.createElement('option');
        el.value = el.text = op;
        select.appendChild(el);
    });
}

// 5. Función que filtra y redibuja
let graficoLinea, graficoDiv, graficoCat;

function actualizarTablero() {
    // Capturar valores actuales de los filtros
    const fMes = document.getElementById('f-mes').value;
    const fTipo = document.getElementById('f-tipo').value;
    const fTienda = document.getElementById('f-tienda').value;
    const fDiv = document.getElementById('f-division').value;
    const fCat = document.getElementById('f-categoria').value;

    // Filtrar Ventas
    let vFiltradas = datosVentas.filter(d => {
        return (fMes === 'Todos' || d.mes === fMes) &&
               (fTipo === 'Todos' || d.tipo === fTipo) &&
               (fTienda === 'Todos' || d.tienda === fTienda) &&
               (fDiv === 'Todos' || d.division === fDiv) &&
               (fCat === 'Todos' || d.categoria === fCat);
    });

    // Filtrar Saldos (Saldos no tiene filtro de mes en esta estructura básica)
    let sFiltrados = datosSaldos.filter(d => {
        return (fTipo === 'Todos' || d.tipo === fTipo) &&
               (fTienda === 'Todos' || d.tienda === fTienda) &&
               (fDiv === 'Todos' || d.division === fDiv) &&
               (fCat === 'Todos' || d.categoria === fCat);
    });

    dibujarGraficos(vFiltradas, sFiltrados);
}

// 6. Redibujar Gráficos y Tabla
function dibujarGraficos(vData, sData) {
    // --- Tendencia Mensual ---
    const ctxLinea = document.getElementById('chartLine').getContext('2d');
    const meses = [...new Set(vData.map(item => item.mes))];
    const totActual = meses.map(m => vData.filter(d => d.mes === m).reduce((s, d) => s + d.actual, 0));
    const totPasado = meses.map(m => vData.filter(d => d.mes === m).reduce((s, d) => s + d.pasado, 0));

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
    const divisiones = [...new Set(vData.map(item => item.division))];
    const divActual = divisiones.map(d => vData.filter(x => x.division === d).reduce((s, x) => s + x.actual, 0));
    
    if(graficoDiv) graficoDiv.destroy();
    graficoDiv = new Chart(ctxDiv, {
        type: 'bar',
        data: { labels: divisiones, datasets: [{ label: 'Venta Actual', data: divActual, backgroundColor: '#012094' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Comparativo por Categoría (Top 10) ---
    const ctxCat = document.getElementById('chartCat').getContext('2d');
    const categorias = [...new Set(vData.map(item => item.categoria))].slice(0, 10);
    const catActual = categorias.map(c => vData.filter(x => x.categoria === c).reduce((s, x) => s + x.actual, 0));
    
    if(graficoCat) graficoCat.destroy();
    graficoCat = new Chart(ctxCat, {
        type: 'bar', indexAxis: 'y',
        data: { labels: categorias, datasets: [{ label: 'Venta Actual', data: catActual, backgroundColor: '#E1251B' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Tabla Resumen (Saldos) ---
    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';
    const tiendasUnicas = [...new Set(sData.map(item => item.tienda))]; 
    
    tiendasUnicas.forEach(t => {
        let stActual = sData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.saldo_actual, 0);
        let stPasado = sData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.saldo_pasado, 0);
        let dif = stActual - stPasado;
        
        let tr = document.createElement('tr');
        tr.innerHTML = `<td>${t}</td><td>${stActual.toFixed(0)}</td><td>${stPasado.toFixed(0)}</td>
                        <td class="${dif >= 0 ? 'pos' : 'neg'}">${dif > 0 ? '+' : ''}${dif.toFixed(0)}</td>`;
        tbody.appendChild(tr);
    });
}
