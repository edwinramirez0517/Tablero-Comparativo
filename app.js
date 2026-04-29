Chart.register(ChartDataLabels);

let datosVentas = [];
let datosSaldos = [];
const ordenMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// --- UTILIDAD: Formato de números con comas ---
function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
}

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

// 2. Cargar Saldos (Inventario)
function cargarSaldos() {
    return new Promise((resolver, rechazar) => {
        Papa.parse('saldos.csv', {
            download: true, header: true, delimiter: ';', dynamicTyping: true,
            complete: function(resultados) {
                let procesado = [];
                resultados.data.forEach(fila => {
                    if(fila.Name) {
                        let saldo_actual_real = parseFloat(fila.Saldo_Total_Anterior) || 0; // Lógica invertida por defecto
                        let saldo_anterior_real = parseFloat(fila.Saldo_Total_Actual) || 0; // Lógica invertida por defecto
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
    actualizarTablero();
}).catch(console.error);

// 4. Configurar Filtros
function inicializarFiltros() {
    // Para los meses, los ordenamos cronológicamente
    let mesesUnicos = [...new Set(datosVentas.map(d => d.mes))];
    mesesUnicos.sort((a, b) => ordenMeses.indexOf(a) - ordenMeses.indexOf(b));
    
    llenarSelect('f-mes', mesesUnicos);
    llenarSelect('f-tipo', [...new Set(datosVentas.map(d => d.tipo))].sort());
    llenarSelect('f-tienda', [...new Set(datosVentas.map(d => d.tienda))].sort());
    llenarSelect('f-division', [...new Set(datosVentas.map(d => d.division))].sort());
    llenarSelect('f-categoria', [...new Set(datosVentas.map(d => d.categoria))].sort());

    ['f-mes', 'f-tipo', 'f-tienda', 'f-division', 'f-categoria'].forEach(id => {
        document.getElementById(id).addEventListener('change', actualizarTablero);
    });
}

function llenarSelect(id, opciones) {
    const select = document.getElementById(id);
    opciones.forEach(op => {
        let el = document.createElement('option');
        el.value = el.text = op;
        select.appendChild(el);
    });
}

// 5. Función que filtra y redibuja
let graficoLinea, graficoDiv, graficoCat;

// Configuración común para las etiquetas de los gráficos
const datalabelsConfig = {
    color: '#333',
    anchor: 'end',
    align: 'top',
    formatter: function(value) { return formatNumber(value); },
    font: { weight: 'bold', size: 10 }
};

function actualizarTablero() {
    const fMes = document.getElementById('f-mes').value;
    const fTipo = document.getElementById('f-tipo').value;
    const fTienda = document.getElementById('f-tienda').value;
    const fDiv = document.getElementById('f-division').value;
    const fCat = document.getElementById('f-categoria').value;

    // Filtro para los gráficos que NO son de tiempo (División, Categoría, Tablas)
    let vFiltradas = datosVentas.filter(d => {
        return (fMes === 'Todos' || d.mes === fMes) &&
               (fTipo === 'Todos' || d.tipo === fTipo) &&
               (fTienda === 'Todos' || d.tienda === fTienda) &&
               (fDiv === 'Todos' || d.division === fDiv) &&
               (fCat === 'Todos' || d.categoria === fCat);
    });

    // Filtro ESPECIAL para la Tendencia Mensual (Ignora el filtro de mes)
    let vTendencia = datosVentas.filter(d => {
        return (fTipo === 'Todos' || d.tipo === fTipo) &&
               (fTienda === 'Todos' || d.tienda === fTienda) &&
               (fDiv === 'Todos' || d.division === fDiv) &&
               (fCat === 'Todos' || d.categoria === fCat);
    });

    let sFiltrados = datosSaldos.filter(d => {
        return (fTipo === 'Todos' || d.tipo === fTipo) &&
               (fTienda === 'Todos' || d.tienda === fTienda) &&
               (fDiv === 'Todos' || d.division === fDiv) &&
               (fCat === 'Todos' || d.categoria === fCat);
    });

    dibujarGraficos(vFiltradas, vTendencia, sFiltrados);
}

// 6. Redibujar
function dibujarGraficos(vData, vTendenciaData, sData) {
    
    // --- Tendencia Mensual (Eje X Fijo, usa vTendenciaData) ---
    const ctxLinea = document.getElementById('chartLine').getContext('2d');
    let mesesOrdenados = [...new Set(datosVentas.map(item => item.mes))].sort((a, b) => ordenMeses.indexOf(a) - ordenMeses.indexOf(b));
    
    const totActual = mesesOrdenados.map(m => vTendenciaData.filter(d => d.mes === m).reduce((s, d) => s + d.actual, 0));
    const totPasado = mesesOrdenados.map(m => vTendenciaData.filter(d => d.mes === m).reduce((s, d) => s + d.pasado, 0));

    if(graficoLinea) graficoLinea.destroy();
    graficoLinea = new Chart(ctxLinea, {
        type: 'line',
        data: {
            labels: mesesOrdenados,
            datasets: [
                { label: 'Año Actual', data: totActual, borderColor: '#012094', backgroundColor: '#012094', tension: 0.3 },
                { label: 'Año Pasado', data: totPasado, borderColor: '#E1251B', backgroundColor: '#E1251B', tension: 0.3 }
            ]
        }, 
        options: { 
            responsive: true, maintainAspectRatio: false,
            plugins: { datalabels: { display: false } }, // Ocultamos etiquetas en líneas para no saturar
            scales: { y: { ticks: { callback: function(value) { return formatNumber(value); } } } }
        }
    });
    
    // --- Comparativo por División (Barras Verticales) ---
    const ctxDiv = document.getElementById('chartDiv').getContext('2d');
    const divisiones = [...new Set(vData.map(item => item.division))];
    const divActual = divisiones.map(d => vData.filter(x => x.division === d).reduce((s, x) => s + x.actual, 0));
    
    if(graficoDiv) graficoDiv.destroy();
    graficoDiv = new Chart(ctxDiv, {
        type: 'bar',
        data: { labels: divisiones, datasets: [{ label: 'Venta Actual', data: divActual, backgroundColor: '#012094' }] },
        options: { 
            responsive: true, maintainAspectRatio: false,
            plugins: { datalabels: datalabelsConfig },
            scales: { y: { ticks: { callback: function(value) { return formatNumber(value); } } } }
        }
    });

    // --- Comparativo por Categoría (Top 10 Barras Horizontales) ---
    const ctxCat = document.getElementById('chartCat').getContext('2d');
    
    // Agrupamos por categoría y ordenamos de mayor a menor para sacar el Top 10
    let catSuma = [];
    const categorias = [...new Set(vData.map(item => item.categoria))];
    categorias.forEach(c => {
        catSuma.push({ cat: c, total: vData.filter(x => x.categoria === c).reduce((s, x) => s + x.actual, 0) });
    });
    catSuma.sort((a, b) => b.total - a.total);
    const top10Cat = catSuma.slice(0, 10);

    if(graficoCat) graficoCat.destroy();
    graficoCat = new Chart(ctxCat, {
        type: 'bar', indexAxis: 'y',
        data: { 
            labels: top10Cat.map(x => x.cat), 
            datasets: [{ label: 'Venta Actual', data: top10Cat.map(x => x.total), backgroundColor: '#E1251B' }] 
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                datalabels: { ...datalabelsConfig, anchor: 'end', align: 'right' } 
            },
            scales: { x: { ticks: { callback: function(value) { return formatNumber(value); } } } }
        }
    });

    // --- Tabla 1: Detalle de Ventas por Tienda ---
    const tbody1 = document.querySelector('#dataTable tbody');
    tbody1.innerHTML = '';
    const tiendasUnicas = [...new Set(vData.map(item => item.tienda))].sort(); 
    
    tiendasUnicas.forEach(t => {
        let vAct = vData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.actual, 0);
        let vPas = vData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.pasado, 0);
        let dif = vAct - vPas;
        
        let tr = document.createElement('tr');
        tr.innerHTML = `<td>${t}</td>
                        <td>${formatNumber(vAct)}</td>
                        <td>${formatNumber(vPas)}</td>
                        <td class="${dif >= 0 ? 'pos' : 'neg'}">${dif > 0 ? '+' : ''}${formatNumber(dif)}</td>`;
        tbody1.appendChild(tr);
    });

    // --- Tabla 2: Resumen de Saldos por Tienda ---
    const tbody2 = document.querySelector('#tableSaldos tbody');
    tbody2.innerHTML = '';
    const tiendasSaldos = [...new Set(sData.map(item => item.tienda))].sort(); 

    tiendasSaldos.forEach(t => {
        let stActual = sData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.saldo_actual, 0);
        let stPasado = sData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.saldo_pasado, 0);
        let difS = stActual - stPasado;
        
        let tr = document.createElement('tr');
        tr.innerHTML = `<td>${t}</td>
                        <td>${formatNumber(stActual)}</td>
                        <td>${formatNumber(stPasado)}</td>
                        <td class="${difS >= 0 ? 'pos' : 'neg'}">${difS > 0 ? '+' : ''}${formatNumber(difS)}</td>`;
        tbody2.appendChild(tr);
    });
}
