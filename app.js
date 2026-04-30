Chart.register(ChartDataLabels);

let datosVentas = [];
let datosSaldos = [];
const ordenMesesMap = { 'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4, 'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8, 'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12 };

// Paginación de tablas
let stateTiendas = { data: [], page: 1, limit: 25 };
let stateGrupos = { data: [], page: 1, limit: 25 };

function formatNumber(num) {
    if (num === null || num === undefined) return "0";
    return new Intl.NumberFormat('en-US').format(Math.round(num));
}

function openTab(evt, tabName) {
    let i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) tabcontent[i].className = tabcontent[i].className.replace(" active", "");
    tablinks = document.getElementsByClassName("tab-button");
    for (i = 0; i < tablinks.length; i++) tablinks[i].className = tablinks[i].className.replace(" active", "");
    
    document.getElementById(tabName).className += " active";
    evt.currentTarget.className += " active";
    if(tabName === 'tab-graficos') actualizarTablero();
}

// 1. CARGAR VENTAS (Buscando la columna GRUPO)
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
                    // Si tu archivo tiene una columna específica de Grupo, asumimos que es la columna 6 o la 2. 
                    // Si no, concatenamos división y categoría para evitar fallos. (Ajusta fila[X] si conoces la posición exacta)
                    const grupoReal = fila[6] || fila[2] || (division + " - " + categoria); 

                    for(let c = 7; c < fila.length; c++) {
                        if (metricasRow[c] === 'Venta_Und_Anterior') {
                            let mes = mesesRow[c];
                            let pasado = parseFloat(fila[c]) || 0;
                            let actual = parseFloat(fila[c+1]) || 0; 
                            if (pasado !== 0 || actual !== 0) {
                                procesado.push({ mes, tienda, division, categoria, grupo: grupoReal, pasado, actual });
                            }
                        }
                    }
                }
                resolver(procesado);
            }, error: rechazar
        });
    });
}

// 2. CARGAR SALDOS (Buscando la columna GRUPO)
function cargarSaldos() {
    return new Promise((resolver, rechazar) => {
        Papa.parse('saldos.csv', {
            download: true, header: true, delimiter: ';', dynamicTyping: true,
            complete: function(resultados) {
                let procesado = [];
                resultados.data.forEach(fila => {
                    if(fila.Name) {
                        let act = parseFloat(fila.Saldo_Total_Anterior) || 0; 
                        let pas = parseFloat(fila.Saldo_Total_Actual) || 0;
                        const grupoReal = fila.Grupo || fila.Group || (fila.Division + " - " + fila.Categoria); // Intenta capturar la cabecera Grupo

                        procesado.push({ tienda: fila.Name, division: fila.Division, categoria: fila.Categoria, grupo: grupoReal, saldo_actual: act, saldo_pasado: pas });
                    }
                });
                resolver(procesado);
            }, error: rechazar
        });
    });
}

Promise.all([cargarVentas(), cargarSaldos()]).then(archivos => {
    datosVentas = archivos[0];
    datosSaldos = archivos[1];
    document.getElementById('loading').style.display = 'none';
    document.getElementById('kpi-container').style.display = 'grid';
    document.getElementById('filtros-container').style.display = 'flex';
    document.getElementById('tabs-container').style.display = 'flex';
    document.getElementById('graficos-container').style.display = 'block';
    inicializarFiltros();
    actualizarTablero();
}).catch(console.error);

function inicializarFiltros() {
    let mesesUnicos = [...new Set(datosVentas.map(d => d.mes))].sort((a, b) => ordenMesesMap[a] - ordenMesesMap[b]);
    llenarSelect('f-mes', mesesUnicos);
    llenarSelect('f-tienda', [...new Set(datosVentas.map(d => d.tienda))].sort());
    llenarSelect('f-division', [...new Set(datosVentas.map(d => d.division))].sort());
    llenarSelect('f-categoria', [...new Set(datosVentas.map(d => d.categoria))].sort());

    ['f-mes', 'f-tienda', 'f-division', 'f-categoria'].forEach(id => {
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

let graficoLinea, graficoDiv, graficoCat;

// Configuración común para gráficos limpios (Punto 4)
const configGraficos = {
    responsive: true, maintainAspectRatio: false,
    layout: { padding: { top: 30, right: 30, bottom: 0, left: 30 } }, // Previene que se corten los números
    scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Montserrat', weight: 'bold' } } },
        y: { display: false, grid: { display: false }, min: 0 } // Oculta el eje Y
    },
    plugins: {
        legend: { position: 'top', labels: { font: { family: 'Montserrat', weight: 'bold' } } },
        datalabels: {
            color: '#333', anchor: 'end', align: 'top', offset: 2,
            font: { family: 'Montserrat', weight: '800', size: 11 },
            formatter: function(value) { return formatNumber(value); }
        }
    }
};

function actualizarTablero() {
    const fMes = document.getElementById('f-mes').value;
    const fTienda = document.getElementById('f-tienda').value;
    const fDiv = document.getElementById('f-division').value;
    const fCat = document.getElementById('f-categoria').value;

    let vFiltradas = datosVentas.filter(d => (fMes === 'Todos' || d.mes === fMes) && (fTienda === 'Todos' || d.tienda === fTienda) && (fDiv === 'Todos' || d.division === fDiv) && (fCat === 'Todos' || d.categoria === fCat));
    let vTendencia = datosVentas.filter(d => (fTienda === 'Todos' || d.tienda === fTienda) && (fDiv === 'Todos' || d.division === fDiv) && (fCat === 'Todos' || d.categoria === fCat));
    let sFiltrados = datosSaldos.filter(d => (fTienda === 'Todos' || d.tienda === fTienda) && (fDiv === 'Todos' || d.division === fDiv) && (fCat === 'Todos' || d.categoria === fCat));

    actualizarKPIs(vFiltradas, sFiltrados);
    dibujarGraficos(vFiltradas, vTendencia);
    prepararDatosTablas(vFiltradas, sFiltrados);
}

function actualizarKPIs(vData, sData) {
    let vAct = vData.reduce((s, d) => s + d.actual, 0);
    let vPas = vData.reduce((s, d) => s + d.pasado, 0);
    let vDif = vAct - vPas;

    let sAct = sData.reduce((s, d) => s + d.saldo_actual, 0);
    let sPas = sData.reduce((s, d) => s + d.saldo_pasado, 0);
    let sDif = sAct - sPas;

    document.getElementById('kpi-ventas-act').innerText = formatNumber(vAct);
    document.getElementById('kpi-ventas-pas').innerText = formatNumber(vPas);
    let divVDif = document.getElementById('kpi-ventas-dif');
    divVDif.innerText = (vDif > 0 ? '+' : '') + formatNumber(vDif);
    divVDif.className = 'kpi-dif ' + (vDif >= 0 ? 'pos' : 'neg');

    document.getElementById('kpi-saldos-act').innerText = formatNumber(sAct);
    document.getElementById('kpi-saldos-pas').innerText = formatNumber(sPas);
    let divSDif = document.getElementById('kpi-saldos-dif');
    divSDif.innerText = (sDif > 0 ? '+' : '') + formatNumber(sDif);
    divSDif.className = 'kpi-dif ' + (sDif >= 0 ? 'pos' : 'neg');
}

function dibujarGraficos(vData, vTendenciaData) {
    // --- LÍNEAS DE TIEMPO (Cronológico y etiquetas ajustadas) ---
    const ctxLinea = document.getElementById('chartLine').getContext('2d');
    let mesesOrdenados = [...new Set(datosVentas.map(item => item.mes))].sort((a, b) => ordenMesesMap[a] - ordenMesesMap[b]);
    const totActual = mesesOrdenados.map(m => vTendenciaData.filter(d => d.mes === m).reduce((s, d) => s + d.actual, 0));
    const totPasado = mesesOrdenados.map(m => vTendenciaData.filter(d => d.mes === m).reduce((s, d) => s + d.pasado, 0));

    if(graficoLinea) graficoLinea.destroy();
    graficoLinea = new Chart(ctxLinea, {
        type: 'line',
        data: {
            labels: mesesOrdenados,
            datasets: [
                { label: 'Año Actual', data: totActual, borderColor: '#012094', backgroundColor: '#012094', tension: 0.3, borderWidth: 4, pointRadius: 5 },
                { label: 'Año Pasado', data: totPasado, borderColor: '#E1251B', backgroundColor: '#E1251B', tension: 0.3, borderWidth: 4, pointRadius: 5 }
            ]
        }, 
        options: {
            ...configGraficos,
            layout: { padding: { top: 40, right: 40, bottom: 0, left: 40 } }, // Extra padding lateral
            plugins: {
                ...configGraficos.plugins,
                datalabels: {
                    color: function(context) { return context.dataset.borderColor; },
                    anchor: 'center', align: 'top', offset: 10,
                    font: { family: 'Montserrat', weight: '800', size: 12 },
                    formatter: function(value) { return formatNumber(value); }
                }
            }
        }
    });
    
    // --- TOP 10 DIVISIONES ---
    const ctxDiv = document.getElementById('chartDiv').getContext('2d');
    let resumenDiv = {};
    vData.forEach(d => {
        if (!resumenDiv[d.division]) resumenDiv[d.division] = { act: 0, pas: 0 };
        resumenDiv[d.division].act += d.actual;
        resumenDiv[d.division].pas += d.pasado;
    });
    let top10Div = Object.entries(resumenDiv).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.act - a.act).slice(0, 10);

    if(graficoDiv) graficoDiv.destroy();
    graficoDiv = new Chart(ctxDiv, {
        type: 'bar',
        data: {
            labels: top10Div.map(d => d.name),
            datasets: [
                { label: 'Venta Actual', data: top10Div.map(d => d.act), backgroundColor: '#012094' },
                { label: 'Venta Pasada', data: top10Div.map(d => d.pas), backgroundColor: '#E1251B' }
            ]
        }, options: configGraficos
    });

    // --- TOP 10 CATEGORÍAS ---
    const ctxCat = document.getElementById('chartCat').getContext('2d');
    let resumenCat = {};
    vData.forEach(d => {
        if (!resumenCat[d.categoria]) resumenCat[d.categoria] = { act: 0, pas: 0 };
        resumenCat[d.categoria].act += d.actual;
        resumenCat[d.categoria].pas += d.pasado;
    });
    let top10Cat = Object.entries(resumenCat).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.act - a.act).slice(0, 10);

    if(graficoCat) graficoCat.destroy();
    graficoCat = new Chart(ctxCat, {
        type: 'bar',
        data: {
            labels: top10Cat.map(d => d.name),
            datasets: [
                { label: 'Venta Actual', data: top10Cat.map(d => d.act), backgroundColor: '#012094' },
                { label: 'Venta Pasada', data: top10Cat.map(d => d.pas), backgroundColor: '#E1251B' }
            ]
        }, options: configGraficos
    });
}

// 7. PREPARAR DATOS PARA TABLAS PAGINADAS
function prepararDatosTablas(vData, sData) {
    // 7.1 Tiendas
    let tiendasCruzadas = [...new Set([...vData.map(d => d.tienda), ...sData.map(d => d.tienda)])].sort();
    stateTiendas.data = [];
    tiendasCruzadas.forEach(t => {
        let vAct = vData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.actual, 0);
        let vPas = vData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.pasado, 0);
        let sAct = sData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.saldo_actual, 0);
        let sPas = sData.filter(d => d.tienda === t).reduce((sum, d) => sum + d.saldo_pasado, 0);
        if (vAct !== 0 || vPas !== 0 || sAct !== 0 || sPas !== 0) {
            stateTiendas.data.push({ tienda: t, vAct, vPas, sAct, sPas });
        }
    });

    // 7.2 Grupos (Buscando la columna GRUPO extraída del archivo)
    let resumenGrupos = {};
    vData.forEach(d => {
        let g = d.grupo;
        if (!resumenGrupos[g]) resumenGrupos[g] = { nombre: g, vAct: 0, vPas: 0, sAct: 0, sPas: 0 };
        resumenGrupos[g].vAct += d.actual; resumenGrupos[g].vPas += d.pasado;
    });
    sData.forEach(d => {
        let g = d.grupo;
        if (!resumenGrupos[g]) resumenGrupos[g] = { nombre: g, vAct: 0, vPas: 0, sAct: 0, sPas: 0 };
        resumenGrupos[g].sAct += d.saldo_actual; resumenGrupos[g].sPas += d.saldo_pasado;
    });
    stateGrupos.data = Object.values(resumenGrupos).sort((a, b) => a.nombre.localeCompare(b.nombre));

    stateTiendas.page = 1;
    stateGrupos.page = 1;
    renderTablaTiendas();
    renderTablaGrupos();
}

// 8. LÓGICA DE PAGINACIÓN (Punto 2)
function cambiarLimite(tipo) {
    let val = parseInt(document.getElementById(`limit-${tipo}`).value);
    if(tipo === 'tiendas') { stateTiendas.limit = val; stateTiendas.page = 1; renderTablaTiendas(); }
    if(tipo === 'grupos') { stateGrupos.limit = val; stateGrupos.page = 1; renderTablaGrupos(); }
}

function cambiarPagina(tipo, dir) {
    if(tipo === 'tiendas') {
        const maxPage = Math.ceil(stateTiendas.data.length / stateTiendas.limit);
        if (stateTiendas.page + dir >= 1 && stateTiendas.page + dir <= maxPage) { stateTiendas.page += dir; renderTablaTiendas(); }
    }
    if(tipo === 'grupos') {
        const maxPage = Math.ceil(stateGrupos.data.length / stateGrupos.limit);
        if (stateGrupos.page + dir >= 1 && stateGrupos.page + dir <= maxPage) { stateGrupos.page += dir; renderTablaGrupos(); }
    }
}

function renderTablaTiendas() {
    const tbody = document.querySelector('#tablaGerencialTiendas tbody');
    tbody.innerHTML = '';
    const startIndex = (stateTiendas.page - 1) * stateTiendas.limit;
    const paginatedItems = stateTiendas.data.slice(startIndex, startIndex + stateTiendas.limit);
    
    paginatedItems.forEach(item => {
        let difV = item.vAct - item.vPas;
        let difS = item.sAct - item.sPas;
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.tienda}</td>
            <td>${formatNumber(item.vAct)}</td>
            <td>${formatNumber(item.vPas)}</td>
            <td class="${difV >= 0 ? 'pos' : 'neg'}" style="border-right: 2px solid #eee;">${difV > 0 ? '+' : ''}${formatNumber(difV)}</td>
            <td>${formatNumber(item.sAct)}</td>
            <td>${formatNumber(item.sPas)}</td>
            <td class="${difS >= 0 ? 'pos' : 'neg'}">${difS > 0 ? '+' : ''}${formatNumber(difS)}</td>
        `;
        tbody.appendChild(tr);
    });
    document.getElementById('info-tiendas').innerText = `Página ${stateTiendas.page} de ${Math.ceil(stateTiendas.data.length / stateTiendas.limit) || 1} (${stateTiendas.data.length} registros)`;
}

function renderTablaGrupos() {
    const tbody = document.querySelector('#tablaDetalleGrupos tbody');
    tbody.innerHTML = '';
    const startIndex = (stateGrupos.page - 1) * stateGrupos.limit;
    const paginatedItems = stateGrupos.data.slice(startIndex, startIndex + stateGrupos.limit);

    paginatedItems.forEach(item => {
        let difV = item.vAct - item.vPas;
        let difS = item.sAct - item.sPas;
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.nombre}</td>
            <td>${formatNumber(item.vAct)}</td>
            <td>${formatNumber(item.vPas)}</td>
            <td class="${difV >= 0 ? 'pos' : 'neg'}" style="border-right: 2px solid #eee;">${difV > 0 ? '+' : ''}${formatNumber(difV)}</td>
            <td>${formatNumber(item.sAct)}</td>
            <td>${formatNumber(item.sPas)}</td>
            <td class="${difS >= 0 ? 'pos' : 'neg'}">${difS > 0 ? '+' : ''}${formatNumber(difS)}</td>
        `;
        tbody.appendChild(tr);
    });
    document.getElementById('info-grupos').innerText = `Página ${stateGrupos.page} de ${Math.ceil(stateGrupos.data.length / stateGrupos.limit) || 1} (${stateGrupos.data.length} grupos)`;
}
