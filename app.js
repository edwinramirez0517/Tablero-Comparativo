Chart.register(ChartDataLabels);

let datosVentas = [];
let datosSaldos = [];

// Diccionario para forzar el orden de los meses cronológicamente
const ordenMeses = { 'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4, 'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8, 'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12 };

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
                    const tienda = fila[3], division = fila[4], categoria = fila[5];
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
    actualizarTablero();
}).catch(console.error);

// 4. Configurar Filtros
function inicializarFiltros() {
    let mesesUnicos = [...new Set(datosVentas.map(d => d.mes))].sort((a, b) => ordenMeses[a] - ordenMeses[b]);
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

// 5. Lógica de Filtrado y Redibujado
let graficoLinea, graficoDiv, graficoCat;

function actualizarTablero() {
    const fMes = document.getElementById('f-mes').value;
    const fTipo = document.getElementById('f-tipo').value;
    const fTienda = document.getElementById('f-tienda').value;
    const fDiv = document.getElementById('f-division').value;
    const fCat = document.getElementById('f-categoria').value;

    let vFiltradas = datosVentas.filter(d => {
        return (fMes === 'Todos' || d.mes === fMes) &&
               (fTipo === 'Todos' || d.tipo === fTipo) &&
               (fTienda === 'Todos' || d.tienda === fTienda) &&
               (fDiv === 'Todos' || d.division === fDiv) &&
               (fCat === 'Todos' || d.categoria === fCat);
    });

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

// 6. DIBUJAR GRÁFICOS Y TABLAS
function dibujarGraficos(vData, vTendenciaData, sData) {
    
    // Configuración de Etiquetas Numéricas para Gráficos
    const configEtiquetas = {
        color: '#444', anchor: 'end', align: 'top', font: { weight: 'bold', size: 10 },
        formatter: function(value) { return formatNumber(value); }
    };

    // --- 6.1 Tendencia Mensual ---
    const ctxLinea = document.getElementById('chartLine').getContext('2d');
    let mesesOrdenados = [...new Set(datosVentas.map(item => item.mes))].sort((a, b) => ordenMeses[a] - ordenMeses[b]);
    const totActual = mesesOrdenados.map(m => vTendenciaData.filter(d => d.mes === m).reduce((s, d) => s + d.actual, 0));
    const totPasado = mesesOrdenados.map(m => vTendenciaData.filter(d => d.mes === m).reduce((s, d) => s + d.pasado, 0));

    if(graficoLinea) graficoLinea.destroy();
    graficoLinea = new Chart(ctxLinea, {
        type: 'line',
        data: {
            labels: mesesOrdenados,
            datasets: [
                { label: 'Año Actual', data: totActual, borderColor: '#012094', backgroundColor: '#012094', tension: 0.3, borderWidth: 3 },
                { label: 'Año Pasado', data: totPasado, borderColor: '#E1251B', backgroundColor: '#E1251B', tension: 0.3, borderWidth: 3 }
            ]
        }, options: { responsive: true, maintainAspectRatio: false, plugins: { datalabels: { display: false } }, scales: { y: { ticks: { callback: v => formatNumber(v) } } } }
    });
    
    // --- 6.2 Comparativo por División ---
    const ctxDiv = document.getElementById('chartDiv').getContext('2d');
    const divisiones = [...new Set(vData.map(item => item.division))];
    const divActual = divisiones.map(d => vData.filter(x => x.division === d).reduce((s, x) => s + x.actual, 0));
    
    if(graficoDiv) graficoDiv.destroy();
    graficoDiv = new Chart(ctxDiv, {
        type: 'bar',
        data: { labels: divisiones, datasets: [{ label: 'Venta Actual', data: divActual, backgroundColor: '#012094' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { datalabels: configEtiquetas }, scales: { y: { ticks: { callback: v => formatNumber(v) } } } }
    });

    // --- 6.3 Comparativo por Categoría ---
    const ctxCat = document.getElementById('chartCat').getContext('2d');
    let catSuma = [];
    [...new Set(vData.map(item => item.categoria))].forEach(c => {
        catSuma.push({ cat: c, total: vData.filter(x => x.categoria === c).reduce((s, x) => s + x.actual, 0) });
    });
    catSuma.sort((a, b) => b.total - a.total);
    const top10Cat = catSuma.slice(0, 10);

    // CORRECCIÓN DE ETIQUETAS: Extraemos explícitamente los nombres como array de texto
    const nombresCategorias = top10Cat.map(x => String(x.cat)); 
    const totalesCategorias = top10Cat.map(x => x.total);

    if(graficoCat) graficoCat.destroy();
    graficoCat = new Chart(ctxCat, {
        type: 'bar', indexAxis: 'x', // Lo dejamos vertical para que se vea como en tu imagen
        data: { labels: nombresCategorias, datasets: [{ label: 'Venta Actual', data: totalesCategorias, backgroundColor: '#E1251B' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { datalabels: configEtiquetas }, scales: { y: { ticks: { callback: v => formatNumber(v) } } } }
    });

    // --- 6.4 TABLA 1: Resumen Gerencial Unificado (Ventas y Saldos) ---
    const tbodyGerencial = document.querySelector('#tablaGerencial tbody');
    tbodyGerencial.innerHTML = '';
    
    // Obtenemos todas las tiendas únicas juntando ventas y saldos
    let todasLasTiendas = [...new Set([...vData.map(d => d.tienda), ...sData.map(d => d.tienda)])].sort();

    todasLasTiendas.forEach(t => {
        let vAct = vData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.actual, 0);
        let vPas = vData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.pasado, 0);
        let difV = vAct - vPas;

        let sAct = sData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.saldo_actual, 0);
        let sPas = sData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.saldo_pasado, 0);
        let difS = sAct - sPas;

        // Solo mostramos la fila si hay datos en ventas o en saldos
        if (vAct !== 0 || vPas !== 0 || sAct !== 0 || sPas !== 0) {
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${t}</td>
                <td>${formatNumber(vAct)}</td>
                <td>${formatNumber(vPas)}</td>
                <td class="${difV >= 0 ? 'pos' : 'neg'}" style="border-right: 2px solid #eee;">${difV > 0 ? '+' : ''}${formatNumber(difV)}</td>
                <td>${formatNumber(sAct)}</td>
                <td>${formatNumber(sPas)}</td>
                <td class="${difS >= 0 ? 'pos' : 'neg'}">${difS > 0 ? '+' : ''}${formatNumber(difS)}</td>
            `;
            tbodyGerencial.appendChild(tr);
        }
    });

    // --- 6.5 TABLA 2: Detalle Operativo (Por División y Categoría) ---
    const tbodyDetalle = document.querySelector('#tablaDetalle tbody');
    tbodyDetalle.innerHTML = '';

    // Agrupamos la información por División + Categoría
    let agrupadoDetalle = {};
    vData.forEach(d => {
        let clave = d.division + "|" + d.categoria;
        if (!agrupadoDetalle[clave]) {
            agrupadoDetalle[clave] = { div: d.division, cat: d.categoria, act: 0, pas: 0 };
        }
        agrupadoDetalle[clave].act += d.actual;
        agrupadoDetalle[clave].pas += d.pasado;
    });

    // Convertimos el objeto a un arreglo para ordenarlo y mostrarlo
    let arrDetalle = Object.values(agrupadoDetalle).sort((a, b) => a.div.localeCompare(b.div) || a.cat.localeCompare(b.cat));

    arrDetalle.forEach(item => {
        let difCat = item.act - item.pas;
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.div}</td>
            <td>${item.cat}</td>
            <td>${formatNumber(item.act)}</td>
            <td>${formatNumber(item.pas)}</td>
            <td class="${difCat >= 0 ? 'pos' : 'neg'}">${difCat > 0 ? '+' : ''}${formatNumber(difCat)}</td>
        `;
        tbodyDetalle.appendChild(tr);
    });
}
